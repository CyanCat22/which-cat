#!/usr/bin/env bash
# 双击本文件：启动本地服务器并打开游戏（macOS）
cd "$(dirname "$0")" || exit 1
PORT=5191
node server.mjs "$PORT" >/tmp/which-cat-server.log 2>&1 &
sleep 1
open "http://127.0.0.1:$PORT/"
echo "游戏已在浏览器打开： http://127.0.0.1:$PORT/"
echo "关闭本窗口后请手动结束 node 进程（或改端口重开）。"
