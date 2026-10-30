#!/usr/bin/env bash
# 客户端安装包部署：从 GitHub Release 拉取 APK/EXE/ZIP 到应用下载目录
# 用法（宝塔终端执行）: curl -fsSL "https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/deploy-packages.sh?v=$(date +%s)" | bash
set -euo pipefail

REPO="talleylinjg-ops/globalbuy"
DEST="/opt/globalbuy/server/downloads"
mkdir -p "$DEST/.well-known"

echo "===== 获取最新 Release ====="
ASSETS_URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep -o '"browser_download_url": *"[^"]*"' | cut -d'"' -f4 || true)
if [ -z "$ASSETS_URL" ]; then
  echo "未找到 Release 资产。请先在 GitHub 上触发 release workflow 构建产物。"
  exit 1
fi

echo "===== 下载安装包 ====="
for url in $ASSETS_URL; do
  name=$(basename "$url")
  case "$name" in
    crossbuy-android.apk|crossbuy-win.exe|crossbuy-mac.zip)
      echo "下载 $name ..."
      curl -fSL --retry 3 -o "$DEST/$name.tmp" "$url"
      mv "$DEST/$name.tmp" "$DEST/$name"
      ;;
    *) echo "跳过 $name";;
  esac
done

echo "===== 校验权限与结果 ====="
chmod -R 755 "$DEST"
ls -lh "$DEST" | grep -v "^total" || true

echo "===== 重启应用生效 ====="
cd /opt/globalbuy/server && pm2 restart crossbuy-server
sleep 2
curl -s "http://127.0.0.1:3001/api/app/version"
echo ""
echo "PACKAGES-DONE"
