# 小红书小工具包说明 · 你是哪只猫

## 产物

- `which-cat-minitool.zip` — 直接上传的包，**zip 根目录就是 `index.html`**（不能多套一层目录）。
- `minitool/` — 解包后的内容和 zip 完全一致，方便核对（不提交、不发布）。
- 体积：112.6 KiB，15 个文件；远低于平台「≤2 MiB 建议值」，也满足 10 MiB 硬上限。

## 包内文件

```
index.html
style.css
assets/icon-180.png
assets/icon-192.png
js/compat.js      js/config.js      js/art.js       js/art-extra.js
js/audio.js       js/xhs.js         js/challenge.js js/collection.js
js/quiz.js        js/card.js        js/main.js
```

## 打包命令

```bash
npm run minitool          # 校验 + 压缩
npm run minitool -- --no-zip   # 只整理目录、不压缩
npm run test:minitool     # 解压真实 zip，在假容器里跑 72 项验收
```

打包时会跑静态校验，任何一条不过都直接失败：

- 根目录必须是 `index.html`；只允许 html/css/js/png/jpg/webp/svg/woff2/json。
- 不允许外链 http(s)、协议相对路径、绝对路径、`<base>`、iframe/object/embed、自建 CSP。
- 不允许内联 `<script>`、行内 `onclick`、`type="module"`、`javascript:`。
- 不允许容器禁用能力：`fetch` / `XMLHttpRequest` / `WebSocket` / `Worker` / `eval` / `new Function` / `localStorage` 以外的下载、`navigator.clipboard`、`execCommand('copy')`、`window.open`、`a[download]`、`indexedDB`。
- 不允许 Chrome 61 解析不了的语法：可选链、空值合并、逻辑赋值、`Object.fromEntries`、`Array.at/flat`、`catch {}`、ES Module、class 私有字段等。
- CSS：`clamp()/min()/max()` 必须有像素兜底，不能用 `inset` 简写、裸 `aspect-ratio`、裸 flex `gap`；安全区必须写成 `var(--safe-area-inset-*, env(safe-area-inset-*, 0px))`。
- 包内 base64 单块不得超过 100 KiB。

## 用到的容器能力

| 能力 | 用途 | 降级 |
|---|---|---|
| `miniTool.postNote` | 发挑战笔记（标题 + 正文 + 1 张卡） | 展开文案供长按复制 |
| `miniTool.interactionOpenApi` | 评论区挑战（`post_comment` + 卡片 + snapshot） | 按钮禁用，提示改用发笔记 |
| `miniTool.writeTempFile` + `saveImageToPhotosAlbum` | 存战绩卡到相册 | 提示长按图片保存 |
| `miniTool.setStorage/getStorage` | 图鉴、昵称、上次结果的跨会话缓存（≥9.46） | localStorage |
| `miniTool.vibrateShort` | 选选项的轻震动（≥9.50） | 静默跳过 |
| `miniTool.getLaunchOptions` | 读取被挑战的 snapshot | 不显示挑战横幅 |

## 挑战文案（可直接用于笔记）

标题：`我是布偶糖·黏人精，你是什么猫`（≤20 字，按测出的猫自动生成）

正文示例：

```
今天做了 10 道题，测出来是「布偶糖·黏人精」。
你在哪，我在哪
关键词：缺人陪 / 情绪细腻 / 被抱着才安心
...
同一天所有人的题都是同一套（题号 bdyd5k），所以结果能直接对着看。
你也来测测你是哪只猫？测完在评论区报一下，我看看谁是同款。
```

评论文案（≤120 字）：

```
我测出来是「布偶糖·黏人精」（缺人陪、情绪细腻），今天十道题是同一套，你也来测测？
```

## snapshot 格式

```json
{"v":1,"g":"which","r":1,"d":"2026-10-26","n":"路人猫","k":"bdyd5k","c":3}
```

- `v` 版本、`g` 游戏标识（`which`，别的游戏会被拒绝）、`r` 结果编号（0~9）、`d` 日期、`n` 昵称、`k` 当天题号、`c` 图鉴进度（可选，超 2KB 时自动去掉）。
- 读取顺序：`launchOptions.miniToolSnapshotInfo` → `location.search` → `getLaunchOptions()`，读不到返回 null，界面不显示挑战横幅。

## 发布检查清单

- [x] zip 根目录是 `index.html`
- [x] 全部经典脚本，无内联脚本 / 行内事件 / 模块
- [x] 离线可玩（无网络请求、无外部资源）
- [x] 图鉴与昵称本地缓存 + 容器 Storage 双写
- [x] 评论区挑战 ≤2KB snapshot，评论正文 ≤120 字
- [x] 笔记标题 ≤20 字、正文 ≤1000 字、1 张 1080×1440 图
- [x] 无容器 / 低版本容器都有降级文案
- [x] 图标 180/192 已打进包内
