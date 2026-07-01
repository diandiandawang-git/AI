/**
 * Web Worker — XLSX/CSV 解析引擎 v2
 *
 * 核心改进：解析完成后分片发送结果（500 条/批），
 * 避免单次 postMessage 结构化克隆 2 万+ 对象时阻塞主线程。
 */
import * as XLSX from 'xlsx'

// ── 消息类型 ──────────────────────────────────
type WorkerRequest =
  | { type: 'parse_xlsx'; fileData: ArrayBuffer; batchSize?: number }
  | { type: 'parse_csv'; text: string; batchSize?: number }
  | { type: 'cancel' }

type WorkerProgress = {
  type: 'progress'
  phase: 'parsing' | 'extracting' | 'normalizing'
  percent: number
  detail: string
}

type WorkerChunk = {
  type: 'result_chunk'
  chunk: BidRecord[]
  loaded: number
  total: number
}

type WorkerDone = {
  type: 'result_done'
  total: number
  stats: { totalRows: number; parseTimeMs: number }
}

type WorkerError = {
  type: 'error'
  code: 'PARSE_ERROR' | 'EMPTY_FILE' | 'INVALID_FORMAT' | 'DATA_CORRUPT'
  message: string
}

// 分片大小：500 条/批，平衡传输效率与主线程响应性
const CHUNK_SIZE = 500

// ── 标讯记录结构（Worker 内不依赖外部类型文件）────────
interface BidRecord {
  标题: string; 项目名称: string; 发布日期: string
  采购单位: string; 中标单位: string
  '招标金额(万)': number; '中标金额(万)': number
  匹配关键词: string; 省份: string; 城市: string
  开标日期: string; 公告类型: string; 行业: string
  项目类别: string; 项目类型: string
  链接地址: string; 备份地址: string
  唯一id: string; 二级行业: string
}

// ── 取消信号 ──────────────────────────────────
class CancelError extends Error {
  constructor() { super('已取消'); this.name = 'CancelError' }
}

// ── 消息入口 ──────────────────────────────────
self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const startTime = performance.now()

  try {
    if (e.data.type === 'cancel') {
      throw new CancelError()
    }

    let records: BidRecord[]

    if (e.data.type === 'parse_xlsx') {
      records = parseXLSX(e.data.fileData, e.data.batchSize ?? 1000)
    } else if (e.data.type === 'parse_csv') {
      records = parseCSV(e.data.text, e.data.batchSize ?? 1000)
    } else {
      return
    }

    // ═══ 分片发送结果（核心优化）══════════════════
    // 不再一次性 postMessage(全部数据)，而是拆成 500 条/批
    const total = records.length
    for (let i = 0; i < total; i += CHUNK_SIZE) {
      const chunk = records.slice(i, i + CHUNK_SIZE)
      self.postMessage({
        type: 'result_chunk',
        chunk,
        loaded: i + chunk.length,
        total,
      } satisfies WorkerChunk)
    }

    // 发送完成信号
    self.postMessage({
      type: 'result_done',
      total,
      stats: { totalRows: total, parseTimeMs: Math.round(performance.now() - startTime) },
    } satisfies WorkerDone)

  } catch (err) {
    if (err instanceof CancelError) return

    const message = err instanceof Error ? err.message : String(err)
    const code: WorkerError['code'] =
      message.includes('不支持') || message.includes('格式') ? 'INVALID_FORMAT'
      : message.includes('空') || message.includes('无数据') ? 'EMPTY_FILE'
      : 'PARSE_ERROR'

    self.postMessage({ type: 'error', code, message } satisfies WorkerError)
  }
}

// ── XLSX 解析 ─────────────────────────────────
function parseXLSX(fileData: ArrayBuffer, batchSize: number): BidRecord[] {
  reportProgress('parsing', 0, '正在解析文件结构...')

  const workbook = XLSX.read(fileData, { type: 'array', codepage: 65001 })

  if (!workbook.SheetNames.length) {
    const text = new TextDecoder('utf-8').decode(fileData)
    if (text.trim()) return parseCSV(text, batchSize)
    throw new Error('文件为空或无数据工作表')
  }

  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet || !worksheet['!ref']) {
    throw new Error('工作表为空或无有效数据')
  }

  reportProgress('parsing', 50, '正在读取表头...')

  const range = XLSX.utils.decode_range(worksheet['!ref']!)
  const totalDataRows = range.e.r

  const headerRow = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })[0]
  if (!headerRow || headerRow.length === 0) {
    throw new Error('文件格式错误：缺少列标题行')
  }
  const headers = headerRow.map((h) => String(h ?? ''))

  // 分批提取数据行
  const allRows: Record<string, unknown>[] = []
  const dataStartRow = 1

  for (let batchStart = dataStartRow; batchStart <= totalDataRows; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize - 1, totalDataRows)
    const batchRange = XLSX.utils.encode_range({
      s: { r: batchStart, c: range.s.c },
      e: { r: batchEnd, c: range.e.c },
    })

    const batch = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: headers,
      range: batchRange,
      defval: '',
    })
    allRows.push(...batch)

    const pct = Math.round(((batchEnd - dataStartRow + 1) / (totalDataRows - dataStartRow + 1)) * 100)
    reportProgress('extracting', pct, `正在提取数据... ${allRows.length}/${totalDataRows - dataStartRow + 1} 行`)
  }

  if (allRows.length === 0) {
    throw new Error('文件格式错误：未提取到有效数据行')
  }

  const records = normalizeRecords(allRows, (done, total) => {
    const pct = Math.round((done / total) * 100)
    reportProgress('normalizing', pct, `正在规范化字段... ${done}/${total} 行`)
  })
  reportProgress('normalizing', 100, '处理完成')

  return records
}

