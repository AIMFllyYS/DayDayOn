#!/usr/bin/env bash
# 组装 standalone 部署制品：.next/standalone + .next/static + public → artifact.tar.gz
# 用法：bash scripts/build/pack-artifact.sh [输出文件]
# 前提：已在 Linux 上执行 pnpm build（制品含平台相关的原生依赖，不能在 Windows 上打包）
# 退出码：0 成功；1 缺少构建产物或制品校验失败
set -Eeuo pipefail

out="${1:-artifact.tar.gz}"
max=$((300 * 1024 * 1024))

[[ -f .next/standalone/server.js ]] || { echo "缺少 .next/standalone/server.js，请先运行 pnpm build" >&2; exit 1; }

work=$(mktemp -d)
trap 'rm -rf -- "$work"' EXIT

cp -a .next/standalone/. "$work/"
mkdir -p "$work/.next"
cp -a .next/static "$work/.next/static"
if [[ -d public ]]; then
  cp -a public "$work/public"
fi
if [[ -d src/server/db/migrations ]]; then
  mkdir -p "$work/src/server/db"
  cp -a src/server/db/migrations "$work/src/server/db/migrations"
fi

# 制品里不能有 .env 文件
if [[ -n "$(find "$work" -name '.env*' -print -quit)" ]]; then
  echo "制品里发现 .env 文件" >&2
  exit 1
fi

# 符号链接不能指向制品之外
work_real=$(realpath "$work")
while IFS= read -r -d '' link; do
  target=$(realpath -m -- "$link")
  if [[ "$target" != "$work_real"/* ]]; then
    echo "符号链接越界：${link#"$work"/} -> $target" >&2
    exit 1
  fi
done < <(find "$work" -type l -print0)

tar -C "$work" -czf "$out" .
size=$(stat -c %s "$out")
if (( size > max )); then
  echo "制品 ${size} 字节，超过上限 ${max}" >&2
  exit 1
fi
echo "制品：${out}（$((size / 1024 / 1024)) MiB）"
