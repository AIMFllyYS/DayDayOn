package com.husteread.daydayon

import android.Manifest
import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import org.json.JSONArray
import org.json.JSONObject
import java.text.Collator
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * 手机相册高性能分页元数据、相册目录聚合与按需流式读取桥：
 * - 严格按照片真实拍摄/保存时间倒序（最新 → 最旧）：综合 `DATE_TAKEN`（毫秒）、`DATE_MODIFIED`（秒）与 `DATE_ADDED`（秒），
 *   消除云相册同步、换机迁移、目录移动或 RAW+JPEG 连拍导致的 `DATE_ADDED` 乱序问题；
 * - 统一基于 `MediaStore.getVersion` + `MediaStore.getGeneration` 维护轻量内存元数据快照，
 *   分页切片与切换相册目录耗时 < 1ms，翻页绝不重不漏；
 * - 提供 `getAlbumBucketsJson`：首项固定为「全部」，后续按稳定可预期顺序（系统核心相册优先 + 字典序固定兜底）返回手机相册/文件夹；
 * - 缩略图与选定大图通过 `/__native__/media/thumb/{id}` 与 `/__native__/media/full/{id}` 在后台 IO 线程池流式返回。
 */
object MediaAlbumBridge {

    const val BUCKET_ALL_ID = "__ALL__"
    const val BUCKET_ALL_LABEL = "全部"

    private const val MIN_VALID_EPOCH_SEC = 946_684_800L // 2000-01-01T00:00:00Z
    private const val MIN_VALID_EPOCH_MS = MIN_VALID_EPOCH_SEC * 1000L
    private const val FUTURE_DRIFT_TOLERANCE_MS = 24L * 60L * 60L * 1000L
    private const val LEGACY_CACHE_TTL_MS = 1_500L

    data class AlbumEntry(
        val id: Long,
        val name: String,
        val effectiveTimeMillis: Long,
        val width: Int,
        val height: Int,
        val bucketId: String,
        val bucketName: String,
        val relativePath: String,
    )

    data class AlbumBucket(
        val id: String,
        val name: String,
        val count: Int,
    )

    private data class MediaSnapshot(
        val versionKey: String,
        val builtAtMillis: Long,
        val partialAccess: Boolean,
        val entries: List<AlbumEntry>,
        val buckets: List<AlbumBucket>,
    )

    @Volatile
    private var cachedSnapshot: MediaSnapshot? = null

    fun invalidateCache() {
        cachedSnapshot = null
    }

