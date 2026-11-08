package com.husteread.daydayon

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import java.io.ByteArrayOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

/**
 * 原生高分辨率相机与图片内存压缩辅助类（严守 ADR-0002）：
 * - 将相机拍摄或相册读取的高清图片在内存中按最大边 1920px 进行缩放并编码为 JPEG DataURL；
 * - 绝不在持久化目录保留用户照片原图。
 */
object NativeCameraHelper {

    private const val MAX_DIMENSION = 1920
    private const val JPEG_QUALITY = 88

    fun bitmapToJpegDataUrl(bitmap: Bitmap): String {
        val scaled = scaleBitmapIfNeeded(bitmap, MAX_DIMENSION)
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
        if (scaled !== bitmap) {
            scaled.recycle()
        }
        val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        return "data:image/jpeg;base64,$base64"
    }

    fun uriToJpegDataUrl(context: Context, uri: Uri, maxDim: Int = MAX_DIMENSION): String? {
        return try {
            val boundsOpts = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, boundsOpts)
            }
            var sampleSize = 1
            val longest = max(boundsOpts.outWidth, boundsOpts.outHeight)
            while (longest / sampleSize > maxDim * 2) {
                sampleSize *= 2
            }
            val decodeOpts = BitmapFactory.Options().apply { inSampleSize = sampleSize }
            val decoded = context.contentResolver.openInputStream(uri)?.use { stream ->
                BitmapFactory.decodeStream(stream, null, decodeOpts)
            } ?: return null

            val scaled = scaleBitmapIfNeeded(decoded, maxDim)
            val out = ByteArrayOutputStream()
            scaled.compress(Bitmap.CompressFormat.JPEG, JPEG_QUALITY, out)
            if (scaled !== decoded) {
                scaled.recycle()
            }
            decoded.recycle()
            val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            "data:image/jpeg;base64,$base64"
        } catch (_: Throwable) {
            null
        }
    }

    private fun scaleBitmapIfNeeded(source: Bitmap, maxDim: Int): Bitmap {
        val w = source.width
        val h = source.height
        val longest = max(w, h)
        if (longest <= maxDim || w <= 0 || h <= 0) return source
        val ratio = maxDim.toFloat() / longest.toFloat()
        val targetW = (w * ratio).roundToInt().coerceAtLeast(1)
        val targetH = (h * ratio).roundToInt().coerceAtLeast(1)
        return Bitmap.createScaledBitmap(source, targetW, targetH, true)
    }
}
