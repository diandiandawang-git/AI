import type { BidRecord } from '../types'
import * as XLSX from 'xlsx'

export function parseExcelFile(file: File): Promise<BidRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[]
        const records = normalizeRecords(json)
        resolve(records)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function parseCSVFile(file: File): Promise<BidRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string
        const workbook = XLSX.read(text, { type: 'string' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, unknown>[]
        const records = normalizeRecords(json)
        resolve(records)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsText(file)
  })
}

function normalizeRecords(rows: Record<string, unknown>[]): BidRecord[] {
  return rows.map((row) => {
    const budget = toNumber(row['招标金额(万)'] ?? row['招标金额'] ?? 0)
    const award = toNumber(row['中标金额(万)'] ?? row['中标金额'] ?? 0)
    return {
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
  })
}

function toNumber(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

function formatDate(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'number') {
    // Excel serial date
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

export async function loadDefaultData(): Promise<BidRecord[]> {
  const res = await fetch('/data/bid_data.json')
  if (!res.ok) throw new Error('默认数据加载失败')
  return res.json()
}
