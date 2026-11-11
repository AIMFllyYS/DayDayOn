package com.husteread.daydayon

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationManager
import android.content.ClipData
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Message
import android.print.PrintAttributes
import android.print.PrintManager
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.provider.Settings
import android.view.View
import android.view.animation.DecelerateInterpolator
import android.webkit.CookieManager
import android.webkit.DownloadListener
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Calendar
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * DayDayOn 安卓客户端主 Activity（Kotlin 混合架构，v0.1.10 / versionCode 7）：
 * - 冷启动 0ms 立即展示原生开屏覆盖层 `nativeSplashOverlay`（含时段问候与品牌微动效），后台并行初始化 WebView 并加载站点，水合完成后硬件加速平滑揭开；
 * - 在 WebView User-Agent 末尾追加 `DayDayOnApp/0.1.10`；
 * - 通过 `shouldInterceptRequest` 拦截同源虚拟路径 `/__native__/media/...`，在后台 IO 线程池流式返回系统硬件缩略图与高清内存字节流（兼容 RAW/DNG/HEIC）；
 * - 注入 `window.DayDayOnNative` (@JavascriptInterface)，提供：
 *   1. 原生开屏收尾：dismissSplash
 *   2. 应用内自更新闭环：startApkUpdate / getApkUpdateStatusJson / installDownloadedApk / canInstallPackages
 *   3. 权限管理：getPermissionsJson / requestPermission / reselectPhotos / openAppSettings（完整兼容 Android 14+ 部分照片授权与未知来源安装权限）
 *   4. 原生高分辨率相机：captureHighResPhoto（CameraTempFileProvider + EXIF 自动摆正 + 读完即删）
 *   5. 流式分页相册与相册目录桥：getAlbumBucketsJson / getAlbumPhotosPageWithBucketJson / getAlbumPhotosPageJson / getAlbumPhotosJson / readAlbumPhotoDataUrl
 *   6. 硬件计步器读取：getTodaySteps（无传感器或未授权安全返回 0）
 *   7. 手机端本地定时闹钟提醒：scheduleDailyReminder
 *   8. WebView 原生文件管理多选增强（EXTRA_ALLOW_MULTIPLE + clipData 多选解析，供 Agent 传图/传文档使用）
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorPanel: LinearLayout
    private lateinit var retryButton: Button
    private lateinit var nativeSplashOverlay: LinearLayout
    private lateinit var splashLogo: ImageView
    private lateinit var splashGreeting: TextView
    private lateinit var stepCounterManager: StepCounterManager
    private lateinit var permPrefs: SharedPreferences
    private val mainHandler = Handler(Looper.getMainLooper())

    private data class EphemeralPickedMedia(val bytes: ByteArray, val mimeType: String)

    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null
    private var pendingCameraFile: File? = null
    private var pendingSystemFileMaxCount = 9
    private val pendingPermRequests = ConcurrentHashMap<Int, String>()
    private var nextPermReqCode = REQ_RUNTIME_PERM_BASE
    private val ephemeralCameraBlobs = ConcurrentHashMap<String, ByteArray>()
    private val ephemeralPickedBlobs = ConcurrentHashMap<String, EphemeralPickedMedia>()
    private var mainFrameLoadFailed = false
    private var splashDismissed = false
    private var splashCreatedAt = 0L

    private val splashFailsafeRunnable = Runnable {
        dismissNativeSplash()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        nativeSplashOverlay = findViewById(R.id.nativeSplashOverlay)
        splashLogo = findViewById(R.id.splashLogo)
        splashGreeting = findViewById(R.id.splashGreeting)
        setupNativeSplash()

        CameraTempFileProvider.cleanupStaleFiles(this)
        ApkUpdater.attachHost(this)
        permPrefs = getSharedPreferences("daydayon_perms", MODE_PRIVATE)
        LocalReminderScheduler.ensureChannel(this)
        LocalReminderScheduler.rescheduleIfEnabled(this)

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
        settings.userAgentString = "${settings.userAgentString} DayDayOnApp/0.1.10"

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, false)
        }

        webView.addJavascriptInterface(DayDayOnAndroidBridge(), "DayDayOnNative")

        webView.webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                mainFrameLoadFailed = false
                if (splashDismissed) {
                    progressBar.visibility = View.VISIBLE
                }
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                progressBar.visibility = View.GONE
                if (!mainFrameLoadFailed) {
                    errorPanel.visibility = View.GONE
                }
                mainHandler.postDelayed({ dismissNativeSplash() }, 180L)
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?,
            ) {
                if (request != null && request.isForMainFrame) {
                    mainFrameLoadFailed = true
                    errorPanel.visibility = View.VISIBLE
                    dismissNativeSplash()
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

                if (path.startsWith("/__native__/media/picked/")) {
                    val token = path.removePrefix("/__native__/media/picked/")
                    val picked = ephemeralPickedBlobs.remove(token)
                    if (picked == null || picked.bytes.isEmpty()) {
                        return WebResourceResponse(
                            "text/plain",
                            "UTF-8",
                            404,
                            "Not Found",
                            mapOf("Cache-Control" to "no-store"),
                            ByteArrayInputStream(ByteArray(0)),
                        )
                    }
                    val encoding =
                        if (picked.mimeType.startsWith("text/") || picked.mimeType == "application/json") {
                            "UTF-8"
                        } else {
                            null
                        }
                    return WebResourceResponse(
                        picked.mimeType,
                        encoding,
                        200,
                        "OK",
                        mapOf(
                            "Cache-Control" to "no-store",
                            "X-Content-Type-Options" to "nosniff",
                        ),
                        ByteArrayInputStream(picked.bytes),
                    )
                }

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
                if (splashDismissed) {
                    progressBar.visibility = if (newProgress in 1..99) View.VISIBLE else View.GONE
                } else if (newProgress >= 85 && !mainFrameLoadFailed) {
                    mainHandler.postDelayed({ dismissNativeSplash() }, 120L)
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?,
            ): Boolean {
                pendingFileChooser?.onReceiveValue(null)
                pendingFileChooser = filePathCallback
                return try {
                    val primaryIntent = buildEnhancedFileChooserIntent(
                        fileChooserParams,
                        Intent.ACTION_OPEN_DOCUMENT,
                    )
                    startActivityForResult(primaryIntent, REQ_FILE_CHOOSER)
                    true
                } catch (_: Throwable) {
                    try {
                        val fallbackIntent = buildEnhancedFileChooserIntent(
                            fileChooserParams,
                            Intent.ACTION_GET_CONTENT,
                        )
                        startActivityForResult(fallbackIntent, REQ_FILE_CHOOSER)
                        true
                    } catch (_: Throwable) {
                        pendingFileChooser = null
                        false
                    }
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
            DownloadListener { url, _, _, mimeType, _ ->
                if (!url.isNullOrBlank()) {
                    val isApk = url.endsWith(".apk", ignoreCase = true) ||
                        url.contains("/download/DayDayOn.apk") ||
                        mimeType == "application/vnd.android.package-archive"
                    if (isApk) {
                        ApkUpdater.startUpdate(this@MainActivity, url, "", "")
                    } else {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        } catch (_: Throwable) {
                            // ignore
                        }
                    }
                }
            },
        )

        webView.loadUrl(getString(R.string.daydayon_url))
        handleLaunchIntent(intent)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
            handleLaunchIntent(intent)
        }
    }

    private fun handleLaunchIntent(intent: Intent?) {
        if (intent?.getBooleanExtra("auto_install_apk", false) == true) {
            intent.removeExtra("auto_install_apk")
            ApkUpdater.installDownloadedApk(this)
        }
    }

    private fun setupNativeSplash() {
        splashCreatedAt = System.currentTimeMillis()
        val hour = Calendar.getInstance().get(Calendar.HOUR_OF_DAY)
        splashGreeting.text = when {
            hour < 5 || hour >= 22 -> "这么晚还在呀，早点休息"
            hour < 11 -> "早安，今天也一起加油"
            else -> "欢迎回来，今天也一起加油"
        }

        splashLogo.scaleX = 0.88f
        splashLogo.scaleY = 0.88f
        splashLogo.alpha = 0f
        splashLogo.animate()
            .scaleX(1f)
            .scaleY(1f)
            .alpha(1f)
            .setDuration(280L)
            .setInterpolator(DecelerateInterpolator())
            .start()

        nativeSplashOverlay.setOnClickListener {
            if (System.currentTimeMillis() - splashCreatedAt >= 350L) {
                dismissNativeSplash()
            }
        }

        mainHandler.postDelayed(splashFailsafeRunnable, 3200L)
    }

    fun dismissNativeSplash() {
        if (splashDismissed) return
        val elapsed = System.currentTimeMillis() - splashCreatedAt
        if (elapsed < 320L && !mainFrameLoadFailed) {
            mainHandler.postDelayed({ dismissNativeSplash() }, 320L - elapsed)
            return
        }
        splashDismissed = true
        mainHandler.removeCallbacks(splashFailsafeRunnable)
        nativeSplashOverlay.isClickable = false
        nativeSplashOverlay.isFocusable = false
        nativeSplashOverlay.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        nativeSplashOverlay.animate()
            .alpha(0f)
            .scaleX(1.03f)
            .scaleY(1.03f)
            .setDuration(220L)
            .setInterpolator(DecelerateInterpolator())
            .withEndAction {
                nativeSplashOverlay.setLayerType(View.LAYER_TYPE_NONE, null)
                nativeSplashOverlay.visibility = View.GONE
            }
            .start()
    }

    override fun onResume() {
        super.onResume()
        MediaAlbumBridge.invalidateCache()
        stepCounterManager.startListening()
        ApkUpdater.onHostResume(this)
    }

    override fun onDestroy() {
        mainHandler.removeCallbacksAndMessages(null)
        stepCounterManager.stopListening()
        CameraTempFileProvider.cleanupStaleFiles(this)
        ephemeralCameraBlobs.clear()
        ephemeralPickedBlobs.clear()
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

        if (requestCode == ApkUpdater.REQ_INSTALL_PERMISSION) {
            ApkUpdater.onHostResume(this)
            val state = if (ApkUpdater.canInstallPackages(this)) "granted" else "denied"
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.__ddoOnPermissionResult && window.__ddoOnPermissionResult('install', '$state');",
                    null,
                )
            }
            return
        }

        if (requestCode == REQ_FILE_CHOOSER) {
            val callback = pendingFileChooser
            pendingFileChooser = null
            if (callback == null) return
            callback.onReceiveValue(parseMultiFileChooserResult(resultCode, data))
            return
        }

        if (requestCode == REQ_NATIVE_SYSTEM_FILES) {
            val uris = parseMultiFileChooserResult(resultCode, data)
            if (uris == null || uris.isEmpty()) {
                dispatchSystemFilesResult("[]")
                return
            }
            val maxToRead = pendingSystemFileMaxCount.coerceIn(1, 9)
            val pickedUris = uris.take(maxToRead)
            Thread {
                val arr = JSONArray()
                try {
                    if (ephemeralPickedBlobs.size >= 24) {
                        ephemeralPickedBlobs.clear()
                    }
                    for ((idx, uri) in pickedUris.withIndex()) {
                        val itemObj = readPickedUriIntoMemory(uri, idx) ?: continue
                        arr.put(itemObj)
                    }
                } catch (_: Throwable) {
                    // ignore batch failure and return collected items
                }
                dispatchSystemFilesResult(arr.toString())
            }.start()
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
        if (permName == "notifications" && finalState == "granted") {
            LocalReminderScheduler.rescheduleIfEnabled(this)
        }
        if (permName == "photos") {
            MediaAlbumBridge.invalidateCache()
            NativeCameraHelper.clearThumbnailCache()
        }
        runOnUiThread {
            webView.evaluateJavascript(
                "window.__ddoOnPermissionResult && window.__ddoOnPermissionResult('$permName', '$finalState');",
                null,
            )
        }
    }

    fun dispatchUpdateProgressToWeb(statusJson: String) {
        runOnUiThread {
            val escaped = JSONObject.quote(statusJson)
            webView.evaluateJavascript(
                "window.__ddoOnUpdateProgress && window.__ddoOnUpdateProgress(JSON.parse($escaped));",
                null,
            )
        }
    }

    fun openAppSettingsInternal() {
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

    fun openNotificationSettingsInternal() {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).apply {
                    putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            } else {
                Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", packageName, null),
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            }
            startActivity(intent)
        } catch (_: Throwable) {
            openAppSettingsInternal()
        }
    }

    private fun isTrustedHost(host: String): Boolean {
        return host.endsWith("daydayon.husteread.com") || host == "localhost" || host == "127.0.0.1"
    }

    private fun isImageOnlyAccept(rawAccepts: List<String>): Boolean {
        if (rawAccepts.isEmpty()) return false
        return rawAccepts.all { token ->
            val lower = token.lowercase()
            if (lower.startsWith("image/")) {
                true
            } else {
                val ext = lower.removePrefix(".")
                ext in IMAGE_EXTENSIONS
            }
        }
    }

    private fun buildSystemPickerIntent(
        acceptTokens: List<String>,
        allowMultiple: Boolean,
        action: String = Intent.ACTION_OPEN_DOCUMENT,
    ): Intent {
        val imageOnly = isImageOnlyAccept(acceptTokens)
        return Intent(action).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            if (allowMultiple) {
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            // 包含非图片附件时固定使用 */* 且不设窄白名单 EXTRA_MIME_TYPES，防止国产 ROM DocumentsUI 将 .md/.csv/.txt/.dng 置灰无法点击
            type = if (imageOnly) "image/*" else "*/*"
        }
    }

    private fun buildEnhancedFileChooserIntent(
        params: WebChromeClient.FileChooserParams?,
        action: String = Intent.ACTION_OPEN_DOCUMENT,
    ): Intent {
        val allowMultiple =
            params?.mode == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE
        val rawAccepts = params?.acceptTypes
            ?.flatMap { it.split(",") }
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?: emptyList()
        return buildSystemPickerIntent(rawAccepts, allowMultiple, action)
    }

    private fun resolvePickedDisplayName(uri: Uri, index: Int): String {
        try {
            contentResolver.query(
                uri,
                arrayOf(OpenableColumns.DISPLAY_NAME),
                null,
                null,
                null,
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val colIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                    if (colIdx >= 0) {
                        val name = cursor.getString(colIdx)?.trim()
                        if (!name.isNullOrEmpty()) return name
                    }
                }
            }
        } catch (_: Throwable) {
            // fallback below
        }
        val fallback = uri.lastPathSegment
            ?.substringAfterLast('/')
            ?.substringAfterLast(':')
            ?.trim()
        return if (!fallback.isNullOrEmpty()) fallback else "attachment_${index + 1}"
    }

    private fun sniffHeaderBytes(uri: Uri, maxLen: Int = 16): ByteArray {
        return try {
            contentResolver.openInputStream(uri)?.use { input ->
                val buf = ByteArray(maxLen)
                var total = 0
                while (total < maxLen) {
                    val n = input.read(buf, total, maxLen - total)
                    if (n <= 0) break
                    total += n
                }
                if (total == maxLen) buf else buf.copyOf(total)
            } ?: ByteArray(0)
        } catch (_: Throwable) {
            ByteArray(0)
        }
    }

    private fun hasImageHeaderMagic(b: ByteArray): Boolean {
        if (b.size < 4) return false
        val b0 = b[0].toInt() and 0xFF
        val b1 = b[1].toInt() and 0xFF
        val b2 = b[2].toInt() and 0xFF
        val b3 = b[3].toInt() and 0xFF
        if (b0 == 0xFF && b1 == 0xD8 && b2 == 0xFF) return true // JPEG
        if (b0 == 0x89 && b1 == 0x50 && b2 == 0x4E && b3 == 0x47) return true // PNG
        if (b0 == 0x47 && b1 == 0x49 && b2 == 0x46 && b3 == 0x38) return true // GIF
        if (b0 == 0x42 && b1 == 0x4D) return true // BMP
        if ((b0 == 0x49 && b1 == 0x49 && b2 == 0x2A && b3 == 0x00) ||
            (b0 == 0x4D && b1 == 0x4D && b2 == 0x00 && b3 == 0x2A)
        ) {
            return true // TIFF / DNG
        }
        if (b.size >= 12) {
            if (b0 == 0x52 && b1 == 0x49 && b2 == 0x46 && b3 == 0x46 &&
                (b[8].toInt() and 0xFF) == 0x57 &&
                (b[9].toInt() and 0xFF) == 0x45 &&
                (b[10].toInt() and 0xFF) == 0x42 &&
                (b[11].toInt() and 0xFF) == 0x50
            ) {
                return true // WebP
            }
            if ((b[4].toInt() and 0xFF) == 0x66 &&
                (b[5].toInt() and 0xFF) == 0x74 &&
                (b[6].toInt() and 0xFF) == 0x79 &&
                (b[7].toInt() and 0xFF) == 0x70
            ) {
                val brand = String(b, 8, 4, Charsets.US_ASCII).lowercase()
                if (brand in ISO_IMAGE_BRANDS) return true
            }
        }
        return false
    }

    private fun readDocumentBytesInMemory(uri: Uri, maxBytes: Int): ByteArray? {
        return try {
            contentResolver.openInputStream(uri)?.use { input ->
                val out = ByteArrayOutputStream()
                val chunk = ByteArray(8192)
                var total = 0
                while (total < maxBytes) {
                    val toRead = minOf(chunk.size, maxBytes - total)
                    val read = input.read(chunk, 0, toRead)
                    if (read <= 0) break
                    out.write(chunk, 0, read)
                    total += read
                }
                val bytes = out.toByteArray()
                if (bytes.isNotEmpty()) bytes else null
            }
        } catch (_: Throwable) {
            null
        }
    }

    private fun readPickedUriIntoMemory(uri: Uri, index: Int): JSONObject? {
        val displayName = resolvePickedDisplayName(uri, index)
        val ext = displayName.substringAfterLast('.', "").lowercase()
        val providerMime = contentResolver.getType(uri)?.trim()?.lowercase() ?: ""
        val header = sniffHeaderBytes(uri, 16)
        val isImage = providerMime.startsWith("image/") ||
            ext in IMAGE_EXTENSIONS ||
            hasImageHeaderMagic(header)

        if (isImage) {
            val jpegBytes = NativeCameraHelper.uriToJpegBytes(this, uri, 1920)
            if (jpegBytes != null && jpegBytes.isNotEmpty()) {
                val token = UUID.randomUUID().toString()
                ephemeralPickedBlobs[token] = EphemeralPickedMedia(jpegBytes, "image/jpeg")
                val baseName = if (ext in IMAGE_EXTENSIONS) {
                    displayName.substringBeforeLast('.')
                } else {
                    displayName
                }
                val safeJpegName = if (baseName.endsWith(".jpg", ignoreCase = true) ||
                    baseName.endsWith(".jpeg", ignoreCase = true)
                ) {
                    baseName
                } else {
                    "${baseName.ifBlank { "photo_${index + 1}" }}.jpg"
                }
                return JSONObject().apply {
                    put("url", "/__native__/media/picked/$token")
                    put("name", safeJpegName)
                    put("mimeType", "image/jpeg")
                }
            }
        }

        val docBytes = readDocumentBytesInMemory(uri, MAX_PICKED_DOC_BYTES) ?: return null
        val resolvedMime = when (ext) {
            "md", "markdown" -> "text/markdown"
            "txt", "log" -> "text/plain"
            "csv" -> "text/csv"
            "tsv" -> "text/tab-separated-values"
            "json" -> "application/json"
            "xml" -> "text/xml"
            "htm", "html" -> "text/html"
            else -> if (providerMime.isNotBlank() && providerMime != "application/octet-stream") {
                providerMime
            } else {
                "text/plain"
            }
        }
        val token = UUID.randomUUID().toString()
        ephemeralPickedBlobs[token] = EphemeralPickedMedia(docBytes, resolvedMime)
        return JSONObject().apply {
            put("url", "/__native__/media/picked/$token")
            put("name", displayName)
            put("mimeType", resolvedMime)
        }
    }

    private fun dispatchSystemFilesResult(jsonArrayStr: String) {
        runOnUiThread {
            val escaped = JSONObject.quote(jsonArrayStr)
            webView.evaluateJavascript(
                "window.__ddoOnSystemFilesResult && window.__ddoOnSystemFilesResult(JSON.parse($escaped));",
                null,
            )
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
        if (name == "install") {
            return if (ApkUpdater.canInstallPackages(this)) "granted" else "prompt"
        }

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
        fun dismissSplash() {
            runOnUiThread {
                dismissNativeSplash()
            }
        }

        @JavascriptInterface
        fun startApkUpdate(url: String, sha256: String, version: String): String {
            return ApkUpdater.startUpdate(this@MainActivity, url, sha256, version)
        }

        @JavascriptInterface
        fun getApkUpdateStatusJson(): String {
            return ApkUpdater.getStatusJson(this@MainActivity)
        }

        @JavascriptInterface
        fun installDownloadedApk(): Boolean {
            return ApkUpdater.installDownloadedApk(this@MainActivity)
        }

        @JavascriptInterface
        fun canInstallPackages(): Boolean {
            return ApkUpdater.canInstallPackages(this@MainActivity)
        }

        @JavascriptInterface
        fun getPermissionsJson(): String {
            val obj = JSONObject().apply {
                put("camera", checkMappedPermission("camera"))
                put("photos", checkMappedPermission("photos"))
                put("photosPartial", MediaAlbumBridge.isPartialPhotoAccess(this@MainActivity))
                put("steps", checkMappedPermission("steps"))
                put("notifications", checkMappedPermission("notifications"))
                put("install", checkMappedPermission("install"))
            }
            return obj.toString()
        }

        @JavascriptInterface
        fun requestPermission(permission: String): String {
            if (permission == "install") {
                if (ApkUpdater.canInstallPackages(this@MainActivity)) return "granted"
                runOnUiThread {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        try {
                            val intent = Intent(
                                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                                Uri.parse("package:$packageName"),
                            )
                            startActivityForResult(intent, ApkUpdater.REQ_INSTALL_PERMISSION)
                        } catch (_: Throwable) {
                            openAppSettingsInternal()
                        }
                    }
                }
                return "prompt"
            }

            val current = checkMappedPermission(permission)
            if (current == "granted") return "granted"
            if (permission == "notifications") {
                val nm = getSystemService(NOTIFICATION_SERVICE) as? NotificationManager
                val systemEnabled = nm?.areNotificationsEnabled() ?: true
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU && !systemEnabled) {
                    runOnUiThread {
                        openNotificationSettingsInternal()
                    }
                    return "denied"
                }
            }
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
                openAppSettingsInternal()
            }
        }

        @JavascriptInterface
        fun openNotificationSettings() {
            runOnUiThread {
                openNotificationSettingsInternal()
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
        fun pickSystemFiles(accept: String, maxCount: Int) {
            val safeMax = maxCount.coerceIn(1, 9)
            pendingSystemFileMaxCount = safeMax
            val tokens = accept.split(",")
                .map { it.trim() }
                .filter { it.isNotEmpty() }
            runOnUiThread {
                try {
                    val intent = buildSystemPickerIntent(
                        tokens,
                        safeMax > 1,
                        Intent.ACTION_OPEN_DOCUMENT,
                    )
                    startActivityForResult(intent, REQ_NATIVE_SYSTEM_FILES)
                } catch (_: Throwable) {
                    try {
                        val fallback = buildSystemPickerIntent(
                            tokens,
                            safeMax > 1,
                            Intent.ACTION_GET_CONTENT,
                        )
                        startActivityForResult(fallback, REQ_NATIVE_SYSTEM_FILES)
                    } catch (_: Throwable) {
                        dispatchSystemFilesResult("[]")
                    }
                }
            }
        }

        @JavascriptInterface
        fun getAlbumBucketsJson(): String {
            return MediaAlbumBridge.getAlbumBucketsJson(this@MainActivity)
        }

        @JavascriptInterface
        fun getAlbumPhotosPageWithBucketJson(offset: Int, limit: Int, bucketId: String): String {
            return MediaAlbumBridge.getAlbumPhotosPageJson(
                this@MainActivity,
                offset,
                limit,
                bucketId,
            )
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
        fun notify(title: String, body: String): Boolean {
            return LocalReminderScheduler.postReminderNotification(
                context = this@MainActivity,
                title = title,
                body = body,
                notificationId = LocalReminderScheduler.TEST_NOTIFICATION_ID,
            )
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
        private const val REQ_NATIVE_SYSTEM_FILES = 1005
        private const val REQ_RUNTIME_PERM_BASE = 2000
        private const val REQ_RUNTIME_PERM_MAX = 2999
        private const val MAX_PICKED_DOC_BYTES = 512 * 1024
        private val IMAGE_EXTENSIONS = setOf(
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif",
            "bmp",
            "heic",
            "heif",
            "avif",
            "dng",
        )
        private val ISO_IMAGE_BRANDS = setOf(
            "heic",
            "heix",
            "hevc",
            "hevx",
            "heim",
            "heis",
            "mif1",
            "msf1",
            "avif",
            "avis",
        )
    }
}
