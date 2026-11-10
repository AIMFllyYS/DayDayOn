'use client'

import { useSyncExternalStore } from 'react'
import { Badge, IconTile } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { LinkButton } from '@/features/dashboard/components/link-button'
import { currentPlatform, type ClientPlatform } from '@/lib/native'
import { APK_AVAILABLE, APK_DOWNLOAD_URL, APK_FILE_NAME, APK_VERSION, SITE_HOST } from '../download'
import { WelcomeSection } from './welcome-section'

const noop = () => () => {}

/** 平台只在浏览器里判断；服务端渲染时为 null，两种安装方式都显示 */
function usePlatform(): ClientPlatform | null {
  return useSyncExternalStore(noop, currentPlatform, () => null)
}

/**
 * 装到手机上（ADR-0022）：
 * - 安卓直接从自有服务器 `/download/DayDayOn.apk` 高速下载，iPhone 三步添加到主屏幕；
 * - 已经在 APK 壳或已安装的 PWA 里打开时，保留 `#download` 锚点并展示当前已安装状态，避免页头「下载 App」锚点失效。
 */
export function WelcomeDownload() {
  const platform = usePlatform()
  const isInstalledShell = platform === 'native' || platform === 'standalone'
  const showAndroid = !isInstalledShell && platform !== 'ios'
  const showIos = !isInstalledShell && platform !== 'android'

  return (
    <WelcomeSection
      id="download"
      ann="welcome.download"
      eyebrow="装到手机上"
      title={isInstalledShell ? '你已安装手机客户端' : '像 App 一样，点开就能打卡'}
      description={
        isInstalledShell
          ? '当前正在客户端内运行，后续有新版本可在「我的 → 账号 → 检查更新」直接在线升级。'
          : platform === 'desktop'
            ? `用手机浏览器打开 ${SITE_HOST}，或直接下载 Android 安装包。`
            : '装好以后从桌面打开，没有地址栏，打开就是你的主页。'
      }
    >
      {isInstalledShell ? (
        <div className="bg-surface shadow-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <IconTile icon="check" tone="exercise" />
            <div>
              <p className="font-semibold">DayDayOn 客户端已就绪</p>
              <p className="text-tiny text-muted">
                支持原生 0ms 开屏、高清相机、流式相册与应用内自动更新
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="exercise">{APK_VERSION}</Badge>
            <LinkButton href="/me" variant="soft" size="sm" icon="sparkles">
              去我的页面检查更新
            </LinkButton>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 @2xl:grid-cols-2">
          {showAndroid && (
            <div className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <IconTile icon="download" tone="exercise" />
                  <div>
                    <p className="font-semibold">安卓手机（Android APK）</p>
                    <p className="text-tiny text-muted">
                      自有服务器直连下载 {APK_FILE_NAME}，支持原生开屏、高清拍照与应用内更新
                    </p>
                  </div>
                </div>
                <Badge tone="exercise">{APK_VERSION}</Badge>
              </div>
              {APK_AVAILABLE ? (
                <div className="flex flex-wrap items-center gap-2">
                  <LinkButton href={APK_DOWNLOAD_URL} icon="download">
                    下载 Android 版 ({APK_FILE_NAME})
                  </LinkButton>
                </div>
              ) : (
                <p className="bg-surface-sunken text-caption text-muted rounded-xl px-3 py-2">
                  安装包正在准备，先用「添加到主屏幕」也一样好用
                </p>
              )}
            </div>
          )}
          {showIos && (
            <div className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <IconTile icon="home" tone="study" />
                <div>
                  <p className="font-semibold">iPhone</p>
                  <p className="text-tiny text-muted">用 Safari 打开，三步装到桌面</p>
                </div>
              </div>
              <ol className="text-caption grid gap-1.5">
                {['点底部的「分享」按钮', '往下找到「添加到主屏幕」', '点右上角「添加」'].map(
                  (s, i) => (
                    <li key={s} className="flex items-center gap-2">
                      <span className="bg-study-soft text-study-ink font-display text-tiny flex size-6 shrink-0 items-center justify-center rounded-full font-bold">
                        {i + 1}
                      </span>
                      {s}
                    </li>
                  ),
                )}
              </ol>
            </div>
          )}
        </div>
      )}
      <p className="text-tiny text-muted mt-3 flex items-center gap-1.5">
        <Icon name="globe" size={14} />
        电脑上直接用浏览器打开 {SITE_HOST} 就行，手机和电脑数据同步。
      </p>
    </WelcomeSection>
  )
}
