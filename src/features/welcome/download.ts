/*
 * App 下载地址（ADR-0022）。APK 由 GitHub Actions 打包后发到 GitHub Release，
 * 每次发版的安装包文件名固定为 DayDayOn.apk，版本号只写在 tag 和更新说明里，
 * 这样 releases/latest/download/DayDayOn.apk 永远指向最新版，落地页不用跟着改。
 * 国内镜像（ECS 上的 /download/DayDayOn.apk）还没开，开好后在这里加一个主地址，GitHub 作备用。
 */

/** 第一个 APK Release 发布后改为 true：落地页才显示下载按钮（在那之前链接会 404） */
export const APK_AVAILABLE = false

export const GITHUB_REPO_URL = 'https://github.com/AIMFllyYS/DayDayOn'
export const APK_FILE_NAME = 'DayDayOn.apk'
export const APK_DOWNLOAD_URL = `${GITHUB_REPO_URL}/releases/latest/download/${APK_FILE_NAME}`
export const RELEASES_URL = `${GITHUB_REPO_URL}/releases/latest`
/** 全部版本列表：还没有任何 Release 时也能打开 */
export const RELEASES_PAGE_URL = `${GITHUB_REPO_URL}/releases`
export const SITE_HOST = 'daydayon.husteread.com'
