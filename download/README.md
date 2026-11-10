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

## 发一个新版本

1. 升 `package.json`、`src/lib/app-version.ts`、`manifest.json` 的 `latest` 与 `publishedAt`，在 `CHANGELOG.md` 顶部加一节。
2. 只有换了安装包时：运行 `powershell -ExecutionPolicy Bypass -File android/build-apk.ps1`（使用持久化签名 `android/keystore/daydayon-release.jks`），更新 `android` 的 `version`、`sha256`、`size`、`sourceTag`，并将新包同步至服务器 `/www/wwwroot/daydayon/releases/apk/DayDayOn.apk` 与 GitHub Release。
3. 合并进 `main`，部署闸门会自动同步 `manifest.json` 与 `CHANGELOG.md` 到 `/www/wwwroot/daydayon/releases/`；平时也可直接替换 `/www/wwwroot/daydayon/releases/` 下的文件即时生效，无需重启 PM2。
