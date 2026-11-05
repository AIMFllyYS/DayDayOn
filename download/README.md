# download/：版本清单、更新日志与安装包

「检查更新」和 App 下载的唯一来源。随部署制品一起发到我们自己的服务器（`scripts/build/pack-artifact.sh`），
不依赖国内访问时好时坏的 GitHub；GitHub Release 只作备用下载地址。

| 文件 | 作用 | 进 Git |
|---|---|---|
| `manifest.json` | 最新版本号、安卓壳版本与安装包信息（文件名、sha256、字节数、取包的 Release tag） | 是 |
| `CHANGELOG.md` | 面向用户的更新日志，检查更新弹窗按版本截取渲染 | 是 |
| `apk/DayDayOn.apk` | 安装包。打包制品时按 `android.sourceTag` 从 GitHub Release 下载并核对 sha256 | 否（`.gitignore`） |

## 版本规则

- 版本号遵循 [SemVer 2.0.0](https://semver.org/lang/zh-CN/)；`manifest.latest` 必须等于 `package.json` 的 `version` 与 `src/lib/app-version.ts`（单测守住）。
- 更新日志格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)：每个版本一节、最新在上、写给用户看的话，不写提交号。
- 清单字段参考 electron-updater 的 `latest.yml` / Sparkle appcast：版本 + 文件 + 校验值 + 大小 + 发布日期，客户端只比版本号。
- **网页版本**（`latest`）每次发版都升；**安卓壳版本**（`android.version`）只有重新打包安装包时才升，它就是壳 User-Agent 里 `DayDayOnApp/<版本>` 的那个数。
  网页壳阶段两者分开记：网页更新后装了 App 的用户只会被提示「刷新」，不会被要求重装同一个安装包。
- `android.minVersion`：低于它的壳必须更新（对应 Android 应用内更新的「立即更新」）；平时等于当前壳版本以下，提示可以「稍后」。

## 发一个新版本

1. 升 `package.json`、`src/lib/app-version.ts`、`manifest.json` 的 `latest` 与 `publishedAt`，在 `CHANGELOG.md` 顶部加一节。
2. 只有换了安装包时：把新包上传到新 Release，更新 `android` 的 `version`、`sha256`、`size`、`sourceTag`。
3. 合并进 `main`，部署流程打包制品时会自动把安装包放进 `download/apk/`，服务器上 `/download/DayDayOn.apk` 随之更新。
4. 发 GitHub Release（`DayDayOn.apk` 作为附件，落地页的备用链接 `releases/latest/download/DayDayOn.apk` 才不会 404）。
