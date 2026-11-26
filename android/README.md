# DayDayOn Android 原生混合客户端 (`android/`)

本项目采用 **Web (Next.js PWA) + Kotlin 原生能力桥 (`window.DayDayOnNative`)** 的混合架构：
- UI 与日常打卡交互由 Web 层渲染，部署后即时静默更新；
- 硬件传感器、高清相机、流式缩略图相册与系统级权限由 Kotlin 原生模块承载，并通过 `src/lib/native.ts` 单一封装层对业务暴露。

## 原生模块清单

| 模块 | Kotlin 实现文件 | 职责 |
|---|---|---|
| 主容器与原生 0ms 开屏 | `MainActivity.kt` | 承载 `WebView`（追加 `DayDayOnApp/0.1.16` UA）与 0ms 原生开屏覆盖层 `nativeSplashOverlay`；在 `onPageFinished`、`onPause`、`onStop` 显式调用 `CookieManager.getInstance().flush()` 将滑动续期后的登录 Cookie 及时刷盘持久化；拦截同源 `/__native__/media/...` 流式返回二进制图片与所选系统附件（内存直通零落盘），支持多选系统文件选择器 |
| 应用内自更新与安装闭环 | `ApkUpdater.kt`、`CameraTempFileProvider.kt` | 后台线程池流式下载新版本 APK（同步推送应用内实时进度与系统通知栏进度），校验 SHA-256，自动检测并引导开启 `REQUEST_INSTALL_PACKAGES` 未知来源安装权限后拉起系统安装器 |
| 权限管理 | `MainActivity.kt` | 统一查询与请求相机、相册（含 Android 14+ 部分照片授权）、计步、通知、应用安装权限，准确识别永久拒绝并引导跳转系统应用设置 |
| 高清原生相机与缩略图缓存 | `NativeCameraHelper.kt`、`CameraTempFileProvider.kt` | 通过临时 ContentProvider 接收系统相机高清原图、自动读取 EXIF 摆正竖拍方向并在内存压缩后立即删除临时文件；兼容 RAW/DNG/HEIC 解码；提供系统 `loadThumbnail` + 8MB `LruCache` 毫秒级缩略图流 |
| 高性能分页相册与文件夹桥 | `MediaAlbumBridge.kt` | 严格按真实拍摄/保存时间最新在前归一化排序，提供设备相册/文件夹稳定列表（首项固定「全部」）与按相册分页查询（`offset` + `limit` + `bucketId` + `hasMore`），支撑前端 `PhotoAlbumSheet` 无限下滑与顺序多选 |
| 原生海报分享与保存 | `NativeImageShareHelper.kt` | 接收前端渲染的打卡分享海报 PNG（base64 数据流），支持一键保存到系统相册（`MediaStore`）、写入系统剪贴板图片或拉起系统原生分享面板（微信/QQ/好友） |
| 硬件计步器 | `StepCounterManager.kt` | 独立传感器线程监听 `Sensor.TYPE_STEP_COUNTER`（含 `TYPE_STEP_DETECTOR` 兜底与跨天/重启结转），无传感器或未授权时安全返回 `0` |
| 本地定时提醒 | `LocalReminderScheduler.kt` | 通过 `AlarmManager` 精确唤醒与单色矢量图标通知渠道，在「手机提醒」模式下每日定时推送打卡通知并支持一键测试通知 |

## 构建命令

```powershell
powershell -ExecutionPolicy Bypass -File android/build-apk.ps1
```

脚本使用持久化密钥库 `android/keystore/daydayon-release.jks`（受 `.gitignore` 保护不进 Git）签名，输出 `download/apk/DayDayOn.apk` 并在末尾打印 `Size` 与 `SHA256`。

## APK 打包发版闭环

1. **升级壳版本与网站版本**：
   - 更新 `android/app/src/main/AndroidManifest.xml`（`android:versionCode` 递增、`android:versionName`）、`android/app/build.gradle.kts`（`versionCode` 递增、`versionName`）与 `android/app/src/main/kotlin/com/husteread/daydayon/MainActivity.kt` 中追加的 UA（`DayDayOnApp/<version>`）；
   - 同步更新 `package.json`、`src/lib/app-version.ts`、`download/manifest.json`（`latest`、`publishedAt`、`android.version`、`android.sourceTag`）、`download/CHANGELOG.md` 与 `docs/updates/changelog.md`。
2. **离线构建并回填校验信息**：执行上述 `android/build-apk.ps1`，将输出的 `Size` 与 `SHA256` 回填至 `download/manifest.json` 的 `android.size`、`android.sha256`。
3. **双端分发（GitHub Release + 阿里云 ECS）**：
   - **先上传 GitHub Release**：打 tag（匹配 `android.sourceTag`）并上传 `download/apk/DayDayOn.apk` 至 GitHub Release（防止 CI / PR 阶段 `scripts/build/pack-artifact.sh` 因服务器上还是旧包且 GitHub Release 找不到新包而校验失败）；
   - **同步阿里云 ECS（`/www/wwwroot/daydayon/releases/`）**：
     - **方式 A（随 `main` 部署同步）**：合并 `main` 后由 `.github/workflows/deploy.yml` 打包，经 `scripts/deploy/daydayon-deploy-gate.sh` 自动将 `manifest.json`、`CHANGELOG.md`、`apk/DayDayOn.apk` 写入 `/www/wwwroot/daydayon/releases/`；
     - **方式 B（热更新或立即生效，需负责人许可的 `ssh MainECS` 操作）**：直接将 `download/apk/DayDayOn.apk`（及 `manifest.json`、`CHANGELOG.md`）上传至 `/www/wwwroot/daydayon/releases/`（属主 `daydayon`、权限 `0644`），立即生效，无需重启 PM2。
4. **上线后校验**：
   ```bash
   curl -I https://daydayon.husteread.com/download/DayDayOn.apk
   curl -fsS "https://daydayon.husteread.com/api/v1/app/update?web=0.1.0&shell=0.1.0"
   ```
   完整发版说明亦见 [download/README.md](../download/README.md) 与 [deploy-aliyun-ecs.md](../docs/ops/deploy-aliyun-ecs.md)。
