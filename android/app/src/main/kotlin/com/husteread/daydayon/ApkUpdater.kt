package com.husteread.daydayon

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import org.json.JSONObject
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.lang.ref.WeakReference
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.Executors

/**
 * DayDayOn 安卓应用内自更新引擎（后台持续下载 + 网页实时进度回调 + SHA-256 校验 + 未知来源权限引导与自动拉起安装）：
 * - 下载在进程内独立后台单线程池执行，即使关闭弹窗或将应用切到后台仍继续下载，并同步刷新系统状态栏进度通知；
 * - 实时通过 `window.__ddoOnUpdateProgress(statusJson)` 向 WebView 推送进度，同时支持同步拉取 `getStatusJson()`；
 * - 下载完成后校验 SHA-256 摘要，随后自动检测 `PackageManager.canRequestPackageInstalls()`：
 *   1. 若尚未授予「安装未知应用」权限，自动跳转系统设置页开启，用户返回应用时在 `onHostResume` 自动续接安装；
 *   2. 若已具备权限，通过 `CameraTempFileProvider` 的 `content://` 安全 URI 直接调起系统 PackageInstaller 完成覆盖安装。
 */
object ApkUpdater {

    const val REQ_INSTALL_PERMISSION = 1008
    private const val UPDATE_CHANNEL_ID = "daydayon_apk_update"
    private const val UPDATE_NOTIFICATION_ID = 23331
    private const val DEFAULT_BASE_URL = "https://daydayon.husteread.com"

    private val executor = Executors.newSingleThreadExecutor { runnable ->
        Thread(runnable, "DayDayOn-ApkUpdater").apply { isDaemon = true }
    }

    @Volatile
    private var hostRef: WeakReference<MainActivity>? = null

    @Volatile
    private var state: String = "idle"

    @Volatile
    private var percent: Int = 0

    @Volatile
    private var downloadedBytes: Long = 0L

    @Volatile
    private var totalBytes: Long = 0L

    @Volatile
    private var targetVersion: String = ""

    @Volatile
    private var targetSha256: String = ""

    @Volatile
    private var errorMsg: String? = null

    @Volatile
    private var pendingInstallAfterPermission: Boolean = false

    fun attachHost(activity: MainActivity) {
        hostRef = WeakReference(activity)
    }

