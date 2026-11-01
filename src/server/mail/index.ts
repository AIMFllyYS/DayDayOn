import 'server-only'
import nodemailer from 'nodemailer'
import { env, isProduction } from '@/server/env'
import { otpMail } from './templates'

/*
 * 发信入口（契约，F1 定签名，P1 实现）。PRD 2.1、ADR-0017。
 * 开发环境且没有 SMTP_USER 时把验证码打印到服务端控制台；生产环境永不打印。
 * 只有本目录可以 import nodemailer。transporter 模块级懒创建一次并复用（lessons/nodemailer.md）。
 */

export interface MailMessage {
  to: string | string[]
  subject: string
  /** HTML 正文：模板写成返回字符串的函数，不引入模板库 */
  html: string
  /** 纯文本备选正文 */
  text?: string
}

type Transporter = ReturnType<typeof nodemailer.createTransport>

let transporter: Transporter | undefined

/** 没有配置 SMTP 时返回 undefined（开发环境走控制台兜底） */
function getTransporter(): Transporter | undefined {
  if (transporter) return transporter
  if (!env.SMTP_USER || !env.SMTP_PASS || !env.SMTP_HOST) return undefined
  const port = env.SMTP_PORT ?? 465
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    // 465 = SSL；其余端口走 STARTTLS
    secure: port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  })
  return transporter
}

/** 开发环境且没有 SMTP_USER：允许把验证码打到控制台 */
function devConsoleFallback(): boolean {
  return !isProduction() && !env.SMTP_USER
}

/**
 * 发送登录验证码邮件。由 Better Auth emailOTP 的 sendVerificationOTP 调用（不 await，调用方 .catch 记录）。
 */
export async function sendOtp(email: string, otp: string): Promise<void> {
  if (devConsoleFallback()) {
    console.info(`[mail] 开发环境未配置 SMTP_USER，验证码：${email} → ${otp}`)
    return
  }
  const mail = otpMail(otp)
  await sendMail({ to: email, ...mail })
}

/** 发送任意邮件（告警等）。未配置 SMTP 时：开发环境只打印主题，生产环境抛错 */
export async function sendMail(message: MailMessage): Promise<void> {
  const t = getTransporter()
  if (!t) {
    if (devConsoleFallback()) {
      console.info(`[mail] 开发环境未配置 SMTP，跳过发信：${message.subject}`)
      return
    }
    throw new Error('SMTP 未配置（SMTP_HOST / SMTP_USER / SMTP_PASS）')
  }
  await t.sendMail({
    from: { name: 'DayDayOn', address: env.SMTP_USER ?? '' },
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  })
}
