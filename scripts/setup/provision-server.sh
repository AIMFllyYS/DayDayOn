#!/usr/bin/env bash
# 初始化 DayDayOn 的服务器环境（可重复执行）。以 root 在服务器上运行：
#   bash provision-server.sh <目录>     <目录> 内含仓库 scripts/deploy/ 下的全部文件
#
# 做的事：系统用户 daydayon、应用目录、运行时 .env、PM2 服务、部署闸门、日志轮转、
#         数据库 compose 与每日备份、Nginx 第一阶段站点（仅 ACME 验证）。
# 不做的事：不覆盖已存在的 .env 与数据库密码；不改动服务器上其他项目；不启动数据库容器（单独执行）。
# 退出码：0 成功；非 0 失败（Nginx 配置校验失败时会撤回本项目的站点文件）
set -Eeuo pipefail
umask 027

SRC="${1:?usage: provision-server.sh <dir-with-deploy-files>}"
ROOT=/www/wwwroot/daydayon
DATA=/mnt/data/daydayon
DOMAIN=daydayon.husteread.com
NGINX_CONF=/www/server/panel/vhost/nginx/$DOMAIN.conf

[[ $EUID -eq 0 ]] || { echo "must run as root" >&2; exit 1; }
for f in daydayon-deploy-gate.sh ecosystem.config.cjs pm2-daydayon.service docker-compose.db.yml \
         backup-db.sh nginx-daydayon.http.conf logrotate-daydayon; do
  [[ -f "$SRC/$f" ]] || { echo "missing $SRC/$f" >&2; exit 1; }
done

echo "== 1. 系统用户与目录"
install -d -m 0751 "$ROOT"
if ! id daydayon >/dev/null 2>&1; then
  useradd --system --user-group --create-home --home-dir "$ROOT/home" --shell /bin/bash daydayon
  passwd -l daydayon >/dev/null
fi
chown daydayon:daydayon "$ROOT"
install -d -m 0750 -o daydayon -g daydayon "$ROOT/home" "$ROOT/logs"
install -d -m 0700 -o daydayon -g daydayon "$ROOT/home/.ssh"
install -d -m 0755 -o daydayon -g daydayon "$ROOT/webroot"
touch "$ROOT/home/.ssh/authorized_keys"
chown daydayon:daydayon "$ROOT/home/.ssh/authorized_keys"
chmod 0600 "$ROOT/home/.ssh/authorized_keys"

echo "== 2. 数据目录与数据库密码"
install -d -m 0700 "$DATA" "$DATA/compose" "$DATA/backups"
install -d -m 0700 -o 70 -g 70 "$DATA/postgres"
if [[ ! -f "$DATA/compose/.env" ]]; then
  ( umask 077; printf 'POSTGRES_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$DATA/compose/.env" )
fi
install -m 0600 "$SRC/docker-compose.db.yml" "$DATA/compose/docker-compose.yml"
install -m 0700 "$SRC/backup-db.sh" "$DATA/compose/backup-db.sh"
printf '30 4 * * * root %s >> %s 2>&1\n' "$DATA/compose/backup-db.sh" "$DATA/backups/backup.log" > /etc/cron.d/daydayon-backup
chmod 0644 /etc/cron.d/daydayon-backup

echo "== 3. 运行时 .env（已存在则保留）"
if [[ ! -f "$ROOT/.env" ]]; then
  dbpass=$(sed -n 's/^POSTGRES_PASSWORD=//p' "$DATA/compose/.env")
  (
    umask 077
    cat > "$ROOT/.env" <<EOF
# DayDayOn 生产环境变量（权限 600，属主 daydayon）。留空的项由负责人填写，改完后重新部署或 pm2 restart。
NEXT_PUBLIC_APP_URL=https://$DOMAIN
DATABASE_URL=postgres://daydayon:$dbpass@127.0.0.1:23432/daydayon
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://$DOMAIN
SMTP_HOST=smtpdm.aliyun.com
SMTP_PORT=465
SMTP_USER=
SMTP_PASS=
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
EOF
  )
  chown daydayon:daydayon "$ROOT/.env"
  chmod 0600 "$ROOT/.env"
fi

echo "== 4. PM2 进程定义、部署闸门、日志轮转"
install -m 0640 -o daydayon -g daydayon "$SRC/ecosystem.config.cjs" "$ROOT/ecosystem.config.cjs"
install -m 0755 -o root -g root "$SRC/daydayon-deploy-gate.sh" /usr/local/sbin/daydayon-deploy-gate
install -m 0644 -o root -g root "$SRC/logrotate-daydayon" /etc/logrotate.d/daydayon

echo "== 5. PM2 服务"
install -m 0644 -o root -g root "$SRC/pm2-daydayon.service" /etc/systemd/system/pm2-daydayon.service
systemctl daemon-reload
systemctl enable pm2-daydayon.service >/dev/null 2>&1
systemctl start pm2-daydayon.service
systemctl is-active pm2-daydayon.service

echo "== 6. Nginx 第一阶段站点"
if [[ ! -f "$NGINX_CONF" ]]; then
  install -m 0644 "$SRC/nginx-daydayon.http.conf" "$NGINX_CONF"
  if ! nginx -t >/dev/null 2>&1; then
    rm -f -- "$NGINX_CONF"
    echo "nginx -t failed, site file removed" >&2
    exit 1
  fi
  nginx -s reload
else
  echo "nginx site exists, left unchanged"
fi

echo "== done"
