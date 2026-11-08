/*
 * App 下载地址（ADR-0022）。APK 由 GitHub Actions 打包后发到 GitHub Release，
 * 每次发版的安装包文件名固定为 DayDayOn.apk，版本号只写在 tag 和更新说明里，
 * 这样 releases/latest/download/DayDayOn.apk 永远指向最新版，落地页不用跟着改。
 * 主地址是我们自己服务器上的 /download/DayDayOn.apk（download/README.md：部署时按清单放进制品），
 * 国内打开更稳；GitHub Release 的 latest/download 作备用。
 */

/** 第一个 APK Release 发布后改为 true：落地页才显示下载按钮（在那之前链接会 404） */
export const APK_AVAILABLE = true
export const APK_VERSION = 'v0.1.4'

export const GITHUB_REPO_URL = 'https://github.com/AIMFllyYS/DayDayOn'
export const APK_FILE_NAME = 'DayDayOn.apk'
/** 主地址：自己的服务器（同域，相对路径） */
export const APK_DOWNLOAD_URL = `/download/${APK_FILE_NAME}`
/** 备用：GitHub Release 最新版附件 */
export const APK_GITHUB_DOWNLOAD_URL = `${GITHUB_REPO_URL}/releases/latest/download/${APK_FILE_NAME}`
export const RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`
/** 全部版本列表：还没有任何 Release 时也能打开 */
export const RELEASES_PAGE_URL = `${GITHUB_REPO_URL}/releases`
export const SITE_HOST = 'daydayon.husteread.com'
