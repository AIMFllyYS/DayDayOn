import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 自托管：构建产物为 .next/standalone，由 PM2 运行 server.js（见 docs/ops/deploy-aliyun-ecs.md）
  output: 'standalone',
  poweredByHeader: false,

  // create-next-app 16.4 的默认值，保持开启（规则见 docs/conventions/nextjs-16-patterns.md）
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,

  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // 拍照打卡需要摄像头；不需要麦克风和定位
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
        ],
      },
    ]
  },
}

export default nextConfig
