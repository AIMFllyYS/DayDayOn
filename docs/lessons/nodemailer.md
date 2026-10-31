# lessons — Nodemailer

> 适用版本：nodemailer@10.3.1 及以上（M3 安装）。以下条目来自 2026-10-31 对官网的核对，尚未在本项目代码里踩到。

### 同时安装 @types/nodemailer
- 症状：类型声明冲突，`pnpm typecheck` 报重复定义。
- 根因：Nodemailer 10 自带 TypeScript 声明；`@types/nodemailer` 只适用于 9 及以前，官网说明两者同时安装会冲突。
- 规则：不安装 `@types/nodemailer`。
- 元：nodemailer@10.3.1 | 2026-10-31 | 候选毕业方向：无

### 每封邮件新建 transporter
- 症状：发信慢，SMTP 连接数异常。
- 根因：官网建议启动时创建一个 transporter 并复用。
- 规则：`src/server/mail/` 里模块级创建一次（阿里云 SMTP：`smtpdm.aliyun.com:465`，`secure: true`），所有发信函数共用。
- 元：nodemailer@10.3.1 | 2026-10-31 | 候选毕业方向：封装层（`src/server/mail/`）

