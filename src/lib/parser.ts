/**
 * 标讯文件解析器 — 主线程入口
 *
 * 功能：
 * 1. 文件预校验（格式、大小、空文件）
 * 2. FileReader 分阶段进度（读取→解析→提取）
 * 3. Web Worker 后台解析（不阻塞 UI）
 * 4. 120s 超时 + 可取消 + 最多重试 2 次
 * 5. 分类错误信息
 */
import type { BidRecord } from '../types'

// ── 常量配置 ──────────────────────────────────
const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB（浏览器内存上限较宽松）
const PARSE_TIMEOUT_MS = 120_000 // 120 秒超时
const MAX_RETRIES = 2
const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv', '.xlsm', '.xlsb']

// ── 导出类型 ──────────────────────────────────
export type ParsePhase = 'validating' | 'reading' | 'parsing' | 'extracting' | 'normalizing' | 'receiving' | 'done'

export interface ParseProgress {
  phase: ParsePhase
  percent: number
  detail: string
}

export class ParseError extends Error {
  code: 'FILE_TOO_LARGE' | 'INVALID_FORMAT' | 'EMPTY_FILE' | 'READ_ERROR' | 'PARSE_TIMEOUT' | 'PARSE_ERROR' | 'CANCELLED'
  detail: string

  constructor(code: ParseError['code'], detail: string) {
    super(detail)
    this.name = 'ParseError'
    this.code = code
    this.detail = detail
  }
}

// ── 文件预校验 ────────────────────────────────
export function validateFile(file: File): ParseError | null {
  if (!file) return new ParseError('EMPTY_FILE', '未选择文件')
  if (file.size === 0) return new ParseError('EMPTY_FILE', '文件为空（0 字节）')

  const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '')
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return new ParseError(
      'INVALID_FORMAT',
      `不支持的文件格式"${ext}"，请上传 ${ALLOWED_EXTENSIONS.join('/')} 文件`,
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1)
    return new ParseError(
      'FILE_TOO_LARGE',
      `文件过大（${sizeMB}MB），上限为 ${MAX_FILE_SIZE / 1024 / 1024}MB。请拆分后分批上传`,
    )
  }

  return null
}

// ── 主解析入口（带进度回调）────────────────────
export function parseFile(
  file: File,
  onProgress: (p: ParseProgress) => void,
  signal?: AbortSignal,
): Promise<BidRecord[]> {
  return _parseWithRetry(file, onProgress, signal, 0)
}

async function _parseWithRetry(
  file: File,
  onProgress: (p: ParseProgress) => void,
  signal: AbortSignal | undefined,
  attempt: number,
): Promise<BidRecord[]> {
  try {
    return await _parseOnce(file, onProgress, signal)
  } catch (err) {
    // 取消和校验错误不重试
    if (err instanceof ParseError && ['CANCELLED', 'INVALID_FORMAT', 'EMPTY_FILE', 'FILE_TOO_LARGE'].includes(err.code)) {
      throw err
    }
    if (signal?.aborted) throw new ParseError('CANCELLED', '用户取消')

    if (attempt < MAX_RETRIES) {
      onProgress({ phase: 'reading', percent: 0, detail: `解析失败，正在重试（${attempt + 1}/${MAX_RETRIES}）...` })
      await delay(1500)
      return _parseWithRetry(file, onProgress, signal, attempt + 1)
    }
    throw err
  }
}

async function _parseOnce(
  file: File,
  onProgress: (p: ParseProgress) => void,
  signal?: AbortSignal,
): Promise<BidRecord[]> {
  // ─ 阶段 0：预校验 ─
  onProgress({ phase: 'validating', percent: 0, detail: '正在校验文件...' })
  const validationError = validateFile(file)
  if (validationError) throw validationError

  // ─ 阶段 1：读取文件到内存（带进度）─
  const isCSV = file.name.toLowerCase().endsWith('.csv')
  const fileData = await readFileWithProgress(file, isCSV ? 'text' : 'arraybuffer', onProgress, signal)

  // ─ 阶段 2：Worker 解析（带超时）─
  const records = await parseInWorker(fileData, isCSV, onProgress, signal)

  onProgress({ phase: 'done', percent: 100, detail: `解析完成，共 ${records.length} 条标讯` })
  return records
}

