#!/usr/bin/env bash
# 一键发版：统一更新所有版本位
# 用法: bash shell/bump-version.sh 1.2.0
set -euo pipefail

VERSION="${1:?usage: bump-version.sh <version>}"
BUILD="$(date +%Y%m%d)"
MAJOR_MINOR=$(echo "$VERSION" | cut -d. -f1,2)
VERSION_CODE=$(echo "$MAJOR_MINOR" | tr -d '.' | sed 's/^/1/; s/1\(..\)/\1/')00
# versionCode = 主次版本数字 x100，如 1.2.x -> 1200
VERSION_CODE=$(( $(echo "$MAJOR_MINOR" | tr -d '.') * 100 ))

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. web 版本标记（PWA 升级提示数据源）
node -e "
const fs = require('fs');
const p = '$ROOT/web/public/app-version.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.version = '$VERSION'; j.build = '$BUILD';
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
"
# 2. Service Worker 缓存版本
sed -i.bak "s/const SW_VERSION = 'v[0-9.]*';/const SW_VERSION = 'v$VERSION';/" "$ROOT/web/public/sw.js" && rm -f "$ROOT/web/public/sw.js.bak"
# 3. server 版本 API
sed -i.bak "s/export const APP_VERSION = '[0-9.]*';/export const APP_VERSION = '$VERSION';/" "$ROOT/server/src/services/appVersion.js" && rm -f "$ROOT/server/src/services/appVersion.js.bak"
sed -i.bak "s/export const APP_BUILD = '[0-9]*';/export const APP_BUILD = '$BUILD';/" "$ROOT/server/src/services/appVersion.js" && rm -f "$ROOT/server/src/services/appVersion.js.bak"
# 4. Electron 壳
node -e "
const fs = require('fs');
const p = '$ROOT/shell/electron/package.json';
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
j.version = '$VERSION';
fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
"
# 5. Android 壳
sed -i.bak "s/versionCode [0-9]*/versionCode $VERSION_CODE/" "$ROOT/shell/android/app/build.gradle" && rm -f "$ROOT/shell/android/app/build.gradle.bak"
sed -i.bak "s/versionName '[0-9.]*'/versionName '$VERSION'/" "$ROOT/shell/android/app/build.gradle" && rm -f "$ROOT/shell/android/app/build.gradle.bak"

echo "bumped to v$VERSION (build $BUILD, android versionCode $VERSION_CODE)"
echo "next: bash web/build.sh && git commit -m 'chore: release v$VERSION' && git tag v$VERSION && git push origin master --tags"
