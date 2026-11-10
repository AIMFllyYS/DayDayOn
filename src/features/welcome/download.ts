/*
 * App 下载地址（ADR-0022、download/README.md）：
 * - 统一指向自有服务器 `/download/DayDayOn.apk`（生产环境由武汉 ECS Nginx 从独立持久化目录 `/www/wwwroot/daydayon/releases/apk/` 高速直出，支持 HTTP Range 断点续传）；
 * - 移除面向用户的 GitHub Release 外链，避免国内网络访问超时或失败。
 */

export const APK_AVAILABLE = true
export const APK_VERSION = 'v0.1.6'

export const GITHUB_REPO_URL = 'https://github.com/AIMFllyYS/DayDayOn'
export const APK_FILE_NAME = 'DayDayOn.apk'
/** 自有服务器高速直连下载地址（同域相对路径） */
export const APK_DOWNLOAD_URL = `/download/${APK_FILE_NAME}`
export const SITE_HOST = 'daydayon.husteread.com'