    fun canInstallPackages(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.packageManager.canRequestPackageInstalls()
        } else {
            true
        }
    }

    fun getStatusJson(context: Context): String {
        val obj = JSONObject().apply {
            put("state", state)
            put("percent", percent)
            put("downloadedBytes", downloadedBytes)
            put("totalBytes", totalBytes)
            put("version", targetVersion)
            put("canInstall", canInstallPackages(context))
            if (!errorMsg.isNullOrBlank()) {
                put("error", errorMsg)
            }
        }
        return obj.toString()
    }

    fun startUpdate(
        activity: MainActivity,
        rawUrl: String,
        expectedSha256: String,
        version: String,
    ): String {
        attachHost(activity)
        val appContext = activity.applicationContext
        val normalizedSha = expectedSha256.trim().lowercase()
        val normalizedVer = version.trim().removePrefix("v")

        if (state == "downloading" || state == "verifying") {
            return getStatusJson(appContext)
        }

        val finalApk = CameraTempFileProvider.getApkUpdateFile(appContext, "DayDayOn.apk")
        if (finalApk.exists() && finalApk.length() > 50_000L) {
            val cachedMatch = if (normalizedSha.length == 64) {
                computeSha256(finalApk) == normalizedSha
            } else {
                normalizedVer.isNotEmpty() && normalizedVer == targetVersion && state == "ready"
            }
            if (cachedMatch) {
                val len = finalApk.length()
                targetVersion = normalizedVer
                targetSha256 = normalizedSha
                downloadedBytes = len
                totalBytes = len
                percent = 100
                errorMsg = null
                state = "ready"
                dispatchProgress(appContext)
                activity.runOnUiThread {
                    triggerInstallFlow(activity)
                }
                return getStatusJson(appContext)
            }
        }

        val resolvedUrl = resolveDownloadUrl(rawUrl)
        targetVersion = normalizedVer
        targetSha256 = normalizedSha
        downloadedBytes = 0L
        totalBytes = 0L
        percent = 0
        errorMsg = null
        pendingInstallAfterPermission = false
        state = "downloading"
        dispatchProgress(appContext)
        postProgressNotification(appContext, "正在准备下载 DayDayOn 更新…", 0, true)

        executor.execute {
            runDownloadTask(appContext, resolvedUrl, normalizedSha, normalizedVer)
        }

        return getStatusJson(appContext)
    }

    fun installDownloadedApk(activity: MainActivity): Boolean {
        attachHost(activity)
        val finalApk = CameraTempFileProvider.getApkUpdateFile(activity, "DayDayOn.apk")
        if (!finalApk.exists() || finalApk.length() <= 0L) {
            return false
        }
        activity.runOnUiThread {
            triggerInstallFlow(activity)
        }
        return true
    }

    fun onHostResume(activity: MainActivity) {
        attachHost(activity)
        if (pendingInstallAfterPermission && canInstallPackages(activity)) {
            pendingInstallAfterPermission = false
            val finalApk = CameraTempFileProvider.getApkUpdateFile(activity, "DayDayOn.apk")
            if (finalApk.exists() && finalApk.length() > 0L) {
                state = "ready"
                errorMsg = null
                dispatchProgress(activity)
                launchPackageInstaller(activity, finalApk)
            }
        } else if (state == "permission" && canInstallPackages(activity)) {
            state = "ready"
            dispatchProgress(activity)
        }
    }

    private fun runDownloadTask(
        context: Context,
        downloadUrl: String,
        expectedSha256: String,
        version: String,
    ) {
        val apkDir = CameraTempFileProvider.ensureApkDir(context)
        val partFile = File(apkDir, "DayDayOn.apk.part")
        val finalFile = CameraTempFileProvider.getApkUpdateFile(context, "DayDayOn.apk")
        var conn: HttpURLConnection? = null

        try {
            if (partFile.exists()) {
                partFile.delete()
            }
            val url = URL(downloadUrl)
            conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 15_000
                readTimeout = 30_000
                instanceFollowRedirects = true
                setRequestProperty("Accept-Encoding", "identity")
                setRequestProperty("Cache-Control", "no-cache")
            }
            conn.connect()

            val code = conn.responseCode
            if (code !in 200..299) {
                throw IllegalStateException("服务器响应异常 (HTTP $code)")
            }

            val contentLength = conn.contentLengthLong
            totalBytes = if (contentLength > 0L) contentLength else 0L
            downloadedBytes = 0L
            percent = 0
            dispatchProgress(context)

            var lastEmitTime = 0L
            var lastEmitPercent = -1

            conn.inputStream.use { input ->
                FileOutputStream(partFile).use { output ->
                    val buffer = ByteArray(16 * 1024)
                    while (true) {
                        val read = input.read(buffer)
                        if (read <= 0) break
                        output.write(buffer, 0, read)
                        downloadedBytes += read

                        val nextPercent = if (totalBytes > 0L) {
                            ((downloadedBytes * 100L) / totalBytes).toInt().coerceIn(0, 99)
                        } else {
                            ((downloadedBytes / (10 * 1024L)).toInt()).coerceIn(1, 95)
                        }
                        val now = System.currentTimeMillis()
                        if (nextPercent != lastEmitPercent && (now - lastEmitTime >= 100L || nextPercent - lastEmitPercent >= 2)) {
                            percent = nextPercent
                            lastEmitPercent = nextPercent
                            lastEmitTime = now
                            dispatchProgress(context)
                            val label = if (version.isNotEmpty()) {
                                "正在下载 DayDayOn v$version ($percent%)"
                            } else {
                                "正在下载 DayDayOn 更新 ($percent%)"
                            }
                            postProgressNotification(context, label, percent, false)
                        }
                    }
                    output.flush()
                }
            }

            if (partFile.length() <= 10_000L) {
                throw IllegalStateException("下载的安装包不完整，请重试")
            }

            state = "verifying"
            percent = 99
            dispatchProgress(context)

            if (expectedSha256.length == 64) {
                val actualSha = computeSha256(partFile)
                if (!actualSha.equals(expectedSha256, ignoreCase = true)) {
                    partFile.delete()
                    throw IllegalStateException("安装包完整性校验未通过，请重新下载")
                }
            }

            if (finalFile.exists()) {
                finalFile.delete()
            }
            if (!partFile.renameTo(finalFile)) {
                partFile.copyTo(finalFile, overwrite = true)
                partFile.delete()
            }

            val finalSize = finalFile.length()
            downloadedBytes = finalSize
            totalBytes = finalSize
            percent = 100
            errorMsg = null
            state = "ready"
            dispatchProgress(context)
            postCompletedNotification(context, version)

            val host = hostRef?.get()
            if (host != null && !host.isFinishing && !host.isDestroyed) {
                host.runOnUiThread {
                    triggerInstallFlow(host)
                }
            }
        } catch (t: Throwable) {
            try {
                partFile.delete()
            } catch (_: Throwable) {
                // ignore
            }
            state = "error"
            errorMsg = t.message ?: "下载更新失败，请检查网络后重试"
            dispatchProgress(context)
            postErrorNotification(context, errorMsg!!)
        } finally {
            try {
                conn?.disconnect()
            } catch (_: Throwable) {
                // ignore
            }
        }
    }

    private fun triggerInstallFlow(activity: MainActivity) {
        val apkFile = CameraTempFileProvider.getApkUpdateFile(activity, "DayDayOn.apk")
        if (!apkFile.exists() || apkFile.length() <= 0L) {
            state = "error"
            errorMsg = "未找到已下载的安装包，请重新下载"
            dispatchProgress(activity)
            return
        }

        if (!canInstallPackages(activity)) {
            state = "permission"
            pendingInstallAfterPermission = true
            dispatchProgress(activity)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    val intent = Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:${activity.packageName}"),
                    )
                    activity.startActivityForResult(intent, REQ_INSTALL_PERMISSION)
                } catch (_: Throwable) {
                    activity.openAppSettingsInternal()
                }
            }
            return
        }

        pendingInstallAfterPermission = false
        state = "ready"
        errorMsg = null
        dispatchProgress(activity)
        launchPackageInstaller(activity, apkFile)
    }

    private fun launchPackageInstaller(activity: Activity, apkFile: File) {
        try {
            val apkUri = CameraTempFileProvider.uriForApkFile(apkFile)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(apkUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            activity.startActivity(intent)
        } catch (t: Throwable) {
            state = "error"
            errorMsg = "无法调起系统安装器：${t.message ?: "未知错误"}"
            dispatchProgress(activity)
        }
    }

    private fun resolveDownloadUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
            return trimmed
        }
        val path = if (trimmed.startsWith("/")) trimmed else "/$trimmed"
        return "$DEFAULT_BASE_URL$path"
    }

    private fun computeSha256(file: File): String {
        return try {
            val digest = MessageDigest.getInstance("SHA-256")
            FileInputStream(file).use { fis ->
                val buf = ByteArray(16 * 1024)
                while (true) {
                    val n = fis.read(buf)
                    if (n <= 0) break
                    digest.update(buf, 0, n)
                }
            }
            digest.digest().joinToString("") { b -> "%02x".format(b) }
        } catch (_: Throwable) {
            ""
        }
    }

    private fun dispatchProgress(context: Context) {
        val json = getStatusJson(context)
        val host = hostRef?.get() ?: return
        if (host.isFinishing || host.isDestroyed) return
        host.dispatchUpdateProgressToWeb(json)
    }

    private fun ensureUpdateChannel(context: Context, manager: NotificationManager) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                UPDATE_CHANNEL_ID,
                "应用版本更新",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "显示 DayDayOn 新版本后台下载与安装状态"
            }
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotificationBuilder(context: Context): Notification.Builder {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, UPDATE_CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context)
        }
    }

    private fun postProgressNotification(
        context: Context,
        title: String,
        progress: Int,
        indeterminate: Boolean,
    ) {
        try {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return
            ensureUpdateChannel(context, manager)
            val notification = buildNotificationBuilder(context)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText("支持后台继续下载，完成后将自动调起安装")
                .setProgress(100, progress.coerceIn(0, 100), indeterminate)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .build()
            manager.notify(UPDATE_NOTIFICATION_ID, notification)
        } catch (_: Throwable) {
            // 通知权限未授予时静默忽略，不影响后台下载与网页内进度展示
        }
    }

    private fun postCompletedNotification(context: Context, version: String) {
        try {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return
            ensureUpdateChannel(context, manager)
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                putExtra("auto_install_apk", true)
            }
            val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            } else {
                PendingIntent.FLAG_UPDATE_CURRENT
            }
            val pi = PendingIntent.getActivity(context, 23332, launchIntent, flags)
            val title = if (version.isNotEmpty()) {
                "DayDayOn v$version 下载完成"
            } else {
                "DayDayOn 更新下载完成"
            }
            val notification = buildNotificationBuilder(context)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText("点击立即安装新版本")
                .setContentIntent(pi)
                .setOngoing(false)
                .setAutoCancel(true)
                .build()
            manager.notify(UPDATE_NOTIFICATION_ID, notification)
        } catch (_: Throwable) {
            // ignore
        }
    }

    private fun postErrorNotification(context: Context, message: String) {
        try {
            val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
                ?: return
            ensureUpdateChannel(context, manager)
            val notification = buildNotificationBuilder(context)
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle("DayDayOn 更新未完成")
                .setContentText(message)
                .setOngoing(false)
                .setAutoCancel(true)
                .build()
            manager.notify(UPDATE_NOTIFICATION_ID, notification)
        } catch (_: Throwable) {
            // ignore
        }
    }
}
