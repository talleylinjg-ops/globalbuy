#!/usr/bin/env bash
# 客户端安装包部署：从 GitHub packages 分支拉取 APK/Mac 包到应用下载目录
# 用法（宝塔终端执行）: curl -fsSL "https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/master/deploy/vps/deploy-packages.sh?v=$(date +%s)" | bash
# Windows 包(crossbuy-win.zip 106M)超过 GitHub 单文件限制，需宝塔文件管理器手动上传到 /opt/globalbuy/server/downloads/
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/talleylinjg-ops/globalbuy/packages/server/downloads"
DEST="/opt/globalbuy/server/downloads"
mkdir -p "$DEST/.well-known"

echo "===== 下载安装包 ====="
for name in crossbuy-android.apk crossbuy-mac.zip; do
  echo "下载 $name ..."
  curl -fSL --retry 3 -o "$DEST/$name.tmp" "$REPO_RAW/$name"
  mv "$DEST/$name.tmp" "$DEST/$name"
done

if [ -f "$DEST/crossbuy-win.zip" ]; then
  echo "crossbuy-win.zip 已存在，跳过（宝塔手动上传版）"
else
  echo "提示: crossbuy-win.zip (106M) 超过 GitHub 单文件限制，请通过宝塔【文件】-> /opt/globalbuy/server/downloads/ 手动上传"
fi

echo "===== 校验 ====="
chmod -R 755 "$DEST"
ls -lh "$DEST" | grep crossbuy || true

echo "===== 重启应用生效 ====="
cd /opt/globalbuy/server && pm2 restart crossbuy-server
sleep 2
echo "版本接口返回:"
curl -s "http://127.0.0.1:3001/api/app/version"
echo ""
echo "PACKAGES-DONE"
