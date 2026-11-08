package com.husteread.daydayon

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
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
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ProgressBar
import org.json.JSONObject

/**
 * DayDayOn 安卓客户端主 Activity（Kotlin 混合架构，v0.1.3 / Issue #57）：
 * - 在 WebView User-Agent 末尾追加 `DayDayOnApp/0.1.3`；
 * - 注入 `window.DayDayOnNative` (@JavascriptInterface)，提供：
 *   1. 权限管理：getPermissionsJson / requestPermission / openAppSettings
 *   2. 原生高分辨率相机：captureHighResPhoto
 *   3. 微信风多选相册数据桥：getAlbumPhotosJson / readAlbumPhotoDataUrl
 *   4. 硬件计步器读取：getTodaySteps（无传感器或未授权安全返回 0）
 *   5. 手机端本地定时闹钟提醒：scheduleDailyReminder
 *   6. 兼容 v0.1.0 桥接方法：notify / openUrl / printPage / saveBase64Download
 */
class MainActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var progressBar: ProgressBar
    private lateinit var errorPanel: LinearLayout
    private lateinit var retryButton: Button
    private lateinit var stepCounterManager: StepCounterManager

    private var pendingFileChooser: ValueCallback<Array<Uri>>? = null
    private var pendingPermName: String? = null
    private var mainFrameLoadFailed = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

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
        settings.userAgentString = "${settings.userAgentString} DayDayOnApp/0.1.3"

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

            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?,
            ): Boolean {
                val uri = request?.url ?: return false
                val host = uri.host ?: return false
                if (host.endsWith("daydayon.husteread.com") || host == "localhost") {
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
                    val intent = fileChooserParams?.createIntent()
                        ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                            addCategory(Intent.CATEGORY_OPENABLE)
                            type = "*/*"
                        }
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
            val results = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            callback.onReceiveValue(results)
            return
        }

        if (requestCode == REQ_NATIVE_CAMERA) {
            if (resultCode != RESULT_OK) {
                dispatchCameraResult(null, null)
                return
            }
            val dataUri = data?.data
            val dataUrl = if (dataUri != null) {
                NativeCameraHelper.uriToJpegDataUrl(this, dataUri, 1920)
            } else {
                @Suppress("DEPRECATION")
                val bmp = data?.extras?.get("data") as? Bitmap
                if (bmp != null) NativeCameraHelper.bitmapToJpegDataUrl(bmp) else null
            }
            val fileName = "camera_${System.currentTimeMillis()}.jpg"
            dispatchCameraResult(dataUrl, fileName)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED
        val state = if (granted) "granted" else "denied"

        if (requestCode == REQ_CAMERA_FOR_CAPTURE) {
            if (granted) {
                launchSystemCamera()
            } else {
                dispatchCameraResult(null, null)
            }
            return
        }

        if (requestCode == REQ_RUNTIME_PERMISSION) {
            val permName = pendingPermName ?: "camera"
            pendingPermName = null
            if (permName == "steps" && granted) {
                stepCounterManager.startListening()
            }
            runOnUiThread {
                webView.evaluateJavascript(
                    "window.__ddoOnPermissionResult && window.__ddoOnPermissionResult('$permName', '$state');",
                    null,
                )
            }
        }
    }

    private fun checkMappedPermission(name: String): String {
        val androidPerm = mapToAndroidPermission(name) ?: return "granted"
        val granted = checkSelfPermission(androidPerm) == PackageManager.PERMISSION_GRANTED
        return if (granted) "granted" else "prompt"
    }

    private fun mapToAndroidPermission(name: String): String? {
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

    private fun launchSystemCamera() {
        try {
            val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            startActivityForResult(intent, REQ_NATIVE_CAMERA)
        } catch (_: Throwable) {
            dispatchCameraResult(null, null)
        }
    }

    private fun dispatchCameraResult(dataUrl: String?, fileName: String?) {
        runOnUiThread {
            if (dataUrl == null) {
                webView.evaluateJavascript(
                    "window.__ddoOnCameraResult && window.__ddoOnCameraResult(null);",
                    null,
                )
            } else {
                val safeName = (fileName ?: "camera.jpg").replace("'", "")
                webView.evaluateJavascript(
                    "window.__ddoOnCameraResult && window.__ddoOnCameraResult('$dataUrl', '$safeName');",
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
                put("steps", checkMappedPermission("steps"))
                put("notifications", checkMappedPermission("notifications"))
            }
            return obj.toString()
        }

        @JavascriptInterface
        fun requestPermission(permission: String): String {
            val androidPerm = mapToAndroidPermission(permission) ?: return "granted"
            if (checkSelfPermission(androidPerm) == PackageManager.PERMISSION_GRANTED) {
                return "granted"
            }
            pendingPermName = permission
            runOnUiThread {
                requestPermissions(arrayOf(androidPerm), REQ_RUNTIME_PERMISSION)
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
                    requestPermissions(arrayOf(Manifest.permission.CAMERA), REQ_CAMERA_FOR_CAPTURE)
                }
            }
        }

        @JavascriptInterface
        fun getAlbumPhotosJson(limit: Int): String {
            return CustomGalleryActivity.getAlbumPhotosJson(this@MainActivity, limit)
        }

        @JavascriptInterface
        fun readAlbumPhotoDataUrl(photoId: String): String {
            return CustomGalleryActivity.readPhotoByIdDataUrl(this@MainActivity, photoId)
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
        private const val REQ_RUNTIME_PERMISSION = 1002
        private const val REQ_CAMERA_FOR_CAPTURE = 1003
        private const val REQ_NATIVE_CAMERA = 1004
    }
}
