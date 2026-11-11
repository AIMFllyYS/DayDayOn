package com.husteread.daydayon

import android.content.ContentUris
import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import android.util.Base64
import android.util.LruCache
import android.util.Size
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * 原生高清图片内存压缩、EXIF 摆正、RAW/HEIC 兼容解码与系统级流式缩略图缓存（严守 ADR-0002）：
 * 1. 相册缩略图：优先走 Android 系统硬件缩略图缓存 `ContentResolver.loadThumbnail` + 8MB 内存 LruCache，单张毫秒级响应；
 * 2. 原图解码压缩：常规 JPEG/PNG/WebP 走 `BitmapFactory` + `ExifInterface` 旋转摆正；
 *    遇到 `.dng`（RAW）、`.heic`/`.heif` 或厂商相机 RAW 时，自动降级至 `ImageDecoder`（API 28+，自动应用 EXIF 方向）
 *    与 `loadThumbnail` / `ExifInterface.thumbnailBitmap` 内嵌预览提取；
 * 3. 全程仅在内存处理字节流，不留存任何用户原图。
 */
object NativeCameraHelper {

    private const val MAX_DIMENSION = 1920
    private const val JPEG_QUALITY = 86
    private const val THUMB_JPEG_QUALITY = 76
    private const val THUMB_CACHE_BYTES = 8 * 1024 * 1024

    private val thumbCache = object : LruCache<Long, ByteArray>(THUMB_CACHE_BYTES) {
        override fun sizeOf(key: Long, value: ByteArray): Int = value.size
    }

    fun clearThumbnailCache() {
        thumbCache.evictAll()
    }

