/*
 * 当前网页构建的版本号。和 package.json 的 version、download/manifest.json 的 latest 保持一致
 * （app-version.test.ts 守住），发版时三处一起改（download/README.md）。
 * 检查更新时拿它和服务器上的清单比：服务器更新了而这个页面还是旧构建，就提示刷新。
 */
export const APP_VERSION = '0.1.3'
