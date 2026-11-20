package com.husteread.daydayon

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * 原生安全文件 ContentProvider（零 AndroidX 依赖，严守 ADR-0002）：
 * - 通道 1（相机单次临时输出）：`content://com.husteread.daydayon.cameraprovider/shot_<ts>.jpg`
 *   严格限制在 `cacheDir/camera_shots/` 目录内，MainActivity 读取压缩进内存后立即删除临时文件，绝不持久化保留用户原图；
 * - 通道 2（应用内更新安装包）：`content://com.husteread.daydayon.cameraprovider/apk/DayDayOn.apk`
 *   严格限制在 `cacheDir/apk_updates/` 目录内，供 Android 系统 PackageInstaller 读取并完成应用覆盖升级；
 * - 通道 3（打卡分析报告海报分享）：`content://com.husteread.daydayon.cameraprovider/share/<name>.png`
 *   严格限制在 `cacheDir/share_exports/` 目录内，只存放原生矢量生成的报告 PNG，供系统分享与剪贴板使用。
 */
class CameraTempFileProvider : ContentProvider() {

    override fun onCreate(): Boolean = true

    override fun getType(uri: Uri): String {
        val segs = uri.pathSegments
        if (segs != null && segs.size == 2 && segs[0] == APK_PATH_PREFIX) {
            return "application/vnd.android.package-archive"
        }
        if (segs != null && segs.size == 2 && segs[0] == SHARE_PATH_PREFIX) {
            return "image/png"
        }
        val last = uri.lastPathSegment ?: ""
        if (last.endsWith(".apk", ignoreCase = true)) {
            return "application/vnd.android.package-archive"
        }
        if (last.endsWith(".png", ignoreCase = true)) {
            return "image/png"
        }
        return "image/jpeg"
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?,
    ): Cursor {
        val file = resolveSafeFile(uri)
        val cols = projection ?: arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)
        val cursor = MatrixCursor(cols, 1)
        val defaultName = when (getType(uri)) {
            "application/vnd.android.package-archive" -> "DayDayOn.apk"
            "image/png" -> "DayDayOn-report.png"
            else -> "camera_shot.jpg"
        }
        val row = Array<Any?>(cols.size) { idx ->
            when (cols[idx]) {
                OpenableColumns.DISPLAY_NAME -> file?.name ?: defaultName
                OpenableColumns.SIZE -> if (file != null && file.exists()) file.length() else 0L
                else -> null
            }
        }
        cursor.addRow(row)
        return cursor
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val file = resolveSafeFile(uri) ?: throw FileNotFoundException("Invalid provider uri")
        val pfdMode = when (mode) {
            "r" -> ParcelFileDescriptor.MODE_READ_ONLY
            "w", "wt" ->
                ParcelFileDescriptor.MODE_WRITE_ONLY or
                    ParcelFileDescriptor.MODE_CREATE or
                    ParcelFileDescriptor.MODE_TRUNCATE
            "wa" ->
                ParcelFileDescriptor.MODE_WRITE_ONLY or
                    ParcelFileDescriptor.MODE_CREATE or
                    ParcelFileDescriptor.MODE_APPEND
            "rw" -> ParcelFileDescriptor.MODE_READ_WRITE or ParcelFileDescriptor.MODE_CREATE
            "rwt" ->
                ParcelFileDescriptor.MODE_READ_WRITE or
                    ParcelFileDescriptor.MODE_CREATE or
                    ParcelFileDescriptor.MODE_TRUNCATE
            else -> throw IllegalArgumentException("Unsupported mode: $mode")
        }
        return ParcelFileDescriptor.open(file, pfdMode)
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = null

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int {
        val file = resolveSafeFile(uri) ?: return 0
        return if (file.exists() && file.delete()) 1 else 0
    }

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?,
    ): Int = 0

    private fun resolveSafeFile(uri: Uri): File? {
        val ctx = context ?: return null
        val segs = uri.pathSegments ?: return null
        val isApk = segs.size == 2 && segs[0] == APK_PATH_PREFIX
        val isShare = segs.size == 2 && segs[0] == SHARE_PATH_PREFIX
        val name = if (isApk || isShare) segs[1] else uri.lastPathSegment
        if (name.isNullOrBlank() || name.contains('/') || name.contains('\\') || name.contains("..")) {
            return null
        }
        val dir = when {
            isApk -> ensureApkDir(ctx)
            isShare -> ensureShareDir(ctx)
            else -> ensureDir(ctx)
        }
        val target = File(dir, name)
        return try {
            val dirPath = dir.canonicalPath
            val targetPath = target.canonicalPath
            if (targetPath.startsWith(dirPath + File.separator)) target else null
        } catch (_: Throwable) {
            null
        }
    }

    companion object {
        const val AUTHORITY = "com.husteread.daydayon.cameraprovider"
        private const val SUB_DIR = "camera_shots"
        private const val APK_SUB_DIR = "apk_updates"
        private const val APK_PATH_PREFIX = "apk"
        private const val SHARE_SUB_DIR = "share_exports"
        private const val SHARE_PATH_PREFIX = "share"

        fun ensureDir(context: Context): File {
            val dir = File(context.cacheDir, SUB_DIR)
            if (!dir.exists()) {
                dir.mkdirs()
            }
            return dir
        }

        fun ensureApkDir(context: Context): File {
            val dir = File(context.cacheDir, APK_SUB_DIR)
            if (!dir.exists()) {
                dir.mkdirs()
            }
            return dir
        }

        fun ensureShareDir(context: Context): File {
            val dir = File(context.cacheDir, SHARE_SUB_DIR)
            if (!dir.exists()) {
                dir.mkdirs()
            }
            return dir
        }

        fun createTempShotFile(context: Context): File {
            val dir = ensureDir(context)
            return File(dir, "shot_${System.currentTimeMillis()}.jpg")
        }

        fun getApkUpdateFile(context: Context, fileName: String = "DayDayOn.apk"): File {
            val safeName = fileName.replace(Regex("[^A-Za-z0-9._-]"), "")
                .ifBlank { "DayDayOn.apk" }
            return File(ensureApkDir(context), safeName)
        }

        fun createShareImageFile(context: Context, fileName: String): File {
            val dir = ensureShareDir(context)
            val base = fileName.replace(Regex("[^A-Za-z0-9._-]"), "_")
                .trim('_')
                .ifBlank { "daydayon_report" }
            val withExt = if (base.endsWith(".png", ignoreCase = true)) base else "$base.png"
            return File(dir, "${System.currentTimeMillis()}_$withExt")
        }

        fun uriForFile(file: File): Uri {
            return Uri.Builder()
                .scheme("content")
                .authority(AUTHORITY)
                .appendPath(file.name)
                .build()
        }

        fun uriForApkFile(file: File): Uri {
            return Uri.Builder()
                .scheme("content")
                .authority(AUTHORITY)
                .appendPath(APK_PATH_PREFIX)
                .appendPath(file.name)
                .build()
        }

        fun uriForShareFile(file: File): Uri {
            return Uri.Builder()
                .scheme("content")
                .authority(AUTHORITY)
                .appendPath(SHARE_PATH_PREFIX)
                .appendPath(file.name)
                .build()
        }

        fun cleanupStaleFiles(context: Context) {
            for (sub in listOf(SUB_DIR, SHARE_SUB_DIR)) {
                try {
                    val dir = File(context.cacheDir, sub)
                    if (!dir.exists()) continue
                    dir.listFiles()?.forEach { f ->
                        try {
                            f.delete()
                        } catch (_: Throwable) {
                            // ignore
                        }
                    }
                } catch (_: Throwable) {
                    // ignore
                }
            }
        }
    }
}
