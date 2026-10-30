#!/usr/bin/env bash
# 每日备份 DayDayOn 数据库。安装位置：/mnt/data/daydayon/compose/backup-db.sh（root 0700）
# 由 /etc/cron.d/daydayon-backup 在每天 04:30 调用。保留最近 14 天的备份。
# 退出码：0 成功；非 0 失败（不完整的备份文件不会留下）
set -Eeuo pipefail
umask 077

DIR=/mnt/data/daydayon/backups
ts=$(date +%Y%m%d-%H%M%S)
part="$DIR/.daydayon-$ts.dump.part"
trap 'rm -f -- "$part"' ERR

docker exec daydayon-db pg_dump -U daydayon -d daydayon -Fc > "$part"
mv -- "$part" "$DIR/daydayon-$ts.dump"
find "$DIR" -maxdepth 1 -name 'daydayon-*.dump' -mtime +14 -delete
echo "$(date -Is) backup ok daydayon-$ts.dump"
