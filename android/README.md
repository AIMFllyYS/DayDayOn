# DayDayOn Android 原生混合客户端 (`android/`)

本项目采用 **Web (Next.js PWA) + Kotlin 原生能力桥 (`window.DayDayOnNative`)** 的混合架构：
- UI 与日常打卡交互由 Web 层渲染，部署后即时静默更新；
- 硬件传感器与系统级权限由 Kotlin 原生模块承载，并通过 `src/lib/native.ts` 单一封装层对业务暴露。

## 原生模块清单

| 模块 | Kotlin 实现文件 | 职责 |
|---|---|---|
| 主容器与 JSBridge | `MainActivity.kt` | 承载 `WebView`（追加 `DayDayOnApp/0.1.3` UA），注入 `DayDayOnNative` 桥接对象 |
| 权限管理 | `MainActivity.kt` | 统一查询与请求相机、相册、计步、通知 4 项运行时权限，支持跳转系统应用设置 |
| 高清原生相机 | `NativeCameraHelper.kt` | 先真实申请 `CAMERA` 权限，再调起系统原生相机拍摄高清图并在内存压缩为 JPEG DataURL（不落盘） |
| 微信式多选相册 | `CustomGalleryActivity.kt` | 默认支持最多 9 张顺序多选（右上角 `1..9` 序号角标、右上角「取消选择」一键清空）与 MediaStore 缩略图桥接 |
| 硬件计步器 | `StepCounterManager.kt` | 监听 `Sensor.TYPE_STEP_COUNTER` 计算当日步数；无传感器或未授权时安全返回 `0` |
| 本地定时提醒 | `LocalReminderScheduler.kt` | 通过 `AlarmManager` + `BroadcastReceiver` 在「手机提醒（手机端原生组件）」模式下每日定时推送打卡通知 |

## 构建命令

```powershell
powershell -ExecutionPolicy Bypass -File android/build-apk.ps1
```
