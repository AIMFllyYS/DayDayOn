// 用途：pre-commit 钩子里扫描暂存区是否含密钥（由 lefthook.yml 调用）。
// 本机没有安装 gitleaks 时跳过并提示，CI 会再扫一次完整历史。
// 退出码：0 = 无泄漏或已跳过；非 0 = 发现泄漏或 gitleaks 运行出错。
import { spawnSync } from 'node:child_process'

const probe = spawnSync('gitleaks', ['version'], { stdio: 'ignore', shell: false })

if (probe.error || probe.status !== 0) {
  console.log('gitleaks 未安装，跳过本地密钥扫描（安装：winget install Gitleaks.Gitleaks）')
  process.exit(0)
}

const scan = spawnSync('gitleaks', ['git', '--pre-commit', '--staged', '--redact', '--no-banner'], {
  stdio: 'inherit',
  shell: false,
})

process.exit(scan.status ?? 1)
