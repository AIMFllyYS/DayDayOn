import 'server-only'

/*
 * 发信入口（契约，F1 定签名，P1 实现）。PRD 2.1、ADR-0017。
 * 开发环境且没有 SMTP_USER 时把验证码打印到服务端控制台；生产环境永不打印。
 * 只有本目录可以 import nodemailer。
 */

export interface MailMessage {
  to: string | string[]
  subject: string
  /** HTML 正文：模板写成返回字符串的函数，不引入模板库 */
  html: string
  /** 纯文本备选正文 */
  text?: string
}

/**
 * 发送登录验证码邮件。由 Better Auth emailOTP 的 sendVerificationOTP 调用（不 await，调用方 .catch 记录）。
 * 实现：P1（PRD 2.1）
 */
export async function sendOtp(email: string, otp: string): Promise<void> {
  void email
  void otp
  throw new Error('not implemented: P1')
}

/**
 * 发送任意邮件（告警等）。实现：P1（PRD 7.3 告警）
 */
export async function sendMail(message: MailMessage): Promise<void> {
  void message
  throw new Error('not implemented: P1')
}
