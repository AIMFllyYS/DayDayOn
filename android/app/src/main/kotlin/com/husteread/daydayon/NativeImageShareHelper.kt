package com.husteread.daydayon

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.MediaScannerConnection
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * 打卡报告海报原生导出助手（v0.1.12，零 AndroidX 依赖）：
 * - 保存至系统相册（Pictures/DayDayOn，API 29+ 走 MediaStore 零存储权限，API 26–28 兼容公共 Pictures 目录）；
 * - 复制图片至系统剪贴板（通过 CameraTempFileProvider 暴露临时 PNG URI）；
 * - 拉起安卓系统原生分享面板（ACTION_SEND + ClipData 缩略图预览 + FLAG_GRANT_READ_URI_PERMISSION）。
 */
object NativeImageShareHelper {

    private const val MAX_PNG_BYTES = 12 * 1024 * 1024

    private fun resultJson(ok: Boolean, message: String): String {
        return JSONObject().apply {
            put("ok", ok)
            put("message", message)
        }.toString()
    }

    private fun sanitizeFileName(raw: String): String {
        val cleaned = raw.trim()
            .replace(Regex("[\\\\/:*?\"<>|]"), "_")
            .ifBlank { "DayDayOn-report.png" }
        return if (cleaned.endsWith(".png", ignoreCase = true)) cleaned else "$cleaned.png"
    }

    private fun decodePngDataUrl(dataUrl: String): ByteArray? {
        if (dataUrl.isBlank()) return null
        val commaIdx = dataUrl.indexOf(',')
        val base64Part = if (commaIdx >= 0) dataUrl.substring(commaIdx + 1) else dataUrl
        return try {
            val bytes = Base64.decode(base64Part, Base64.DEFAULT)
            if (bytes.isEmpty() || bytes.size > MAX_PNG_BYTES) null else bytes
        } catch (_: Throwable) {
            null
        }
    }

    private fun pruneOldShareFiles(context: Context) {
        try {
            val dir = CameraTempFileProvider.ensureShareDir(context)
            val files = dir.listFiles()?.sortedByDescending { it.lastModified() } ?: return
            if (files.size > 4) {
                files.drop(4).forEach { f ->
                    try {
                        f.delete()
                    } catch (_: Throwable) {
                        // ignore
                    }
                }
            }
        } catch (_: Throwable) {
            // ignore
        }
    }

    private fun writeShareTempFile(context: Context, bytes: ByteArray, fileName: String): File {
        pruneOldShareFiles(context)
        val target = CameraTempFileProvider.createShareImageFile(context, fileName)
        FileOutputStream(target).use { out ->
            out.write(bytes)
            out.flush()
        }
        return target
    }

    fun savePngToGallery(context: Context, dataUrl: String, fileName: String): String {
        val bytes = decodePngDataUrl(dataUrl) ?: return resultJson(false, "图片数据异常，请重试")
        val safeName = sanitizeFileName(fileName)

        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Images.Media.DISPLAY_NAME, safeName)
                    put(MediaStore.Images.Media.MIME_TYPE, "image/png")
                    put(
                        MediaStore.Images.Media.RELATIVE_PATH,
                        "${Environment.DIRECTORY_PICTURES}/DayDayOn",
                    )
                    put(MediaStore.Images.Media.IS_PENDING, 1)
                }
                val resolver = context.contentResolver
                val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values)
                    ?: return resultJson(false, "无法写入系统相册")
                try {
                    resolver.openOutputStream(uri)?.use { out ->
                        out.write(bytes)
                        out.flush()
                    } ?: return resultJson(false, "无法打开相册输出流")
                    val done = ContentValues().apply {
                        put(MediaStore.Images.Media.IS_PENDING, 0)
                    }
                    resolver.update(uri, done, null, null)
                } catch (e: Throwable) {
                    try {
                        resolver.delete(uri, null, null)
                    } catch (_: Throwable) {
                        // ignore
                    }
                    throw e
                }
                resultJson(true, "已保存到相册「Pictures/DayDayOn」")
            } else {
                @Suppress("DEPRECATION")
                val pictures = Environment.getExternalStoragePublicDirectory(
                    Environment.DIRECTORY_PICTURES,
                )
                val folder = File(pictures, "DayDayOn")
                if (!folder.exists()) folder.mkdirs()
                val outFile = File(folder, "${System.currentTimeMillis()}_$safeName")
                FileOutputStream(outFile).use { out ->
                    out.write(bytes)
                    out.flush()
                }
                MediaScannerConnection.scanFile(
                    context,
                    arrayOf(outFile.absolutePath),
                    arrayOf("image/png"),
                    null,
                )
                resultJson(true, "已保存到相册「DayDayOn」")
            }
        } catch (_: SecurityException) {
            resultJson(false, "缺少存储权限，可在系统设置开启后重试")
        } catch (_: Throwable) {
            resultJson(false, "保存相册失败，请稍后重试")
        }
    }

    fun copyPngToClipboard(context: Context, dataUrl: String, fileName: String): String {
        val bytes = decodePngDataUrl(dataUrl) ?: return resultJson(false, "图片数据异常，请重试")
        return try {
            val file = writeShareTempFile(context, bytes, sanitizeFileName(fileName))
            val uri = CameraTempFileProvider.uriForShareFile(file)
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager
                ?: return resultJson(false, "系统剪贴板不可用")
            val clip = ClipData.newUri(context.contentResolver, "DayDayOn 打卡报告", uri)
            clipboard.setPrimaryClip(clip)
            resultJson(true, "已复制图片到剪贴板")
        } catch (_: Throwable) {
            resultJson(false, "复制图片失败，请尝试保存相册或系统分享")
        }
    }

    fun sharePngViaSystemSheet(
        activity: Activity,
        dataUrl: String,
        fileName: String,
        title: String,
    ): String {
        val bytes = decodePngDataUrl(dataUrl) ?: return resultJson(false, "图片数据异常，请重试")
        return try {
            val file = writeShareTempFile(activity, bytes, sanitizeFileName(fileName))
            val uri = CameraTempFileProvider.uriForShareFile(file)
            val safeTitle = title.trim().ifBlank { "DayDayOn 打卡分析报告" }
            val sendIntent = Intent(Intent.ACTION_SEND).apply {
                type = "image/png"
                putExtra(Intent.EXTRA_STREAM, uri)
                putExtra(Intent.EXTRA_SUBJECT, safeTitle)
                clipData = ClipData.newRawUri(safeTitle, uri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(sendIntent, safeTitle).apply {
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            activity.runOnUiThread {
                try {
                    activity.startActivity(chooser)
                } catch (_: Throwable) {
                    // ignore
                }
            }
            resultJson(true, "已调起系统分享")
        } catch (_: Throwable) {
            resultJson(false, "无法调起系统分享")
        }
    }
}
