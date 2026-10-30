// PM2 进程定义。安装位置：/www/wwwroot/daydayon/ecosystem.config.cjs（属主 daydayon）
// 运行时环境变量来自同目录的 .env（权限 600），部署版本号来自 app/.commit（由部署闸门写入）。
const fs = require('node:fs')
const path = require('node:path')
const { parseEnv } = require('node:util')

const ROOT = __dirname

function read(file) {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

const fileEnv = parseEnv(read(path.join(ROOT, '.env')))
const commit = read(path.join(ROOT, 'app', '.commit')).trim()

module.exports = {
  apps: [
    {
      name: 'daydayon',
      cwd: path.join(ROOT, 'app'),
      script: 'server.js',
      exec_mode: 'fork',
      instances: 1,
      max_memory_restart: '400M',
      kill_timeout: 10000,
      time: true,
      out_file: path.join(ROOT, 'logs', 'app.out.log'),
      error_file: path.join(ROOT, 'logs', 'app.err.log'),
      env: {
        ...fileEnv,
        NODE_ENV: 'production',
        PORT: '3043',
        HOSTNAME: '127.0.0.1',
        APP_COMMIT_SHA: commit,
      },
    },
  ],
}
