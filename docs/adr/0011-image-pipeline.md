# ADR-0011：浏览器端图片压缩与传输——不引入库：原生 canvas 压缩为 JPEG

- 状态：Accepted（负责人 2026-10-31 拍板：Phase 3 的 17 项建议全部采纳）
- 日期：2026-10-31
- 决策人：项目负责人（AI 提供分析）
- 对比页：[docs/designs/library-showcase/08-image-pipeline.html](../designs/library-showcase/08-image-pipeline.html)

## 背景

- 拍照或选图 → 浏览器压缩 → 发给 deepseek-flash 识别
- 图片永不落盘、不上云（ADR-0002 第 4 节）
- 主要是 iPhone 照片

先定的层：浏览器原生能力（createImageBitmap + canvas）就够，关键是格式和尺寸选对。

本次核实的关键事实：

- Safari 从未支持用 canvas 编码 WebP，请求 WebP 会静默返回 PNG（MDN：不支持的格式回退为 image/png）
- DeepSeek 接受 JPEG、PNG、GIF、WebP；推理前把图片缩放到约 1300×1300 的像素总量，每张图最多 1024 个 token
- AI SDK 的 DeepSeek provider 支持内联图片（file part）；也支持 DeepSeek Files API（uploadFile），文件会存在 DeepSeek，保留 1 小时到 30 天，不设过期则永久保存

## 面临的选项

- **原生 createImageBitmap + canvas.toBlob（JPEG）**：推荐。零依赖，行为可控。
- **browser-image-compression**（`browser-image-compression`）：不采用。底层同样是 canvas，为 50 行代码多一个停滞的依赖。
- **Compressor.js**（`compressorjs`）：不采用。同样是 canvas，没有必要。

## 决定

不引入库：原生 canvas 压缩为 JPEG。

- 封装层入口：src/lib/image/compress.ts（浏览器端）；src/server/ai/image.ts（服务端只在内存里转成内联 file part）
- 压缩输出统一为 JPEG（质量 0.8），像素总量不超过约 1300×1300；取代 ADR-0002 第 4 节"WebP、长边 ≤ 1600px"的写法
- 图片只以内联 file part 发给 DeepSeek，**禁止调用 uploadFile / DeepSeek Files API**（文件会存在 DeepSeek 一侧）
- 服务端只在内存里处理，不写临时文件，不记录 base64
- 浏览器解码失败时（例如 Chrome 桌面打不开 HEIC）提示"这张图打不开，换一张或截个图试试"

## 理由

零依赖，行为可控。

- 把像素总量缩到不超过约 1300×1300（再大 DeepSeek 也会缩小）
- JPEG 质量 0.8，所有浏览器都能编码
- 重新编码会去掉 EXIF（包括 GPS 位置）

## 放弃了什么

- browser-image-compression：2023 年以来没有发布
- Compressor.js：同样的原理，不需要库

已知代价：JPEG 比 WebP 稍大；HEIC 在部分桌面浏览器打不开。

## 何时重审

- Safari 支持 canvas 编码 WebP 时
- DeepSeek 调整图片尺寸或计费规则时
