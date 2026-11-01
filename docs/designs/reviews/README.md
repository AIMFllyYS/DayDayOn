# docs/designs/reviews/

Playbook 和调试页的批注导出文件。

- 来源：`/dev` 下任意页面右下角「批注」→ 列表 →「导出 JSON」
- 文件名：`annotations-YYYYMMDD-HHmm.json`，格式标记 `schema: "daydayon.annotations/v2"`，包含批注（items）和草图（sketches）
- 用法：把文件放进本目录并告诉 AI 代理"按 reviews/xxx.json 修改"；修完后在批注列表里标记解决，再导出一次覆盖
- 字段说明见 [ui-design-system.md](../../conventions/ui-design-system.md) 第 12 节

导出文件里有浏览器 UA 和视口尺寸，不含任何账号信息或用户数据。
