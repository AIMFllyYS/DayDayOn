'use client'

import { useSyncExternalStore } from 'react'
import { IconTile } from '@/components/ui/badge'
import { Icon } from '@/components/ui/icon'
import { LinkButton } from '@/features/dashboard/components/link-button'
import { currentPlatform, type ClientPlatform } from '@/lib/native'
import {
  APK_AVAILABLE,
  APK_DOWNLOAD_URL,
  RELEASES_PAGE_URL,
  RELEASES_URL,
  SITE_HOST,
} from '../download'
import { WelcomeSection } from './welcome-section'

const noop = () => () => {}

/** 平台只在浏览器里判断；服务端渲染时为 null，两种安装方式都显示 */
function usePlatform(): ClientPlatform | null {
  return useSyncExternalStore(noop, currentPlatform, () => null)
}

/**
 * 装到手机上（ADR-0022）：安卓下载 APK（GitHub Release），iPhone 添加到主屏幕。
 * 已经在 APK 壳或已安装的 PWA 里打开时整块不显示。
 */
export function WelcomeDownload() {
  const platform = usePlatform()
  if (platform === 'native' || platform === 'standalone') return null
  const showAndroid = platform !== 'ios'
  const showIos = platform !== 'android'

  return (
    <WelcomeSection
      id="download"
      ann="welcome.download"
      eyebrow="装到手机上"
      title="像 App 一样，点开就能打卡"
      description={
        platform === 'desktop'
          ? `用手机浏览器打开 ${SITE_HOST}，按下面的方式装到桌面。`
          : '装好以后从桌面打开，没有地址栏，打开就是你的主页。'
      }
    >
      <div className="grid gap-3 @2xl:grid-cols-2">
        {showAndroid && (
          <div className="bg-surface shadow-card flex flex-col gap-3 rounded-2xl p-5">
            <div className="flex items-center gap-3">
              <IconTile icon="download" tone="exercise" />
              <div>
                <p className="font-semibold">安卓手机</p>
                <p className="text-tiny text-muted">下载安装包，或在浏览器菜单里「添加到主屏幕」</p>
              </div>
            </div>
            {APK_AVAILABLE ? (
              <div className="flex flex-wrap gap-2">
                <LinkButton href={APK_DOWNLOAD_URL} icon="download">
                  下载 Android 版
                </LinkButton>
                <LinkButton href={RELEASES_URL} variant="soft">
                  更新说明
                </LinkButton>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2">
                <p className="bg-surface-sunken text-caption text-muted rounded-xl px-3 py-2">
                  安装包正在准备，先用「添加到主屏幕」也一样好用
                </p>
                <LinkButton href={RELEASES_PAGE_URL} variant="soft" size="sm" icon="link">
                  去 GitHub Release 看看
                </LinkButton>
              </div>
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
      <p className="text-tiny text-muted mt-3 flex items-center gap-1.5">
        <Icon name="globe" size={14} />
        电脑上直接用浏览器打开 {SITE_HOST} 就行，手机和电脑数据同步。
      </p>
    </WelcomeSection>
  )
}