// ── FileReader（带进度）───────────────────────
function readFileWithProgress(
  file: File,
  readAs: 'arraybuffer' | 'text',
  onProgress: (p: ParseProgress) => void,
  signal?: AbortSignal,
): Promise<ArrayBuffer | string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    let lastPct = 0

    const abortHandler = () => {
      reader.abort()
      reject(new ParseError('CANCELLED', '用户取消'))
    }
    signal?.addEventListener('abort', abortHandler, { once: true })

    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100)
        if (pct > lastPct + 4 || pct === 100) {
          lastPct = pct
          const loadedMB = (e.loaded / 1024 / 1024).toFixed(1)
          const totalMB = (e.total / 1024 / 1024).toFixed(1)
          onProgress({
            phase: 'reading',
            percent: pct,
            detail: `正在读取文件... ${loadedMB}/${totalMB} MB`,
          })
        }
      }
    }

    reader.onload = (e) => {
      signal?.removeEventListener('abort', abortHandler)
      if (!e.target?.result) {
        reject(new ParseError('READ_ERROR', '文件读取失败：结果为空'))
        return
      }
      resolve(e.target.result)
    }

    reader.onerror = () => {
      signal?.removeEventListener('abort', abortHandler)
      reject(new ParseError('READ_ERROR', `文件读取失败：${reader.error?.message || '未知错误'}`))
    }

    if (readAs === 'arraybuffer') {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
  })
}

// ── Worker 解析（带超时 + 取消）─────────────────
function parseInWorker(
  fileData: ArrayBuffer | string,
  isCSV: boolean,
  onProgress: (p: ParseProgress) => void,
  signal?: AbortSignal,
): Promise<BidRecord[]> {
  return new Promise((resolve, reject) => {
    let settled = false

    // 创建 Worker
    const worker = new Worker(new URL('./parser.worker.ts', import.meta.url), { type: 'module' })

    // 超时
    const timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      worker.terminate()
      reject(new ParseError('PARSE_TIMEOUT', `解析超时（超过 ${PARSE_TIMEOUT_MS / 1000} 秒），请确认文件未损坏并重试`))
    }, PARSE_TIMEOUT_MS)

    // 取消信号
    const abortHandler = () => {
      if (settled) return
      settled = true
      worker.postMessage({ type: 'cancel' })
      clearTimeout(timeoutId)
      // 给 worker 一点时间清理
      setTimeout(() => worker.terminate(), 500)
      reject(new ParseError('CANCELLED', '用户取消'))
    }
    signal?.addEventListener('abort', abortHandler, { once: true })

    // 累积所有分片
    const allRecords: BidRecord[] = []

    // Worker 消息处理
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data

      if (msg.type === 'progress') {
        const phaseMap: Record<string, ParsePhase> = {
          parsing: 'parsing',
          extracting: 'extracting',
          normalizing: 'normalizing',
        }
        onProgress({
          phase: phaseMap[msg.phase] ?? 'parsing',
          percent: msg.percent,
          detail: msg.detail,
        })
      } else if (msg.type === 'result_chunk') {
        // 分片到达：追加数据（每次仅 500 条，结构化克隆极快）
        allRecords.push(...(msg.chunk as BidRecord[]))
        const pct = Math.round((msg.loaded / msg.total) * 100)
        onProgress({
          phase: 'receiving',
          percent: pct,
          detail: `正在接收数据... ${msg.loaded.toLocaleString()}/${msg.total.toLocaleString()} 行`,
        })
      } else if (msg.type === 'result_done') {
        // 所有分片已接收完毕
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', abortHandler)
        worker.terminate()
        resolve(allRecords)
      } else if (msg.type === 'error') {
        if (settled) return
        settled = true
        clearTimeout(timeoutId)
        signal?.removeEventListener('abort', abortHandler)
        worker.terminate()

        const codeMap: Record<string, ParseError['code']> = {
          INVALID_FORMAT: 'INVALID_FORMAT',
          EMPTY_FILE: 'EMPTY_FILE',
          PARSE_ERROR: 'PARSE_ERROR',
          DATA_CORRUPT: 'PARSE_ERROR',
        }
        reject(new ParseError(codeMap[msg.code] ?? 'PARSE_ERROR', msg.message))
      }
    }

    worker.onerror = (ev) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      signal?.removeEventListener('abort', abortHandler)
      worker.terminate()
      reject(new ParseError('PARSE_ERROR', `解析引擎异常：${ev.message}`))
    }

    // 发送解析任务
    if (isCSV) {
      worker.postMessage({ type: 'parse_csv', text: fileData as string, batchSize: 1000 })
    } else {
      worker.postMessage({ type: 'parse_xlsx', fileData: fileData as ArrayBuffer, batchSize: 1000 })
    }
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── 加载默认示例数据（不变）───────────────────
export async function loadDefaultData(): Promise<BidRecord[]> {
  const res = await fetch('/data/bid_data.json')
  if (!res.ok) throw new Error('默认数据加载失败')
  return res.json()
}
