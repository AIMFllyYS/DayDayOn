package com.husteread.daydayon

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ClipData
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Message
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.provider.Settings
import android.view.View
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * DayDayOn 安卓客户端主 Activity（Kotlin 混合架构，v0.1.6）：
 * - 在 WebView User-Agent 末尾追加 `DayDayOnApp/0.1.6`；
 * - 通过 `shouldInterceptRequest` 拦截同源虚拟路径 `/__native__/media/...`，在后台 IO 线程池流式返回系统硬件缩略图与高清内存字节流；
 * - 注入 `window.DayDayOnNative` (@JavascriptInterface)，提供：
 *   1. 权限管理：getPermissionsJson / requestPermission / reselectPhotos / openAppSettings（完整兼容 Android 14+ 部分照片授权与永久拒绝检测）
 *   2. 原生高分辨率相机：captureHighResPhoto（CameraTempFileProvider + EXIF 自动摆正 + 读完即删）
 *   3. 流式分页相册数据桥：getAlbumPhotosPageJson / getAlbumPhotosJson / readAlbumPhotoDataUrl
 *   4. 硬件计步器读取：getTodaySteps（无传感器或未授权安全返回 0）
 *   5. 手机端本地定时闹钟提醒：scheduleDailyReminder
 *   6. WebView 原生文件管理多选增强（EXTRA_ALLOW_MULTIPLE + clipData 多选解析，供 Agent 传图/传文档使用）
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorPanel: LinearLayout
    private lateinit var retryButton: Button
    private lateinit var stepCounterManager: StepCounterManager
    private lateinit var permPrefs: SharedPreferences

    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null
    private var pendingCameraFile: File? = null
    private val pendingPermRequests = ConcurrentHashMap<Int, String>()
    private var nextPermReqCode = REQ_RUNTIME_PERM_BASE
    private val ephemeralCameraBlobs = ConcurrentHashMap<String, ByteArray>()
    private var mainFrameLoadFailed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        CameraTempFileProvider.cleanupStaleFiles(this)
        permPrefs = getSharedPreferences("daydayon_perms", MODE_PRIVATE)

        stepCounterManager = StepCounterManager(this)
        stepCounterManager.startListening()

        webView = findViewById(R.id.webView)
        progressBar = findViewById(R.id.progressBar)
        errorPanel = findViewById(R.id.errorPanel)
        retryButton = findViewById(R.id.retryButton)

        retryButton.setOnClickListener {
            errorPanel.visibility = View.GONE
            webView.reload()
        }

        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.userAgentString = "${settings.userAgentString} DayDayOnApp/0.1.6"

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }

        webView.addJavascriptInterface(DayDayOnAndroidBridge(), "DayDayOnNative")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                mainFrameLoadFailed = false
                progressBar.visibility = View.VISIBLE
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                if (!mainFrameLoadFailed) {
                    errorPanel.visibility = View.GONE
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request != null && request.isForMainFrame) {
                    mainFrameLoadFailed = true
                    errorPanel.visibility = View.VISIBLE
                }
            }

            override fun shouldInterceptRequest(
                view: WebView?,
                request: WebResourceRequest?,
            ): WebResourceResponse? {
                val uri = request?.url ?: return null
                val host = uri.host ?: return null
                if (!isTrustedHost(host)) return null
                val path = uri.path ?: return null
                if (!path.startsWith("/__native__/media/")) return null

                val bytes: ByteArray? = when {
                    path.startsWith("/__native__/media/thumb/") -> {
                        val id = path.removePrefix("/__native__/media/thumb/").toLongOrNull()
                        if (id != null) {
                            NativeCameraHelper.loadThumbnailJpegBytes(this@MainActivity, id, 240)
                        } else {
                            null
                        }
                    }
                    path.startsWith("/__native__/media/full/") -> {
                        val id = path.removePrefix("/__native__/media/full/").toLongOrNull()
                        if (id != null) {
                            MediaAlbumBridge.readPhotoJpegBytes(this@MainActivity, id, 1920)
                        } else {
                            null
                        }
                    }
                    path.startsWith("/__native__/media/camera/") -> {
                        val token = path.removePrefix("/__native__/media/camera/")
                        ephemeralCameraBlobs.remove(token)
                    }
                    else -> null
                }

                if (bytes == null || bytes.isEmpty()) {
                    return WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        404,
                        "Not Found",
                        mapOf("Cache-Control" to "no-store"),
                        ByteArrayInputStream(ByteArray(0)),
                    )
                }

                return WebResourceResponse(
                    "image/jpeg",
                    null,
                    200,
                    "OK",
                    mapOf(
                        "Cache-Control" to "private, max-age=300",
                        "X-Content-Type-Options" to "nosniff",
                    ),
                    ByteArrayInputStream(bytes),
                )
            }

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val uri = request?.url ?: return false
                val host = uri.host ?: return false
                if (isTrustedHost(host)) {
                    return false
                }
                return try {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (_: Throwable) {
                    false
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                progressBar.progress = newProgress
                progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                pendingFileChooser?.onReceiveValue(null)
                pendingFileChooser = filePathCallback
                return try {
                    val intent = buildEnhancedFileChooserIntent(fileChooserParams)
                    startActivityForResult(intent, REQ_FILE_CHOOSER)
                    true
                } catch (_: Throwable) {
                    pendingFileChooser = null
                    false
                }
            }

            override fun onCreateWindow(
                view: WebView?,
                isDialog: Boolean,
                isUserGesture: Boolean,
                resultMsg: Message?,
            ): Boolean = false
        }

        webView.setDownloadListener(
            DownloadListener { url, _, _, _, _ ->
                if (!url.isNullOrBlank()) {
                    try {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                    } catch (_: Throwable) {
                        // ignore
                    }
                }
            },
        )

        webView.loadUrl(getString(R.string.daydayon_url))
    }

    override fun onResume() {
        super.onResume()
        stepCounterManager.startListening()
    }

    override fun onDestroy() {
        stepCounterManager.stopListening()
        CameraTempFileProvider.cleanupStaleFiles(this)
        ephemeralCameraBlobs.clear()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == REQ_FILE_CHOOSER) {
            val callback = pendingFileChooser
            pendingFileChooser = null
            if (callback == null) return
            callback.onReceiveValue(parseMultiFileChooserResult(resultCode, data))
            return
        }

        if (requestCode == REQ_NATIVE_CAMERA) {
            val tempFile = pendingCameraFile
            pendingCameraFile = null
            try {
                if (resultCode != RESULT_OK) {
                    dispatchCameraResult(null, null)
                    return
                }
                val jpegBytes: ByteArray? = when {
                    tempFile != null && tempFile.exists() && tempFile.length() > 0L ->
                        NativeCameraHelper.fileToJpegBytes(tempFile, 1920)
                    data?.data != null ->
                        NativeCameraHelper.uriToJpegBytes(this, data.data!!, 1920)
                    else -> {
                        @Suppress("DEPRECATION")
                        val bmp = data?.extras?.get("data") as? Bitmap
                        bmp?.let { NativeCameraHelper.bitmapToJpegBytes(it, 1920) }
                    }
                }
                if (jpegBytes == null || jpegBytes.isEmpty()) {
                    dispatchCameraResult(null, null)
                    return
                }
                if (ephemeralCameraBlobs.size >= 4) {
                    ephemeralCameraBlobs.clear()
                }
                val token = UUID.randomUUID().toString()
                ephemeralCameraBlobs[token] = jpegBytes
                val fileName = "camera_${System.currentTimeMillis()}.jpg"
                dispatchCameraResult("/__native__/media/camera/$token", fileName)
            } finally {
                try {
                    tempFile?.delete()
                } catch (_: Throwable) {
                    // ignore
                }
            }
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == REQ_CAMERA_FOR_CAPTURE) {
            val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED
            if (granted) {
                launchSystemCamera()
            } else {
                dispatchCameraResult(null, null)
            }
            return
        }

        val permName = pendingPermRequests.remove(requestCode) ?: return
        val finalState = checkMappedPermission(permName)
        if (permName == "steps" && finalState == "granted") {
            stepCounterManager.startListening()
        }
        if (permName == "photos") {
            NativeCameraHelper.clearThumbnailCache()
        }
        runOnUiThread {
            webView.evaluateJavascript(
                "window.__ddoOnPermissionResult && window.__ddoOnPermissionResult('$permName', '$finalState');",
                null,
            )
        }
    }

    private fun isTrustedHost(host: String): Boolean {
        return host.endsWith("daydayon.husteread.com") || host == "localhost" || host == "127.0.0.1"
    }

    private fun buildEnhancedFileChooserIntent(
        params: WebChromeClient.FileChooserParams?,
    ): Intent {
        val allowMultiple =
            params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
        val rawAccepts = params?.acceptTypes
            ?.flatMap { it.split(",") }
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?: emptyList()

        val resolvedMimes = rawAccepts.mapNotNull { token ->
            if (token.contains("/")) {
                token
            } else {
                val ext = token.removePrefix(".").lowercase()
                when (ext) {
                    "md", "markdown" -> "text/markdown"
                    "txt" -> "text/plain"
                    "csv" -> "text/csv"
                    "htm", "html" -> "text/html"
                    else -> MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
                }
            }
        }.distinct()

        return Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            if (allowMultiple) {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            when {
                resolvedMimes.isEmpty() -> type = "*/*"
                resolvedMimes.size == 1 -> type = resolvedMimes[0]
                else -> {
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, resolvedMimes.toTypedArray())
                }
            }
        }
    }

    private fun parseMultiFileChooserResult(resultCode: Int, data: Intent?): Array<Uri>? {
        if (resultCode != RESULT_OK || data == null) return null
        val clip = data.clipData
        if (clip != null && clip.itemCount > 0) {
            val uris = mutableListOf<Uri>()
            for (i in 0 until clip.itemCount) {
                clip.getItemAt(i)?.uri?.let { uris.add(it) }
            }
            if (uris.isNotEmpty()) return uris.toTypedArray()
        }
        data.data?.let { return arrayOf(it) }
        return WebChromeClient.FileChooserParams.parseResult(resultCode, data)
    }

    private fun isPhotoAccessGranted(): Boolean {
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> {
                checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) ==
                    PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED) ==
                    PackageManager.PERMISSION_GRANTED
            }
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> {
                checkSelfPermission(Manifest.permission.READ_MEDIA_IMAGES) ==
                    PackageManager.PERMISSION_GRANTED
            }
            else -> {
                checkSelfPermission(Manifest.permission.READ_EXTERNAL_STORAGE) ==
                    PackageManager.PERMISSION_GRANTED
            }
        }
    }

    private fun checkMappedPermission(name: String): String {
        if (name == "photos") {
            if (isPhotoAccessGranted()) return "granted"
            val primaryPerm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Manifest.permission.READ_MEDIA_IMAGES
            } else {
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
            val everAsked = permPrefs.getBoolean("requested_photos", false)
            return if (everAsked && !shouldShowRequestPermissionRationale(primaryPerm)) {
                "denied"
            } else {
                "prompt"
            }
        }

        if (name == "notifications") {
            val nm = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
            val systemEnabled = nm?.areNotificationsEnabled() ?: true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                val granted = checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                    PackageManager.PERMISSION_GRANTED
                if (granted && systemEnabled) return "granted"
                val everAsked = permPrefs.getBoolean("requested_notifications", false)
                if (!systemEnabled && everAsked) return "denied"
                return if (everAsked && !shouldShowRequestPermissionRationale(Manifest.permission.POST_NOTIFICATIONS)) {
                    "denied"
                } else {
                    "prompt"
                }
            }
            return if (systemEnabled) "granted" else "denied"
        }

        val androidPerm = mapPrimaryAndroidPermission(name) ?: return "granted"
        if (checkSelfPermission(androidPerm) == PackageManager.PERMISSION_GRANTED) {
            return "granted"
        }
        val everAsked = permPrefs.getBoolean("requested_$name", false)
        return if (everAsked && !shouldShowRequestPermissionRationale(androidPerm)) {
            "denied"
        } else {
            "prompt"
        }
    }

    private fun mapPrimaryAndroidPermission(name: String): String? {
        return when (name) {
            "camera" -> Manifest.permission.CAMERA
            "photos" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Manifest.permission.READ_MEDIA_IMAGES
            } else {
                Manifest.permission.READ_EXTERNAL_STORAGE
            }
            "steps" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                Manifest.permission.ACTIVITY_RECOGNITION
            } else {
                null
            }
            "notifications" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                Manifest.permission.POST_NOTIFICATIONS
            } else {
                null
            }
            else -> null
        }
    }

    private fun permissionsArrayForRequest(name: String): Array<String>? {
        if (name == "photos") {
            return when {
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE -> arrayOf(
                    Manifest.permission.READ_MEDIA_IMAGES,
                    Manifest.permission.READ_MEDIA_VISUAL_USER_SELECTED,
                )
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU -> arrayOf(
                    Manifest.permission.READ_MEDIA_IMAGES,
                )
                else -> arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
            }
        }
        val single = mapPrimaryAndroidPermission(name) ?: return null
        return arrayOf(single)
    }

    @Synchronized
    private fun allocatePermRequestCode(permName: String): Int {
        val code = nextPermReqCode
        nextPermReqCode = if (nextPermReqCode >= REQ_RUNTIME_PERM_MAX) {
            REQ_RUNTIME_PERM_BASE
        } else {
            nextPermReqCode + 1
        }
        pendingPermRequests[code] = permName
        return code
    }

    private fun launchSystemCamera() {
        try {
            val shotFile = CameraTempFileProvider.createTempShotFile(this)
            val shotUri = CameraTempFileProvider.uriForFile(shotFile)
            pendingCameraFile = shotFile
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                putExtra(MediaStore.EXTRA_OUTPUT, shotUri)
                clipData = ClipData.newRawUri("", shotUri)
                addFlags(
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION or
                        Intent.FLAG_GRANT_READ_URI_PERMISSION,
                )
            }
            startActivityForResult(intent, REQ_NATIVE_CAMERA)
        } catch (_: Throwable) {
            pendingCameraFile?.delete()
            pendingCameraFile = null
            dispatchCameraResult(null, null)
        }
    }

    private fun dispatchCameraResult(mediaUrlOrDataUrl: String?, fileName: String?) {
        runOnUiThread {
            if (mediaUrlOrDataUrl == null) {
                webView.evaluateJavascript(
                    "window.__ddoOnCameraResult && window.__ddoOnCameraResult(null);",
                    null,
                )
            } else {
                val safeUrl = mediaUrlOrDataUrl.replace("'", "")
                val safeName = (fileName ?: "camera.jpg").replace("'", "")
                webView.evaluateJavascript(
                    "window.__ddoOnCameraResult && window.__ddoOnCameraResult('$safeUrl', '$safeName');",
                    null,
                )
            }
        }
    }

    inner class DayDayOnAndroidBridge {

        @JavascriptInterface
        fun getPermissionsJson(): String {
            val obj = JSONObject().apply {
                put("camera", checkMappedPermission("camera"))
                put("photos", checkMappedPermission("photos"))
                put("photosPartial", MediaAlbumBridge.isPartialPhotoAccess(this@MainActivity))
                put("steps", checkMappedPermission("steps"))
                put("notifications", checkMappedPermission("notifications"))
            }
            return obj.toString()
        }

        @JavascriptInterface
        fun requestPermission(permission: String): String {
            val current = checkMappedPermission(permission)
            if (current == "granted") return "granted"
            val perms = permissionsArrayForRequest(permission) ?: return current
            permPrefs.edit().putBoolean("requested_$permission", true).apply()
            val reqCode = allocatePermRequestCode(permission)
            runOnUiThread {
                requestPermissions(perms, reqCode)
            }
            return "prompt"
        }

        /** Android 14+「仅允许访问选定的照片」模式下，允许用户重新弹出系统照片选择器增选照片 */
        @JavascriptInterface
        fun reselectPhotos(): String {
            val perms = permissionsArrayForRequest("photos") ?: return "granted"
            permPrefs.edit().putBoolean("requested_photos", true).apply()
            val reqCode = allocatePermRequestCode("photos")
            runOnUiThread {
                requestPermissions(perms, reqCode)
            }
            return "prompt"
        }

        @JavascriptInterface
        fun openAppSettings() {
            runOnUiThread {
                try {
                    val intent = Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", packageName, null),
                    ).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(intent)
                } catch (_: Throwable) {
                    // ignore
                }
            }
        }

        @JavascriptInterface
        fun captureHighResPhoto() {
            runOnUiThread {
                if (checkSelfPermission(Manifest.permission.CAMERA) ==
                    PackageManager.PERMISSION_GRANTED
                ) {
                    launchSystemCamera()
                } else {
                    permPrefs.edit().putBoolean("requested_camera", true).apply()
                    requestPermissions(arrayOf(Manifest.permission.CAMERA), REQ_CAMERA_FOR_CAPTURE)
                }
            }
        }

        @JavascriptInterface
        fun getAlbumPhotosPageJson(offset: Int, limit: Int): String {
            return MediaAlbumBridge.getAlbumPhotosPageJson(this@MainActivity, offset, limit)
        }

        @JavascriptInterface
        fun getAlbumPhotosJson(limit: Int): String {
            return MediaAlbumBridge.getAlbumPhotosJson(this@MainActivity, limit)
        }

        @JavascriptInterface
        fun readAlbumPhotoDataUrl(photoId: String): String {
            return MediaAlbumBridge.readPhotoByIdDataUrl(this@MainActivity, photoId)
        }

        @JavascriptInterface
        fun getTodaySteps(): Int {
            return stepCounterManager.getTodaySteps()
        }

        @JavascriptInterface
        fun scheduleDailyReminder(remindAt: String, enabled: Boolean): Boolean {
            return LocalReminderScheduler.scheduleDailyReminder(this@MainActivity, remindAt, enabled)
        }

        @JavascriptInterface
        fun notify(title: String, body: String) {
            runOnUiThread {
                val manager = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
                    ?: return@runOnUiThread
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val channel = NotificationChannel(
                        LocalReminderScheduler.CHANNEL_ID,
                        "每日打卡提醒",
                        NotificationManager.IMPORTANCE_DEFAULT,
                    )
                    manager.createNotificationChannel(channel)
                }
                val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    android.app.Notification.Builder(this@MainActivity, LocalReminderScheduler.CHANNEL_ID)
                } else {
                    @Suppress("DEPRECATION")
                    android.app.Notification.Builder(this@MainActivity)
                }
                val notification = builder
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title)
                    .setContentText(body)
                    .setAutoCancel(true)
                    .build()
                manager.notify(23330, notification)
            }
        }

        @JavascriptInterface
        fun openUrl(url: String, _token: String) {
            runOnUiThread {
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                } catch (_: Throwable) {
                    // ignore
                }
            }
        }

        @JavascriptInterface
        fun printPage(_token: String) {
            runOnUiThread {
                val printManager = getSystemService(PRINT_SERVICE) as? PrintManager ?: return@runOnUiThread
                val adapter = webView.createPrintDocumentAdapter("DayDayOn")
                printManager.print("DayDayOn", adapter, PrintAttributes.Builder().build())
            }
        }
    }

    companion object {
        private const val REQ_FILE_CHOOSER = 1001
        private const val REQ_CAMERA_FOR_CAPTURE = 1003
        private const val REQ_NATIVE_CAMERA = 1004
        private const val REQ_RUNTIME_PERM_BASE = 2000
        private const val REQ_RUNTIME_PERM_MAX = 2999
    }
}
