#!/usr/bin/env bash
# DayDayOn 部署闸门。安装位置：/usr/local/sbin/daydayon-deploy-gate（root:root 0755）
#
# 作为 SSH forced command 运行，绑定在 daydayon 用户 authorized_keys 里的 GitHub Actions 部署公钥上：
#   command="/usr/local/sbin/daydayon-deploy-gate",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc ssh-ed25519 AAAA... gha-deploy-daydayon
#
# 只接受两种 SSH_ORIGINAL_COMMAND，其他一律拒绝：
#   status                     打印当前部署版本与进程状态
#   deploy-artifact <sha40>    stdin = artifact.tar.gz（scripts/build/pack-artifact.sh 生成的 standalone 制品）
#
# 流程：校验大小与 gzip → 解包到临时目录 → 校验内容 → 当前版本移为 app.prev → 切换 → pm2 重启
#       → 健康检查（/api/health 返回的 commit 必须等于本次 sha）→ 失败则切回 app.prev
# 退出码：0 成功；2 请求被拒绝；1 部署失败（已回滚）
set -Eeuo pipefail
umask 027

ROOT=/www/wwwroot/daydayon
NODE_BIN=/www/server/nodejs/v24.19.0/bin
export PATH="$NODE_BIN:/usr/local/bin:/usr/bin:/bin"
export PM2_HOME="$ROOT/home/.pm2"

APP_NAME=daydayon
ECO="$ROOT/ecosystem.config.cjs"
CUR="$ROOT/app"
PREV="$ROOT/app.prev"
FAILED="$ROOT/app.failed"
INCOMING="$ROOT/.incoming"
LOCK="$ROOT/.deploy.lock"
LOG="$ROOT/logs/deploy.log"
STATE="$ROOT/logs/deploy-state"
# 端口约定见 docs/conventions/ports.md
HEALTH_URL=http://127.0.0.1:23329/api/health
MAX_BYTES=$((300 * 1024 * 1024))

log() { printf '%s gate[%s] %s\n' "$(date -Is)" "$$" "$*" >> "$LOG"; }
reject() { echo "gate: $1" >&2; log "REJECT $1"; exit 2; }

[[ "$(id -un)" == "daydayon" ]] || { echo "gate: must run as daydayon" >&2; exit 2; }
# 固定工作目录：被 sudo 从其他目录调用时，find 等命令不会因为无权回到原目录而报错
cd "$ROOT"

read -r -a argv <<< "${SSH_ORIGINAL_COMMAND:-}"
(( ${#argv[@]} <= 2 )) || reject "too many arguments"
action="${argv[0]:-}"
sha="${argv[1]:-}"
client="${SSH_CLIENT:-local}"
log "cmd=${action} ${sha} from=${client%% *}"

case "$action" in
  status)
    echo "deploy-state: $(cat "$STATE" 2>/dev/null || echo 'never deployed')"
    pm2 jlist 2>/dev/null | node -e '
      let s = ""
      process.stdin.on("data", (d) => (s += d)).on("end", () => {
        for (const p of JSON.parse(s || "[]")) console.log(`${p.name} ${p.pm2_env.status} restarts=${p.pm2_env.restart_time}`)
      })' || true
    exit 0
    ;;
  deploy-artifact) ;;
  *) reject "usage: status | deploy-artifact <sha40>" ;;
esac

[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || reject "sha must be 40 lowercase hex chars"

exec 9> "$LOCK"
flock -w 600 9 || reject "another deploy is running"

install -d -m 0700 "$INCOMING"
payload="$INCOMING/$sha.tar.gz"
stage="$INCOMING/stage-$sha"
cleanup() { rm -rf -- "$payload" "$stage"; }
trap cleanup EXIT

# 1. 大小与格式
head -c $((MAX_BYTES + 1)) > "$payload"
size=$(stat -c %s "$payload")
(( size > 0 && size <= MAX_BYTES )) || reject "payload size ${size} rejected (max ${MAX_BYTES})"
gzip -t "$payload" 2>/dev/null || reject "payload is not valid gzip"

# 2. 解包（GNU tar 默认去掉开头的 / 并拒绝含 .. 的成员）
rm -rf -- "$stage"
install -d -m 0750 "$stage"
tar -xzf "$payload" -C "$stage" --no-same-owner --no-same-permissions || reject "extract failed"

# 3. 内容校验
[[ -f "$stage/server.js" && -d "$stage/.next" ]] || reject "artifact missing server.js or .next/"
[[ -z "$(find "$stage" -name '.env*' -print -quit)" ]] || reject "artifact contains .env files"
[[ -z "$(find "$stage" \( -type b -o -type c -o -type p -o -type s \) -print -quit)" ]] || reject "artifact contains special files"
stage_real=$(realpath "$stage")
while IFS= read -r -d '' link; do
  target=$(realpath -m -- "$link")
  [[ "$target" == "$stage_real"/* ]] || reject "symlink escapes artifact: ${link#"$stage"/}"
done < <(find "$stage" -type l -print0)

printf '%s\n' "$sha" > "$stage/.commit"
log "artifact ok size=${size}"

# 4. 切换前备份数据库（备份脚本存在且可执行时执行；迁移在服务启动钩子 instrumentation.ts 中幂等执行）
if [[ -x /mnt/data/daydayon/compose/backup-db.sh ]]; then
  log "running pre-deploy db backup"
  /mnt/data/daydayon/compose/backup-db.sh >> "$LOG" 2>&1 || log "pre-deploy backup skipped"
fi

# 5. 切换
if [[ -d "$CUR" ]]; then
  rm -rf -- "$PREV"
  mv -- "$CUR" "$PREV"
fi
mv -- "$stage" "$CUR"
pm2 startOrRestart "$ECO" --update-env >> "$LOG" 2>&1
pm2 save >> "$LOG" 2>&1

# 5. 健康检查：必须是本次版本在响应
healthy() {
  local body
  for _ in $(seq 1 30); do
    body=$(curl -fsS --max-time 3 "$HEALTH_URL" 2>/dev/null || true)
    if [[ "$body" == *'"ok":true'* && "$body" == *"\"commit\":\"$1\""* ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

if ! healthy "$sha"; then
  log "health check failed for ${sha}, rolling back"
  echo "gate: health check failed for ${sha}, rolling back" >&2
  rm -rf -- "$FAILED"
  mv -- "$CUR" "$FAILED"
  if [[ -d "$PREV" ]]; then
    mv -- "$PREV" "$CUR"
    pm2 startOrRestart "$ECO" --update-env >> "$LOG" 2>&1 || true
  fi
  exit 1
fi

printf '%s %s\n' "$sha" "$(date -Is)" > "$STATE"
log "deployed ${sha}"
echo "deployed ${sha}"
