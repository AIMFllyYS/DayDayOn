/*
 * 智能拍照跨组件内存交接槽（严守 ADR-0002：仅保存在 JS 运行时内存，绝不写入磁盘或 Web Storage）。
 *
 * 触发流程：
 * 1. 用户在打卡弹层点击「智能拍照」→ 同步手势直接拉起系统摄像机（<input capture="environment">）；
 * 2. 拍照返回 File 后存入 pendingCaptureFile，立即关闭弹层并路由跳转至 /checkin/smart?action=capture；
 * 3. SmartScannerLens 挂载时调用 consumePendingSmartCapture() 取出 File 并立即进入扫描识别状态。
 */

let pendingCaptureFile: File | null = null
const listeners = new Set<() => void>()

export function setPendingSmartCapture(file: File) {
  pendingCaptureFile = file
  listeners.forEach((fn) => fn())
}

export function consumePendingSmartCapture(): File | null {
  const file = pendingCaptureFile
  pendingCaptureFile = null
  return file
}

export function subscribePendingSmartCapture(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