    fun isPartialPhotoAccess(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return false
        val full = context.checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) ==
            PackageManager.PERMISSION_GRANTED
        if (full) return false
        return context.checkSelfPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) ==
            PackageManager.PERMISSION_GRANTED
    }

    private fun computeMediaVersionKey(context: Context, partial: Boolean): String? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val ver = MediaStore.getVersion(context, MediaStore.VOLUME_EXTERNAL_PRIMARY)
                val gen = MediaStore.getGeneration(context, MediaStore.VOLUME_EXTERNAL_PRIMARY)
                "$ver:$gen:$partial"
            } else {
                null
            }
        } catch (_: Throwable) {
            null
        }
    }

    /**
     * 归一化计算单张照片真实时间（毫秒）：
     * 1. 优先取有效的 `DATE_TAKEN`（兼容极少数 ROM 误写 10 位秒级时间戳的情况，并拦截损坏的未来年份）；
     * 2. 截图、聊天保存图等无 EXIF 拍摄时间（`DATE_TAKEN == 0`）时，取文件实际写入时间 `DATE_MODIFIED * 1000`；
     * 3. 兜底取 `DATE_ADDED * 1000`。
     */
    internal fun computeEffectiveTimeMillis(
        dateTakenRaw: Long,
        dateModifiedSec: Long,
        dateAddedSec: Long,
        nowMillis: Long,
    ): Long {
        val maxAllowedMillis = nowMillis + FUTURE_DRIFT_TOLERANCE_MS
        val normalizedTaken = when {
            dateTakenRaw >= MIN_VALID_EPOCH_MS -> dateTakenRaw
            dateTakenRaw in MIN_VALID_EPOCH_SEC..99_999_999_999L -> dateTakenRaw * 1000L
            else -> 0L
        }
        if (normalizedTaken in MIN_VALID_EPOCH_MS..maxAllowedMillis) {
            return normalizedTaken
        }

        val modifiedMillis = if (dateModifiedSec > 0L) dateModifiedSec * 1000L else 0L
        if (modifiedMillis in 1L..maxAllowedMillis) {
            return modifiedMillis
        }

        val addedMillis = if (dateAddedSec > 0L) dateAddedSec * 1000L else 0L
        if (addedMillis > 0L) {
            return addedMillis.coerceAtMost(maxAllowedMillis)
        }
        return normalizedTaken.coerceAtLeast(modifiedMillis).coerceAtLeast(0L)
    }

    private fun extractFolderFromRelativePath(relativePath: String): String {
        val trimmed = relativePath.trim().trim('/')
        if (trimmed.isEmpty()) return ""
        val lastSlash = trimmed.lastIndexOf('/')
        return if (lastSlash >= 0) trimmed.substring(lastSlash + 1).trim() else trimmed
    }

    private fun bucketPriorityRank(name: String, sampleRelativePath: String): Int {
        val lowerName = name.lowercase(Locale.ROOT)
        val lowerPath = sampleRelativePath.lowercase(Locale.ROOT).trim('/')
        return when {
            lowerPath == "dcim/camera" || lowerPath.startsWith("dcim/camera/") ||
                lowerName == "camera" || name == "相机" -> 0
            lowerPath.contains("screenshot") || lowerName == "screenshots" ||
                lowerName == "screenshot" || name == "截屏" || name == "截图" -> 1
            lowerPath == "dcim/raw" || lowerPath.startsWith("dcim/raw/") || lowerName == "raw" -> 2
            lowerPath.contains("weixin") || lowerPath.contains("wechat") ||
                lowerName == "weixin" || lowerName == "wechat" || name == "微信" -> 3
            lowerPath == "pictures" || lowerName == "pictures" || name == "图片" -> 4
            lowerPath.startsWith("download") || lowerName == "download" ||
                lowerName == "downloads" || name == "下载" -> 5
            else -> 10
        }
    }

    private fun buildBuckets(entries: List<AlbumEntry>): List<AlbumBucket> {
        val result = ArrayList<AlbumBucket>()
        result.add(AlbumBucket(id = BUCKET_ALL_ID, name = BUCKET_ALL_LABEL, count = entries.size))
        if (entries.isEmpty()) return result

        data class MutableBucketAcc(
            val id: String,
            var name: String,
            var samplePath: String,
            var count: Int,
        )

        val grouped = LinkedHashMap<String, MutableBucketAcc>()
        for (entry in entries) {
            val existing = grouped[entry.bucketId]
            if (existing == null) {
                grouped[entry.bucketId] = MutableBucketAcc(
                    id = entry.bucketId,
                    name = entry.bucketName,
                    samplePath = entry.relativePath,
                    count = 1,
                )
            } else {
                existing.count += 1
                if (existing.samplePath.isEmpty() && entry.relativePath.isNotEmpty()) {
                    existing.samplePath = entry.relativePath
                }
            }
        }

        val collator = Collator.getInstance(Locale.CHINA)
        val sortedFolders = grouped.values.sortedWith { a, b ->
            val rankA = bucketPriorityRank(a.name, a.samplePath)
            val rankB = bucketPriorityRank(b.name, b.samplePath)
            if (rankA != rankB) return@sortedWith rankA.compareTo(rankB)
            val nameCmp = collator.compare(a.name.lowercase(Locale.ROOT), b.name.lowercase(Locale.ROOT))
            if (nameCmp != 0) return@sortedWith nameCmp
            a.id.compareTo(b.id)
        }

        for (folder in sortedFolders) {
            result.add(
                AlbumBucket(
                    id = folder.id,
                    name = folder.name,
                    count = folder.count,
                ),
            )
        }
        return result
    }

    private fun loadSnapshot(context: Context): MediaSnapshot {
        val now = System.currentTimeMillis()
        val partial = isPartialPhotoAccess(context)
        val versionKey = computeMediaVersionKey(context, partial)
        val existing = cachedSnapshot
        if (existing != null && existing.partialAccess == partial) {
            if (versionKey != null && existing.versionKey == versionKey) {
                return existing
            }
            if (versionKey == null && now - existing.builtAtMillis <= LEGACY_CACHE_TTL_MS) {
                return existing
            }
        }

        val rawList = ArrayList<AlbumEntry>(256)
        val projectionList = mutableListOf(
            MediaStore.Images.Media._ID,
            MediaStore.Images.Media.DISPLAY_NAME,
            MediaStore.Images.Media.DATE_TAKEN,
            MediaStore.Images.Media.DATE_MODIFIED,
            MediaStore.Images.Media.DATE_ADDED,
            MediaStore.Images.Media.WIDTH,
            MediaStore.Images.Media.HEIGHT,
            MediaStore.Images.Media.BUCKET_ID,
            MediaStore.Images.Media.BUCKET_DISPLAY_NAME,
        )
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            projectionList.add(MediaStore.Images.Media.RELATIVE_PATH)
            projectionList.add(MediaStore.Images.Media.IS_PENDING)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            projectionList.add(MediaStore.Images.Media.IS_TRASHED)
        }
        val projection = projectionList.toTypedArray()

        try {
            val cursor = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                val queryArgs = Bundle().apply {
                    putStringArray(
                        ContentResolver.QUERY_ARG_SORT_COLUMNS,
                        arrayOf(MediaStore.Images.Media.DATE_MODIFIED, MediaStore.Images.Media._ID),
                    )
                    putInt(
                        ContentResolver.QUERY_ARG_SORT_DIRECTION,
                        ContentResolver.QUERY_SORT_DIRECTION_DESCENDING,
                    )
                }
                context.contentResolver.query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    queryArgs,
                    null,
                )
            } else {
                val sortOrder =
                    "${MediaStore.Images.Media.DATE_MODIFIED} DESC, ${MediaStore.Images.Media._ID} DESC"
                context.contentResolver.query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder,
                )
            }

            cursor?.use { c ->
                val idCol = c.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                val nameCol = c.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                val dateTakenCol = c.getColumnIndex(MediaStore.Images.Media.DATE_TAKEN)
                val dateModCol = c.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED)
                val dateAddedCol = c.getColumnIndex(MediaStore.Images.Media.DATE_ADDED)
                val wCol = c.getColumnIndex(MediaStore.Images.Media.WIDTH)
                val hCol = c.getColumnIndex(MediaStore.Images.Media.HEIGHT)
                val bucketIdCol = c.getColumnIndex(MediaStore.Images.Media.BUCKET_ID)
                val bucketNameCol = c.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)
                val relPathCol = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    c.getColumnIndex(MediaStore.Images.Media.RELATIVE_PATH)
                } else {
                    -1
                }
                val pendingCol = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    c.getColumnIndex(MediaStore.Images.Media.IS_PENDING)
                } else {
                    -1
                }
                val trashedCol = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    c.getColumnIndex(MediaStore.Images.Media.IS_TRASHED)
                } else {
                    -1
                }

                while (c.moveToNext()) {
                    if (pendingCol >= 0 && c.getInt(pendingCol) == 1) continue
                    if (trashedCol >= 0 && c.getInt(trashedCol) == 1) continue

                    val id = c.getLong(idCol)
                    val name = c.getString(nameCol)?.takeIf { it.isNotBlank() } ?: "photo_$id.jpg"
                    val dateTakenRaw = if (dateTakenCol >= 0 && !c.isNull(dateTakenCol)) {
                        c.getLong(dateTakenCol)
                    } else {
                        0L
                    }
                    val dateModSec = if (dateModCol >= 0 && !c.isNull(dateModCol)) {
                        c.getLong(dateModCol)
                    } else {
                        0L
                    }
                    val dateAddedSec = if (dateAddedCol >= 0 && !c.isNull(dateAddedCol)) {
                        c.getLong(dateAddedCol)
                    } else {
                        0L
                    }
                    val effectiveMillis = computeEffectiveTimeMillis(
                        dateTakenRaw = dateTakenRaw,
                        dateModifiedSec = dateModSec,
                        dateAddedSec = dateAddedSec,
                        nowMillis = now,
                    )
                    val w = if (wCol >= 0) c.getInt(wCol) else 0
                    val h = if (hCol >= 0) c.getInt(hCol) else 0
                    val relPath = if (relPathCol >= 0 && !c.isNull(relPathCol)) {
                        c.getString(relPathCol) ?: ""
                    } else {
                        ""
                    }
                    val rawBucketName = if (bucketNameCol >= 0 && !c.isNull(bucketNameCol)) {
                        c.getString(bucketNameCol)?.trim().orEmpty()
                    } else {
                        ""
                    }
                    val resolvedBucketName = rawBucketName
                        .ifEmpty { extractFolderFromRelativePath(relPath) }
                        .ifEmpty { "其他" }
                    val rawBucketId = if (bucketIdCol >= 0 && !c.isNull(bucketIdCol)) {
                        c.getString(bucketIdCol)?.trim().orEmpty()
                    } else {
                        ""
                    }
                    val resolvedBucketId = rawBucketId.ifEmpty {
                        "folder:${resolvedBucketName.lowercase(Locale.ROOT)}"
                    }

                    rawList.add(
                        AlbumEntry(
                            id = id,
                            name = name,
                            effectiveTimeMillis = effectiveMillis,
                            width = if (w > 0) w else 1080,
                            height = if (h > 0) h else 1080,
                            bucketId = resolvedBucketId,
                            bucketName = resolvedBucketName,
                            relativePath = relPath,
                        ),
                    )
                }
            }
        } catch (_: Throwable) {
            // 未授权或读取异常时安全返回空列表
        }

        // 严格按真实时间从最新到最旧排序；毫秒相同时按 MediaStore _ID 倒序决胜
        rawList.sortWith(
            compareByDescending<AlbumEntry> { it.effectiveTimeMillis }
                .thenByDescending { it.id },
        )

        val buckets = buildBuckets(rawList)
        val snapshot = MediaSnapshot(
            versionKey = versionKey ?: "legacy:$now",
            builtAtMillis = now,
            partialAccess = partial,
            entries = rawList,
            buckets = buckets,
        )
        cachedSnapshot = snapshot
        return snapshot
    }

    private fun newUtcIsoFormatter(): SimpleDateFormat {
        return SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }
    }

    fun getAlbumBucketsJson(context: Context): String {
        val snapshot = loadSnapshot(context)
        val arr = JSONArray()
        for (bucket in snapshot.buckets) {
            arr.put(
                JSONObject().apply {
                    put("id", bucket.id)
                    put("name", bucket.name)
                    put("count", bucket.count)
                },
            )
        }
        return arr.toString()
    }

    fun queryEntriesPage(
        context: Context,
        offset: Int,
        limit: Int,
        bucketId: String = BUCKET_ALL_ID,
    ): Triple<List<AlbumEntry>, Boolean, Boolean> {
        val safeOffset = offset.coerceAtLeast(0)
        val safeLimit = limit.coerceIn(1, 60)
        val snapshot = loadSnapshot(context)
        val normalizedBucket = bucketId.trim()
        val filtered = if (normalizedBucket.isEmpty() || normalizedBucket == BUCKET_ALL_ID) {
            snapshot.entries
        } else {
            snapshot.entries.filter { it.bucketId == normalizedBucket }
        }

        if (safeOffset >= filtered.size) {
            return Triple(emptyList(), false, snapshot.partialAccess)
        }
        val endExclusive = (safeOffset + safeLimit).coerceAtMost(filtered.size)
        val hasMore = endExclusive < filtered.size
        return Triple(filtered.subList(safeOffset, endExclusive), hasMore, snapshot.partialAccess)
    }

    fun getAlbumPhotosPageJson(
        context: Context,
        offset: Int,
        limit: Int,
        bucketId: String = BUCKET_ALL_ID,
    ): String {
        val safeOffset = offset.coerceAtLeast(0)
        val safeLimit = limit.coerceIn(1, 60)
        val (entries, hasMore, partialAccess) = queryEntriesPage(context, safeOffset, safeLimit, bucketId)
        val arr = JSONArray()
        val iso = newUtcIsoFormatter()

        for (entry in entries) {
            val idStr = entry.id.toString()
            arr.put(
                JSONObject().apply {
                    put("id", idStr)
                    put("name", entry.name)
                    put("previewUrl", "/__native__/media/thumb/$idStr")
                    put("fullUrl", "/__native__/media/full/$idStr")
                    put("createdAt", iso.format(Date(entry.effectiveTimeMillis)))
                    put("width", entry.width)
                    put("height", entry.height)
                    put("albumId", entry.bucketId)
                    put("albumName", entry.bucketName)
                },
            )
        }

        return JSONObject().apply {
            put("items", arr)
            put("hasMore", hasMore)
            put("nextOffset", safeOffset + entries.size)
            put("partialAccess", partialAccess)
        }.toString()
    }

    /** 向下兼容旧版单次列表接口（同样严格按真实时间最新在前） */
    fun getAlbumPhotosJson(context: Context, limit: Int): String {
        val (entries, _, _) = queryEntriesPage(context, 0, limit.coerceIn(1, 60), BUCKET_ALL_ID)
        val arr = JSONArray()
        val iso = newUtcIsoFormatter()
        for (entry in entries) {
            val idStr = entry.id.toString()
            arr.put(
                JSONObject().apply {
                    put("id", idStr)
                    put("name", entry.name)
                    put("previewUrl", "/__native__/media/thumb/$idStr")
                    put("fullUrl", "/__native__/media/full/$idStr")
                    put("createdAt", iso.format(Date(entry.effectiveTimeMillis)))
                    put("width", entry.width)
                    put("height", entry.height)
                    put("albumId", entry.bucketId)
                    put("albumName", entry.bucketName)
                },
            )
        }
        return arr.toString()
    }

    fun readPhotoJpegBytes(context: Context, photoId: Long, maxDim: Int = 1920): ByteArray? {
        val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, photoId)
        return NativeCameraHelper.uriToJpegBytes(context, uri, maxDim)
    }

    fun readPhotoByIdDataUrl(context: Context, photoId: String): String {
        val id = photoId.toLongOrNull() ?: return ""
        val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id)
        return NativeCameraHelper.uriToJpegDataUrl(context, uri, 1920) ?: ""
    }
}
