# download/：版本清单、更新日志与安装包

「检查更新」和 App 下载的唯一来源。生产环境由武汉 ECS 独立持久化目录 `/www/wwwroot/daydayon/releases/` 承载，
`/download/DayDayOn.apk` 由 Nginx 静态直出（支持 HTTP Range 断点续传），全链路不依赖 GitHub 下载链接。

| 文件 | 作用 | 进 Git |
|---|---|---|
| `manifest.json` | 最新版本号、安卓壳版本与安装包信息（文件名、sha256、字节数、版本 tag） | 是 |
| `CHANGELOG.md` | 面向用户的更新日志，检查更新弹窗按版本截取渲染 | 是 |
| `apk/DayDayOn.apk` | 安装包。本地由 `android/build-apk.ps1` 构建，服务器存放于 `/www/wwwroot/daydayon/releases/apk/DayDayOn.apk` | 否（`.gitignore`） |

## 版本规则

- 版本号遵循 [SemVer 2.0.0](https://semver.org/lang/zh-CN/)；`manifest.latest` 必须等于 `package.json` 的 `version` 与 `src/lib/app-version.ts`（单测守住）。
- 更新日志格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)：每个版本一节、最新在上、写给用户看的话，不写提交号。
- 清单字段参考 electron-updater 的 `latest.yml` / Sparkle appcast：版本 + 文件 + 校验值 + 大小 + 发布日期，客户端只比版本号。
- **网页版本**（`latest`）每次发版都升；**安卓壳版本**（`android.version`）只有重新打包安装包时才升，它就是壳 User-Agent 里 `DayDayOnApp/<版本>` 的那个数。
- `android.minVersion`：低于它的壳必须更新（对应 Android 应用内更新的「立即更新」）；平时等于当前壳版本以下，提示可以「稍后」。

## 发一个新版本（完整闭环）

1. **版本与原生壳准备**
   - 仅网页发版：同步升 `package.json`（`version`）、`src/lib/app-version.ts`（`APP_VERSION`）与 `download/manifest.json` 的 `latest`、`publishedAt`，并在 `download/CHANGELOG.md` 与 `docs/updates/changelog.md` 顶部补充对应版本节。
   - 同步发版新 APK 壳时：同时递增 `android/app/src/main/AndroidManifest.xml`（`android:versionCode`、`android:versionName`）与 `android/app/build.gradle.kts`（`versionCode`、`versionName`），同步更新 `android/app/src/main/kotlin/com/husteread/daydayon/MainActivity.kt` 中追加的 User-Agent（`DayDayOnApp/<version>`）、`src/features/welcome/download.ts`（`APK_VERSION`）以及 `download/manifest.json` 的 `android.version`、`android.sourceTag`。
2. **本地离线构建签名 APK（发新包时）**
   - 运行 `powershell -ExecutionPolicy Bypass -File android/build-apk.ps1`（使用持久化签名 `android/keystore/daydayon-release.jks`，支持覆盖安装），产出 `download/apk/DayDayOn.apk`（受 `.gitignore` 忽略，不入 Git）。
   - 从构建输出的 `Size=<bytes> bytes, SHA256=<sha256>` 获取真实字节数与校验值，回填到 `download/manifest.json` 的 `android.size` 与 `android.sha256`。
3. **双端产物分发（GitHub Release + 阿里云 ECS 服务器同步）**
   - **先上传 GitHub Release**：打 tag（匹配 `android.sourceTag`，如 `v0.1.10`）并将 `download/apk/DayDayOn.apk` 上传至对应 GitHub Release，作为备用下载源与 CI 制品拉取源。
   - **同步阿里云 ECS 服务器**（持久直出目录 `/www/wwwroot/daydayon/releases/`，含 `manifest.json`、`CHANGELOG.md`、`apk/DayDayOn.apk`，由 Nginx `location = /download/DayDayOn.apk` 静态直出并支持 HTTP Range 断点续传）：
     - **方式 A（随 `main` 部署同步）**：合并进 `main` 后，`.github/workflows/deploy.yml` 调用 `scripts/build/pack-artifact.sh`（先尝试从 `https://daydayon.husteread.com/download/DayDayOn.apk` 拉取校验 sha256，不匹配则回退从 GitHub Release `android.sourceTag` 拉取；**因此新包必须先上传 GitHub Release 或先传上服务器**，否则 CI/PR 的 `pack-artifact.sh` 会因 sha256 不匹配失败），再由服务器闸门 `scripts/deploy/daydayon-deploy-gate.sh` 自动将 `manifest.json`、`CHANGELOG.md`、`DayDayOn.apk` 覆盖写入 `/www/wwwroot/daydayon/releases/`（权限 `0644`）。
     - **方式 B（仅热更新 APK / 清单或立即生效，需负责人许可的 `ssh MainECS` 操作）**：直接将 `download/apk/DayDayOn.apk`（及热更新时的 `download/manifest.json`、`download/CHANGELOG.md`）上传到服务器 `/www/wwwroot/daydayon/releases/`（注意属主 `daydayon`、权限 `0644`），`src/server/services/app-update/index.ts` 按文件 `mtimeMs` 自动刷新缓存并即时对 `/download/DayDayOn.apk` 与 `/api/v1/app/update` 生效，无需重启 PM2。
4. **上线后校验**
   ```bash
   curl -I https://daydayon.husteread.com/download/DayDayOn.apk
   curl -fsS "https://daydayon.husteread.com/api/v1/app/update?web=0.1.0&shell=0.1.0"
   ```
