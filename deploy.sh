#!/usr/bin/env bash
# 一键把当前目录推到 GitHub Pages 仓库（gh CLI 未登录时可用 keychain 里的凭据）
# 用法: ./deploy.sh [仓库名]
set -euo pipefail
REPO="${1:-which-cat}"
OWNER="${GH_OWNER:-CyanCat22}"
BRANCH=main

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  git init -q
  git checkout -q -b "$BRANCH" 2>/dev/null || git branch -M "$BRANCH"
fi
git add -A
git commit -q -m "chore: 你是哪只猫 v1 $(date +%Y-%m-%d)" || echo "没有新改动"
git branch -M "$BRANCH" 2>/dev/null || true

TOKEN=""
if command -v gh >/dev/null 2>&1; then
  TOKEN="$(gh auth token 2>/dev/null || true)"
fi
if [ -z "$TOKEN" ] && command -v git >/dev/null 2>&1; then
  TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain get 2>/dev/null | awk -F= '/^password=/{print $2}')"
fi
if [ -z "$TOKEN" ]; then
  echo "拿不到 GitHub 凭据：先 gh auth login，或把 token 写进 macOS keychain。" >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/$OWNER/$REPO.git"
fi

API="https://api.github.com"
code="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$API/repos/$OWNER/$REPO")"
if [ "$code" != "200" ]; then
  echo "创建仓库 $OWNER/$REPO …"
  curl -sf -X POST -H "Authorization: Bearer $TOKEN" -H 'Accept: application/vnd.github+json' \
    "$API/user/repos" -d "{\"name\":\"$REPO\",\"private\":false,\"has_issues\":false,\"has_wiki\":false}" >/dev/null
fi

git -c "http.extraheader=AUTHORIZATION: bearer $TOKEN" push -q -u origin "$BRANCH" --force

echo "启用 GitHub Pages …"
curl -sf -X POST -H "Authorization: Bearer $TOKEN" -H 'Accept: application/vnd.github+json' \
  "$API/repos/$OWNER/$REPO/pages" -d '{"source":{"branch":"'$BRANCH'","path":"/"}}' >/dev/null 2>&1 || \
curl -sf -X PUT -H "Authorization: Bearer $TOKEN" -H 'Accept: application/vnd.github+json' \
  "$API/repos/$OWNER/$REPO/pages" -d '{"source":{"branch":"'$BRANCH'","path":"/"}}' >/dev/null 2>&1 || true

echo "完成： https://$OWNER.github.io/$REPO/"
