# DayDayOn Android 原生混合客户端 (`android/`)

本项目采用 **Web (Next.js PWA) + Kotlin 原生能力桥 (`window.DayDayOnNative`)** 的混合架构：
- UI 与日常打卡交互由 Web 层渲染，部署后即时静默更新；
- 硬件传感器、高清相机、流式缩略图相册与系统级权限由 Kotlin 原生模块承载，并通过 `src/lib/native.ts` 单一封装层对业务暴露。

## 原生模块清单

| 模块 | Kotlin 实现文件 | 职责 |
|---|---|---|
| 主容器与原生 0ms 开屏 | `MainActivity.kt` | 承载 `WebView`（追加 `DayDayOnApp/0.1.9` UA）与 0ms 原生开屏覆盖层 `nativeSplashOverlay`，拦截同源 `/__native__/media/...` 流式返回二进制图片，支持多选系统文件选择器 |
| 应用内自更新与安装闭环 | `ApkUpdater.kt`、`CameraTempFileProvider.kt` | 后台线程池流式下载新版本 APK（同步推送应用内实时进度与系统通知栏进度），校验 SHA-256，自动检测并引导开启 `REQUEST_INSTALL_PACKAGES` 未知来源安装权限后拉起系统安装器 |
| 权限管理 | `MainActivity.kt` | 统一查询与请求相机、相册（含 Android 14+ 部分照片授权）、计步、通知、应用安装权限，准确识别永久拒绝并引导跳转系统应用设置 |
| 高清原生相机与缩略图缓存 | `NativeCameraHelper.kt`、`CameraTempFileProvider.kt` | 通过临时 ContentProvider 接收系统相机高清原图、自动读取 EXIF 摆正竖拍方向并在内存压缩后立即删除临时文件；兼容 RAW/DNG/HEIC 解码；提供系统 `loadThumbnail` + 8MB `LruCache` 毫秒级缩略图流 |
| 高性能分页相册与文件夹桥 | `MediaAlbumBridge.kt` | 严格按真实拍摄/保存时间最新在前归一化排序，提供设备相册/文件夹稳定列表（首项固定「全部」）与按相册分页查询（`offset` + `limit` + `bucketId` + `hasMore`），支撑前端 `PhotoAlbumSheet` 无限下滑与顺序多选 |
| 硬件计步器 | `StepCounterManager.kt` | 独立传感器线程监听 `Sensor.TYPE_STEP_COUNTER`（含 `TYPE_STEP_DETECTOR` 兜底与跨天/重启结转），无传感器或未授权时安全返回 `0` |
| 本地定时提醒 | `LocalReminderScheduler.kt` | 通过 `AlarmManager` 精确唤醒与单色矢量图标通知渠道，在「手机提醒」模式下每日定时推送打卡通知并支持一键测试通知 |

## 构建命令

```powershell
powershell -ExecutionPolicy Bypass -File android/build-apk.ps1
```