    fun loadThumbnailJpegBytes(context: Context, photoId: Long, sizePx: Int = 240): ByteArray? {
        thumbCache.get(photoId)?.let { return it }
        val uri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, photoId)
        val bmp: Bitmap? = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                context.contentResolver.loadThumbnail(uri, Size(sizePx, sizePx), null)
            } else {
                @Suppress("DEPRECATION")
                val raw = MediaStore.Images.Thumbnails.getThumbnail(
                    context.contentResolver,
                    photoId,
                    MediaStore.Images.Thumbnails.MINI_KIND,
                    null,
                )
                if (raw != null) {
                    val matrix = readExifMatrix(context, uri)
                    transformBitmap(raw, matrix, sizePx)
                } else {
                    null
                }
            }
        } catch (_: Throwable) {
            null
        }
        val bitmap = bmp ?: return uriToJpegBytes(context, uri, sizePx, THUMB_JPEG_QUALITY)?.also {
            thumbCache.put(photoId, it)
        }

        return try {
            val softBitmap = ensureSoftwareBitmap(bitmap)
            val out = ByteArrayOutputStream()
            softBitmap.compress(Bitmap.CompressFormat.JPEG, THUMB_JPEG_QUALITY, out)
            if (softBitmap !== bitmap) {
                softBitmap.recycle()
            }
            bitmap.recycle()
            val bytes = out.toByteArray()
            if (bytes.isNotEmpty()) {
                thumbCache.put(photoId, bytes)
                bytes
            } else {
                null
            }
        } catch (_: Throwable) {
            null
        }
    }

    fun bitmapToJpegBytes(bitmap: Bitmap, maxDim: Int = MAX_DIMENSION, quality: Int = JPEG_QUALITY): ByteArray {
        val soft = ensureSoftwareBitmap(bitmap)
        val scaled = transformBitmap(soft, null, maxDim)
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
        if (scaled !== soft && scaled !== bitmap) {
            scaled.recycle()
        }
        if (soft !== bitmap) {
            soft.recycle()
        }
        return out.toByteArray()
    }

    fun bitmapToJpegDataUrl(bitmap: Bitmap): String {
        val bytes = bitmapToJpegBytes(bitmap, MAX_DIMENSION, JPEG_QUALITY)
        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        return "data:image/jpeg;base64,$base64"
    }

    fun fileToJpegBytes(
        file: File,
        maxDim: Int = MAX_DIMENSION,
        quality: Int = JPEG_QUALITY,
    ): ByteArray? {
        if (!file.exists() || file.length() <= 0L) return null
        try {
            val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, boundsOpts)
            if (boundsOpts.outWidth > 0 && boundsOpts.outHeight > 0) {
                var sampleSize = 1
                val longest = max(boundsOpts.outWidth, boundsOpts.outHeight)
                while (longest / sampleSize > maxDim * 2) {
                    sampleSize *= 2
                }
                val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
                val decoded = BitmapFactory.decodeFile(file.absolutePath, decodeOpts)
                if (decoded != null) {
                    val matrix = readExifMatrix(file)
                    val transformed = transformBitmap(decoded, matrix, maxDim)
                    val out = ByteArrayOutputStream()
                    transformed.compress(Bitmap.CompressFormat.JPEG, quality, out)
                    if (transformed !== decoded) {
                        transformed.recycle()
                    }
                    decoded.recycle()
                    out.toByteArray().takeIf { it.isNotEmpty() }?.let { return it }
                }
            }
        } catch (_: Throwable) {
            // 降级尝试 ImageDecoder
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                val source = ImageDecoder.createSource(file)
                val decoded = decodeImageSource(source, maxDim)
                if (decoded != null) {
                    val out = ByteArrayOutputStream()
                    decoded.compress(Bitmap.CompressFormat.JPEG, quality, out)
                    decoded.recycle()
                    out.toByteArray().takeIf { it.isNotEmpty() }?.let { return it }
                }
            } catch (_: Throwable) {
                // ignore
            }
        }
        return null
    }

    fun uriToJpegBytes(
        context: Context,
        uri: Uri,
        maxDim: Int = MAX_DIMENSION,
        quality: Int = JPEG_QUALITY,
    ): ByteArray? {
        val mime = try {
            context.contentResolver.getType(uri)?.lowercase().orEmpty()
        } catch (_: Throwable) {
            ""
        }
        val preferModernDecoder = mime.contains("dng") ||
            mime.contains("raw") ||
            mime.contains("heic") ||
            mime.contains("heif") ||
            mime.contains("avif")

        if (!preferModernDecoder) {
            decodeUriWithBitmapFactory(context, uri, maxDim, quality)?.let { return it }
        }

        // 针对 DNG/RAW/HEIC 或 BitmapFactory 无法解码的格式，走系统 ImageDecoder（自动处理 EXIF 方向）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                val source = ImageDecoder.createSource(context.contentResolver, uri)
                val decoded = decodeImageSource(source, maxDim)
                if (decoded != null) {
                    val out = ByteArrayOutputStream()
                    decoded.compress(Bitmap.CompressFormat.JPEG, quality, out)
                    decoded.recycle()
                    out.toByteArray().takeIf { it.isNotEmpty() }?.let { return it }
                }
            } catch (_: Throwable) {
                // 继续尝试内嵌预览兜底
            }
        }

        if (preferModernDecoder) {
            decodeUriWithBitmapFactory(context, uri, maxDim, quality)?.let { return it }
        }

        // 厂商私有 RAW 格式兜底：优先取系统高分辨率内嵌预览或 EXIF 缩略图流
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                val preview = context.contentResolver.loadThumbnail(uri, Size(maxDim, maxDim), null)
                val soft = ensureSoftwareBitmap(preview)
                val scaled = transformBitmap(soft, null, maxDim)
                val out = ByteArrayOutputStream()
                scaled.compress(Bitmap.CompressFormat.JPEG, quality, out)
                if (scaled !== soft && scaled !== preview) scaled.recycle()
                if (soft !== preview) soft.recycle()
                preview.recycle()
                out.toByteArray().takeIf { it.isNotEmpty() }?.let { return it }
            } catch (_: Throwable) {
                // 继续尝试 EXIF 内嵌缩略图
            }
        }

        return try {
            val exifThumb = context.contentResolver.openInputStream(uri)?.use { stream ->
                val exif = ExifInterface(stream)
                val thumb = exif.thumbnailBitmap ?: return@use null
                val matrix = orientationToMatrix(
                    exif.getAttributeInt(
                        ExifInterface.TAG_ORIENTATION,
                        ExifInterface.ORIENTATION_NORMAL,
                    ),
                )
                val transformed = transformBitmap(thumb, matrix, maxDim)
                if (transformed !== thumb) thumb.recycle()
                transformed
            } ?: return null
            val out = ByteArrayOutputStream()
            exifThumb.compress(Bitmap.CompressFormat.JPEG, quality, out)
            exifThumb.recycle()
            out.toByteArray().takeIf { it.isNotEmpty() }
        } catch (_: Throwable) {
            null
        }
    }

    private fun decodeUriWithBitmapFactory(
        context: Context,
        uri: Uri,
        maxDim: Int,
        quality: Int,
    ): ByteArray? {
        return try {
            val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, boundsOpts)
            }
            if (boundsOpts.outWidth <= 0 || boundsOpts.outHeight <= 0) return null

            var sampleSize = 1
            val longest = max(boundsOpts.outWidth, boundsOpts.outHeight)
            while (longest / sampleSize > maxDim * 2) {
                sampleSize *= 2
            }
            val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val decoded = context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, decodeOpts)
            } ?: return null

            val matrix = readExifMatrix(context, uri)
            val transformed = transformBitmap(decoded, matrix, maxDim)
            val out = ByteArrayOutputStream()
            transformed.compress(Bitmap.CompressFormat.JPEG, quality, out)
            if (transformed !== decoded) {
                transformed.recycle()
            }
            decoded.recycle()
            out.toByteArray().takeIf { it.isNotEmpty() }
        } catch (_: Throwable) {
            null
        }
    }

    private fun decodeImageSource(source: ImageDecoder.Source, maxDim: Int): Bitmap? {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P) return null
        return ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            decoder.isMutableRequired = false
            val w = info.size.width
            val h = info.size.height
            val longest = max(w, h)
            if (longest > maxDim && w > 0 && h > 0) {
                val scale = maxDim.toFloat() / longest.toFloat()
                val targetW = (w * scale).roundToInt().coerceAtLeast(1)
                val targetH = (h * scale).roundToInt().coerceAtLeast(1)
                decoder.setTargetSize(targetW, targetH)
            }
        }
    }

    private fun ensureSoftwareBitmap(bitmap: Bitmap): Bitmap {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && bitmap.config == Bitmap.Config.HARDWARE) {
            return bitmap.copy(Bitmap.Config.ARGB_8888, false) ?: bitmap
        }
        return bitmap
    }

    fun uriToJpegDataUrl(context: Context, uri: Uri, maxDim: Int = MAX_DIMENSION): String? {
        val bytes = uriToJpegBytes(context, uri, maxDim, JPEG_QUALITY) ?: return null
        val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
        return "data:image/jpeg;base64,$base64"
    }

    private fun readExifMatrix(context: Context, uri: Uri): Matrix? {
        return try {
            context.contentResolver.openInputStream(uri)?.use { stream ->
                orientationToMatrix(
                    ExifInterface(stream).getAttributeInt(
                        ExifInterface.TAG_ORIENTATION,
                        ExifInterface.ORIENTATION_NORMAL,
                    ),
                )
            }
        } catch (_: Throwable) {
            null
        }
    }

    private fun readExifMatrix(file: File): Matrix? {
        return try {
            orientationToMatrix(
                ExifInterface(file.absolutePath).getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL,
                ),
            )
        } catch (_: Throwable) {
            null
        }
    }

    private fun orientationToMatrix(orientation: Int): Matrix? {
        val m = Matrix()
        when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> m.postRotate(90f)
            ExifInterface.ORIENTATION_ROTATE_180 -> m.postRotate(180f)
            ExifInterface.ORIENTATION_ROTATE_270 -> m.postRotate(270f)
            ExifInterface.ORIENTATION_FLIP_HORIZONTAL -> m.preScale(-1f, 1f)
            ExifInterface.ORIENTATION_FLIP_VERTICAL -> m.preScale(1f, -1f)
            ExifInterface.ORIENTATION_TRANSPOSE -> {
                m.postRotate(90f)
                m.preScale(-1f, 1f)
            }
            ExifInterface.ORIENTATION_TRANSVERSE -> {
                m.postRotate(270f)
                m.preScale(-1f, 1f)
            }
            else -> return null
        }
        return m
    }

    private fun transformBitmap(source: Bitmap, rotateMatrix: Matrix?, maxDim: Int): Bitmap {
        val w = source.width
        val h = source.height
        if (w <= 0 || h <= 0) return source
        val longest = max(w, h)
        val scale = if (longest > maxDim) maxDim.toFloat() / longest.toFloat() else 1f
        if (rotateMatrix == null && scale >= 1f) {
            return source
        }
        val finalMatrix = Matrix()
        if (scale < 1f) {
            val safeScale = scale.coerceAtLeast(1f / longest.toFloat())
            finalMatrix.postScale(safeScale, safeScale)
        }
        if (rotateMatrix != null) {
            finalMatrix.postConcat(rotateMatrix)
        }
        return try {
            val out = Bitmap.createBitmap(source, 0, 0, w, h, finalMatrix, true)
            if (out.width <= 0 || out.height <= 0) {
                val targetW = (w * scale).roundToInt().coerceAtLeast(1)
                val targetH = (h * scale).roundToInt().coerceAtLeast(1)
                Bitmap.createScaledBitmap(source, targetW, targetH, true)
            } else {
                out
            }
        } catch (_: Throwable) {
            source
        }
    }
}