// ── CSV 解析 ──────────────────────────────────
function parseCSV(text: string, batchSize: number): BidRecord[] {
  reportProgress('parsing', 0, '正在解析 CSV 文本...')

  const workbook = XLSX.read(text, { type: 'string' })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet || !worksheet['!ref']) {
    throw new Error('CSV 文件为空或格式无效')
  }

  const range = XLSX.utils.decode_range(worksheet['!ref']!)
  const totalDataRows = range.e.r

  const headerRow = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 })[0]
  if (!headerRow || headerRow.length === 0) {
    throw new Error('CSV 文件格式错误：缺少列标题行')
  }
  const headers = headerRow.map((h) => String(h ?? ''))

  const allRows: Record<string, unknown>[] = []
  const dataStartRow = 1

  for (let batchStart = dataStartRow; batchStart <= totalDataRows; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize - 1, totalDataRows)
    const batchRange = XLSX.utils.encode_range({
      s: { r: batchStart, c: range.s.c },
      e: { r: batchEnd, c: range.e.c },
    })

    const batch = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      header: headers,
      range: batchRange,
      defval: '',
    })
    allRows.push(...batch)

    const pct = Math.round(((batchEnd - dataStartRow + 1) / (totalDataRows - dataStartRow + 1)) * 100)
    reportProgress('extracting', pct, `正在提取数据... ${allRows.length}/${totalDataRows - dataStartRow + 1} 行`)
  }

  if (allRows.length === 0) {
    throw new Error('CSV 文件为空或无有效数据')
  }

  reportProgress('extracting', 100, `数据提取完成，共 ${allRows.length} 行`)

  const records = normalizeRecords(allRows, (done, total) => {
    const pct = Math.round((done / total) * 100)
    reportProgress('normalizing', pct, `正在规范化字段... ${done}/${total} 行`)
  })
  reportProgress('normalizing', 100, '处理完成')

  return records
}

// ── 进度上报 ──────────────────────────────────
function reportProgress(phase: WorkerProgress['phase'], percent: number, detail: string) {
  self.postMessage({ type: 'progress', phase, percent, detail } satisfies WorkerProgress)
}

// ── 字段规范化 ─────────────────────────────────
function normalizeRecords(
  rows: Record<string, unknown>[],
  onProgress?: (done: number, total: number) => void,
): BidRecord[] {
  const total = rows.length
  const out: BidRecord[] = new Array(total)
  const reportEvery = Math.max(200, Math.floor(total / 50))

  for (let i = 0; i < total; i++) {
    const row = rows[i]
    const budget = toNumber(row['招标金额(万)'] ?? row['招标金额'] ?? 0)
    const award = toNumber(row['中标金额(万)'] ?? row['中标金额'] ?? 0)
    out[i] = {
      标题: String(row['标题'] ?? ''),
      项目名称: String(row['项目名称'] ?? row['标题'] ?? ''),
      发布日期: formatDate(row['发布日期']),
      采购单位: String(row['采购单位'] ?? ''),
      中标单位: String(row['中标单位'] ?? ''),
      '招标金额(万)': budget,
      '中标金额(万)': award,
      匹配关键词: String(row['匹配关键词'] ?? ''),
      省份: String(row['省份'] ?? ''),
      城市: String(row['城市'] ?? ''),
      开标日期: formatDate(row['开标日期']),
      公告类型: String(row['公告类型'] ?? ''),
      行业: String(row['行业'] ?? ''),
      项目类别: String(row['项目类别'] ?? ''),
      项目类型: String(row['项目类型'] ?? ''),
      链接地址: String(row['链接地址'] ?? ''),
      备份地址: String(row['备份地址'] ?? ''),
      唯一id: String(row['唯一id'] ?? generateId()),
      二级行业: String(row['二级行业'] ?? ''),
    }

    if (onProgress && (i + 1) % reportEvery === 0) {
      onProgress(i + 1, total)
    }
  }

  if (onProgress) onProgress(total, total)
  return out
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function formatDate(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val)
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`
  }
  const s = String(val).trim()
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) {
    return s.replace(/\//g, '-').slice(0, 10)
  }
  return s
}

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}
