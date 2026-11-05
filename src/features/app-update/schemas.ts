import * as z from 'zod'

/*
 * 检查更新（download/README.md）。版本清单 download/manifest.json + 更新日志 download/CHANGELOG.md
 * 随部署发到自己的服务器；GET /api/v1/app/update 比较后告诉前端怎么更新。
 */

const VersionText = z.string().regex(/^\d+\.\d+\.\d+$/, { error: '版本号格式是 主.次.修订' })

export const AppManifestSchema = z.object({
  latest: VersionText,
  publishedAt: z.iso.date(),
  android: z.object({
    /** 当前安装包（网页壳）的版本，即壳 UA 里 DayDayOnApp/<版本> */
    version: VersionText,
    /** 低于它的壳必须更新 */
    minVersion: VersionText,
    file: z.string().regex(/^[A-Za-z0-9._-]+\.apk$/),
    sha256: z.string().regex(/^[0-9a-f]{64}$/),
    size: z.number().int().positive(),
    /** 打包制品时从哪个 GitHub Release 取安装包 */
    sourceTag: z.string().regex(/^v\d+\.\d+\.\d+$/),
  }),
})
export type AppManifest = z.infer<typeof AppManifestSchema>

export const AppUpdateQuerySchema = z.object({
  /** 页面当前构建的版本（APP_VERSION） */
  web: VersionText,
  /** 跑在 APK 壳里时，壳 UA 里的版本；浏览器 / PWA 不传 */
  shell: VersionText.optional(),
})

/**
 * none：已是最新；reload：服务器上的网页更新了，刷新即可；install：要装新的安装包。
 */
export const AppUpdateKindSchema = z.enum(['none', 'reload', 'install'])
export type AppUpdateKind = z.infer<typeof AppUpdateKindSchema>

export const AppUpdateSchema = z
  .object({
    kind: AppUpdateKindSchema,
    /** 服务器上的最新网页版本 */
    latest: z.string(),
    publishedAt: z.string(),
    /** install 时为 true：当前壳低于最低版本，不能「稍后」 */
    required: z.boolean(),
    /** 比当前版本新的几节更新日志（Markdown）；没有更新为空串 */
    notes: z.string(),
    android: z.object({
      version: z.string(),
      /** 自己服务器上的地址（主） */
      url: z.string(),
      /** GitHub Release 备用地址 */
      fallbackUrl: z.string(),
      sha256: z.string(),
      size: z.number().int(),
    }),
  })
  .meta({ id: 'AppUpdate' })
export type AppUpdate = z.infer<typeof AppUpdateSchema>
