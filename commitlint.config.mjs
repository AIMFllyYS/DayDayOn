// 提交信息规范：Conventional Commits。type 与 scope 用英文，描述用中文。
// 规则说明见 docs/conventions/git-workflow.md
const scopes = [
  // 业务
  'auth',
  'onboarding',
  'profile',
  'goal',
  'checkin',
  'exercise',
  'diet',
  'sleep',
  'study',
  'custom',
  'todo',
  'metric',
  'dashboard',
  'rank',
  // AI 与额度
  'agent',
  'quota',
  'risk',
  'admin',
  'mail',
  // 基础设施
  'pwa',
  'ui',
  'db',
  'api',
  'deploy',
  'ci',
  'deps',
  'config',
  'docs',
]

const config = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', scopes],
    // 中文描述不适用英文大小写规则
    'subject-case': [0],
    'header-max-length': [2, 'always', 72],
    // 中文正文按句换行即可，不限制行宽
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
}

export default config
