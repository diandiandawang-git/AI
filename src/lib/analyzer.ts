import type { BidRecord, FilterState, ReportSection, CustomQuery, ChartData, ScoredBid, CompetitorCard, WinLossMatrix, ParsedIntent, AnalysisIntent } from '../types'
import { productCategories, competitorKeywords, advantageKeywords, ahProducts, competitorProfiles } from './ahProducts'

export function filterRecords(records: BidRecord[], filter: FilterState): BidRecord[] {
  return records.filter((r) => {
    const budget = r['招标金额(万)'] || 0
    if (filter.minBudget !== '' && budget < filter.minBudget) return false
    if (filter.maxBudget !== '' && budget > filter.maxBudget) return false
    if (filter.startDate && r.发布日期 && r.发布日期 < filter.startDate) return false
    if (filter.endDate && r.发布日期 && r.发布日期 > filter.endDate) return false
    if (filter.industries.length && !filter.industries.includes(r.行业)) return false
    if (filter.cities.length && !filter.cities.includes(r.城市)) return false
    if (filter.noticeTypes.length && !filter.noticeTypes.includes(r.公告类型)) return false
    return true
  })
}

export function getUniqueValues(records: BidRecord[], field: keyof BidRecord): string[] {
  const set = new Set(records.map((r) => String(r[field] || '')).filter(Boolean))
  return Array.from(set).sort()
}

interface AggItem {
  name: string
  count: number
  amount: number
  award: number
  winCount: number
}

export function aggregateBy(
  records: BidRecord[],
  field: keyof BidRecord,
  metrics: ('count' | 'sumBudget' | 'sumAward' | 'avgBudget' | 'winRate')[] = ['count', 'sumBudget']
): ChartData[] {
  const map = new Map<string, AggItem>()
  for (const r of records) {
    const key = String(r[field] || '未知')
    if (!map.has(key)) {
      map.set(key, { name: key, count: 0, amount: 0, award: 0, winCount: 0 })
    }
    const item = map.get(key)!
    item.count += 1
    item.amount += Number(r['招标金额(万)']) || 0
    item.award += Number(r['中标金额(万)']) || 0
    if (Number(r['中标金额(万)']) > 0) item.winCount += 1
  }
  const result: ChartData[] = Array.from(map.values()).map((item) => ({
    name: item.name,
    value: metrics.includes('count') ? item.count : undefined,
    amount: metrics.includes('sumBudget') ? Math.round(item.amount * 100) / 100 : undefined,
    award: metrics.includes('sumAward') ? Math.round(item.award * 100) / 100 : undefined,
    avgBudget: metrics.includes('avgBudget') && item.count
      ? Math.round((item.amount / item.count) * 100) / 100
      : undefined,
    winRate: metrics.includes('winRate') && item.count
      ? Math.round((item.winCount / item.count) * 100)
      : undefined,
  }))
  return result.sort((a, b) => (b.amount || b.value || 0) - (a.amount || a.value || 0))
}

export function aggregateTrend(records: BidRecord[]): ChartData[] {
  const map = new Map<string, { count: number; amount: number; award: number }>()
  for (const r of records) {
    const date = r.发布日期 ? r.发布日期.slice(0, 7) : '未知'
    if (!map.has(date)) map.set(date, { count: 0, amount: 0, award: 0 })
    const item = map.get(date)!
    item.count += 1
    item.amount += Number(r['招标金额(万)']) || 0
    item.award += Number(r['中标金额(万)']) || 0
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount * 100) / 100, award: Math.round(v.award * 100) / 100 }))
}

export function classifyBuyerType(unit: string): string {
  if (!unit) return '其他'
  const govKeys = ['政府', '局', '委', '办公室', '委员会', '公安', '检察院', '法院', '街道', '社区', '村']
  const eduKeys = ['大学', '学院', '学校', '教育局', '研究院']
  const medKeys = ['医院', '卫生院', '卫健委', '医保']
  const finKeys = ['银行', '保险', '证券', '期货', '金融']
  const entKeys = ['公司', '集团', '股份', '有限']
  if (medKeys.some((k) => unit.includes(k))) return '医疗'
  if (eduKeys.some((k) => unit.includes(k))) return '教育'
  if (finKeys.some((k) => unit.includes(k))) return '金融'
  if (govKeys.some((k) => unit.includes(k))) return '政府'
  if (entKeys.some((k) => unit.includes(k))) return '企业'
  return '其他'
}

export function detectProductCategory(keywords: string): string {
  for (const cat of productCategories) {
    if (cat.keywords.some((k) => keywords.includes(k))) return cat.name
  }
  return '其他'
}

export function detectAhAdvantage(keywords: string): { score: number; matched: string[] } {
  const matched = advantageKeywords.filter((k) => keywords.includes(k))
  return { score: matched.length, matched }
}

export function detectCompetitors(records: BidRecord[]): ChartData[] {
  const map = new Map<string, { count: number; amount: number }>()
  for (const r of records) {
    if (!r.中标单位) continue
    const winner = r.中标单位
    for (const comp of competitorKeywords) {
      if (winner.includes(comp.name) || (comp.alias && comp.alias.some((a) => winner.includes(a)))) {
        if (!map.has(comp.name)) map.set(comp.name, { count: 0, amount: 0 })
        const item = map.get(comp.name)!
        item.count += 1
        item.amount += Number(r['中标金额(万)']) || 0
      }
    }
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount * 100) / 100 }))
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))
}

export function findAhWins(records: BidRecord[]): BidRecord[] {
  return records.filter(
    (r) =>
      (r.中标单位 || '').includes('安恒') ||
      (r.中标单位 || '').includes('杭州安恒') ||
      (r.匹配关键词 || '').includes('安恒')
  )
}

export function computeOverview(records: BidRecord[]) {
  const totalCount = records.length
  const totalBudget = records.reduce((sum, r) => sum + (Number(r['招标金额(万)']) || 0), 0)
  const totalAward = records.reduce((sum, r) => sum + (Number(r['中标金额(万)']) || 0), 0)
  const closedCount = records.filter((r) => Number(r['中标金额(万)']) > 0).length
  const ahWins = findAhWins(records)
  const avgBudget = totalCount ? totalBudget / totalCount : 0
  return {
    totalCount,
    totalBudget: Math.round(totalBudget * 100) / 100,
    totalAward: Math.round(totalAward * 100) / 100,
    closedCount,
    avgBudget: Math.round(avgBudget * 100) / 100,
    ahWinCount: ahWins.length,
    ahWinAmount: Math.round(ahWins.reduce((s, r) => s + (Number(r['中标金额(万)']) || 0), 0) * 100) / 100,
  }
}

export function generateDefaultReport(records: BidRecord[]): ReportSection[] {
  const overview = computeOverview(records)

  const regionData = aggregateBy(records, '城市', ['count', 'sumBudget', 'winRate'])
  const industryData = aggregateBy(records, '行业', ['count', 'sumBudget'])
  const trendData = aggregateTrend(records)
  const noticeTypeData = aggregateBy(records, '公告类型', ['count'])

  const buyerTypes = new Map<string, { count: number; amount: number }>()
  for (const r of records) {
    const type = classifyBuyerType(r.采购单位)
    if (!buyerTypes.has(type)) buyerTypes.set(type, { count: 0, amount: 0 })
    const item = buyerTypes.get(type)!
    item.count += 1
    item.amount += r['招标金额(万)'] || 0
  }
  const buyerTypeData = Array.from(buyerTypes.entries())
    .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount * 100) / 100 }))
    .sort((a, b) => (b.value || 0) - (a.value || 0))

  // 产品类型聚合（直接遍历，避免 spread 复制 4 万个对象）
  const prodMap = new Map<string, { count: number; amount: number }>()
  for (const r of records) {
    const cat = detectProductCategory(r.匹配关键词)
    const entry = prodMap.get(cat)
    if (entry) {
      entry.count += 1
      entry.amount += Number(r['招标金额(万)']) || 0
    } else {
      prodMap.set(cat, { count: 1, amount: Number(r['招标金额(万)']) || 0 })
    }
  }
  const productData: ChartData[] = Array.from(prodMap.entries())
    .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount * 100) / 100 }))
    .sort((a, b) => (b.amount || 0) - (a.amount || 0))

  const competitorData = detectCompetitors(records)

  const ahAdvantageRecords = records
    .map((r) => ({ ...r, _score: detectAhAdvantage(r.匹配关键词).score }))
    .sort((a, b) => b._score - a._score)
    .slice(0, 10)

  const partnerCandidates = records
    .filter((r) => r['中标金额(万)'] > 0 && !r.中标单位.includes('安恒'))
    .map((r) => r.中标单位)
  const partnerFreq = new Map<string, number>()
  for (const p of partnerCandidates) {
    partnerFreq.set(p, (partnerFreq.get(p) || 0) + 1)
  }
  const partnerData = Array.from(partnerFreq.entries())
    .map(([name, value]) => ({ name, value, amount: 0 }))
    .sort((a, b) => (b.value as number) - (a.value as number))
    .slice(0, 10)

  return [
    {
      title: '标讯总量与金额汇总',
      type: 'summary',
      description: `本次共分析 ${overview.totalCount} 条标讯，招标金额合计 ${overview.totalBudget.toFixed(2)} 万元，已公布中标金额 ${overview.totalAward.toFixed(2)} 万元，平均单标预算 ${overview.avgBudget.toFixed(2)} 万元。`,
      insights: [
        `已完结标讯 ${overview.closedCount} 条，占比 ${overview.totalCount ? Math.round((overview.closedCount / overview.totalCount) * 100) : 0}%。`,
        `安恒信息直接中标 ${overview.ahWinCount} 条，中标金额 ${overview.ahWinAmount.toFixed(2)} 万元。`,
        `建议重点关注预算高、未中标的潜在跟进项目。`,
      ],
    },
    {
      title: '区域市场热度排名与机会识别',
      type: 'bar',
      data: regionData,
      insights: regionData.slice(0, 3).map((r) => `${r.name} 标讯金额 ${(r.amount || 0).toFixed(2)} 万元，项目数 ${r.value} 个，是近期重点市场。`),
      suggestions: ['对 TOP3 城市增加售前资源投入', '重点关注未中标且金额大的项目'],
    },
    {
      title: '行业需求分布与垂直市场渗透',
      type: 'pie',
      data: industryData,
      insights: industryData.slice(0, 3).map((r) => `${r.name} 行业项目 ${r.value} 个，金额 ${(r.amount || 0).toFixed(2)} 万元，需求旺盛。`),
      suggestions: ['在医疗、政府、金融等优势行业打造标杆案例', '针对行业特点输出定制化方案'],
    },
    {
      title: '时间趋势与季节性规律',
      type: 'line',
      data: trendData,
      insights: trendData.length > 1
        ? [`${trendData[trendData.length - 1].name} 为数据截止月份，标讯量 ${trendData[trendData.length - 1].value} 条。`]
        : ['数据时间跨度有限，建议持续跟踪。'],
      suggestions: ['结合预算释放节奏提前布局', '关注季度末/年末采购高峰'],
    },
    {
      title: '采购单位类型占比',
      type: 'pie',
      data: buyerTypeData,
      insights: buyerTypeData.slice(0, 3).map((r) => `${r.name} 类型客户 ${r.value} 条，金额 ${(r.amount || 0).toFixed(2)} 万元。`),
      suggestions: ['政府与医疗客户预算稳定，应作为基本盘', '企业客户决策链短，适合快速推进'],
    },
    {
      title: '公告类型分布',
      type: 'pie',
      data: noticeTypeData,
      insights: noticeTypeData.slice(0, 3).map((r) => `${r.name} 类型公告 ${r.value} 条。`),
      suggestions: ['招标/预告类项目需提前介入', '成交/中标类项目关注竞争结果'],
    },
    {
      title: '产品类型占比',
      type: 'pie',
      data: productData,
      insights: productData.slice(0, 3).map((r) => `${r.name} 类项目 ${r.value} 个，金额 ${(r.amount || 0).toFixed(2)} 万元。`),
      suggestions: ['等保测评与网络安全运维是刚需入口', '数据安全与密码应用为增长机会'],
    },
    {
      title: '中标集中度与竞争格局',
      type: 'bar',
      data: competitorData,
      insights: competitorData.length
        ? [`${competitorData[0].name} 中标 ${competitorData[0].value} 次，金额 ${(competitorData[0].amount || 0).toFixed(2)} 万元，是主要竞争对手。`]
        : ['中标单位分散，竞争格局未定。'],
      suggestions: ['分析头部竞争对手报价与服务策略', '针对其薄弱产品线发起攻势'],
    },
    {
      title: '安恒优势领域识别',
      type: 'table',
      data: ahAdvantageRecords.map((r) => ({
        name: r.项目名称.slice(0, 30),
        value: r._score,
        amount: r['招标金额(万)'],
        industry: r.行业,
      })),
      insights: ['以下项目与安恒产品线匹配度高，建议优先跟进。'],
      suggestions: ['结合态势感知、数据安全、密码应用等优势方案推进'],
    },
    {
      title: '潜在合作伙伴推荐',
      type: 'table',
      data: partnerData,
      insights: ['以下中标单位多次出现，可作为渠道或合作对象。'],
      suggestions: ['建立合作关系，借助其客户资源扩大覆盖'],
    },
  ]
}

// ===== 自定义维度分析引擎 v2.0 =====

// ---------- ① 意图解析（多值 + 意图分类）----------

const REGION_MAP: Record<string, string> = {
  '浙江省': '浙江', '浙江': '浙江',
  '杭州市': '杭州', '杭州': '杭州',
  '宁波市': '宁波', '宁波': '宁波',
  '温州市': '温州', '温州': '温州',
  '绍兴市': '绍兴', '绍兴': '绍兴',
  '湖州市': '湖州', '湖州': '湖州',
  '嘉兴市': '嘉兴', '嘉兴': '嘉兴',
  '金华市': '金华', '金华': '金华',
  '台州市': '台州', '台州': '台州',
  '衢州市': '衢州', '衢州': '衢州',
  '舟山市': '舟山', '舟山': '舟山',
  '丽水市': '丽水', '丽水': '丽水',
}

const INDUSTRY_KEYWORDS = ['医疗', '政府', '金融', '教育', '运营商', '企业', '公安', '电力', '交通', '数据局', '网信', '油气', '政务', '法院', '检察院', '税务', '财政']
const PRODUCT_KEYWORDS = ['安全服务', '安全运营', '安全运维', '等保', '等保测评', '等级保护', '网络安全', '数据安全', '密码应用', '密评', '态势感知', '防火墙', 'WAF', '堡垒机', '日志审计', '数据库审计', '漏洞扫描', '终端安全', '零信任', '云安全', '入侵检测', '入侵防御', 'SOC', 'DLP', 'EDR', 'MSS']
const COMPETITOR_NAMES = ['天融信', '深信服', '奇安信', '启明星辰', '绿盟', '华为', '新华三', 'H3C', '中国电信', '中国移动', '中国联通', '中国软件', '安恒']

export function parseCustomQuery(text: string): ParsedIntent {
  const result: ParsedIntent = {
    regions: [],
    industries: [],
    timeRange: '',
    productTypes: [],
    intents: [],
    competitors: [],
    rawText: text,
  }

  // 地域解析（多值 — 抓"杭州和宁波""杭州、宁波、温州"）
  for (const [full, short] of Object.entries(REGION_MAP)) {
    if (text.includes(full)) {
      if (!result.regions.includes(short)) result.regions.push(short)
    }
  }
  // 如果没抓到具体城市但提到了"浙江省"，展开所有城市
  if (result.regions.includes('浙江') && result.regions.length === 1) {
    result.regions = [] // 全省=不限
  }

  // 行业解析（多值）
  for (const ind of INDUSTRY_KEYWORDS) {
    if (text.includes(ind) && !result.industries.includes(ind)) {
      result.industries.push(ind)
    }
  }

  // 时间范围
  const timePatterns: [RegExp, string][] = [
    [/近三个月|最近三个月|近3个月/, '近三个月'],
    [/近半年|最近半年|近6个月/, '近半年'],
    [/近一年|最近一年|近12个月/, '近一年'],
    [/本月|这个月/, '本月'],
    [/本季度|这个季度/, '本季度'],
  ]
  for (const [reg, val] of timePatterns) {
    if (reg.test(text)) { result.timeRange = val; break }
  }

  // 产品类型（多值）
  for (const p of PRODUCT_KEYWORDS) {
    if (text.includes(p) && !result.productTypes.includes(p)) {
      result.productTypes.push(p)
    }
  }

  // 竞对
  for (const c of COMPETITOR_NAMES) {
    if (text.includes(c) && !result.competitors.includes(c)) {
      result.competitors.push(c)
    }
  }

  // 意图分类（可多意图）
  const intentPatterns: [RegExp, AnalysisIntent][] = [
    [/竞争|竞对|格局|份额|对手|胜率|输赢/, 'competition'],
    [/机会|商机|中标|跟进|切入|拓展/, 'opportunity'],
    [/趋势|增长|季节|规律|周期|变化/, 'trend'],
    [/客户|采购单位|甲方|买方|需求|画像/, 'customer'],
    [/预算|金额|价格|价位|规模|万元/, 'budget'],
  ]
  for (const [reg, intent] of intentPatterns) {
    if (reg.test(text) && !result.intents.includes(intent)) {
      result.intents.push(intent)
    }
  }
  if (result.intents.length === 0) result.intents = ['comprehensive']

  return result
}

// ---------- ② 多维过滤 ——————

export function filterByDimensions(records: BidRecord[], dims: CustomQuery['dimensions']): BidRecord[] {
  let result = [...records]
  if (dims.region) {
    result = result.filter((r) => r.省份.includes(dims.region!) || r.城市.includes(dims.region!))
  }
  if (dims.industry) {
    result = result.filter((r) => r.行业 === dims.industry || r.二级行业 === dims.industry)
  }
  if (dims.productType) {
    result = result.filter((r) => r.匹配关键词.includes(dims.productType!))
  }
  if (dims.timeRange) {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    let start = ''
    switch (dims.timeRange) {
      case '近三个月': start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10); break
      case '近半年': start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10); break
      case '近一年': start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10); break
      case '本月': start = `${today.slice(0, 8)}01`; break
      case '本季度': { const q = Math.floor(now.getMonth() / 3); start = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`; break }
    }
    if (start) result = result.filter((r) => !r.发布日期 || r.发布日期 >= start)
  }
  return result
}

// ---------- ③ 深度分析函数 ——————

/** 按意向多维度过滤（兼容 ParsedIntent） */
function filterByIntent(records: BidRecord[], intent: ParsedIntent): BidRecord[] {
  let result = [...records]
  if (intent.regions.length) {
    result = result.filter((r) => intent.regions.some((reg) => r.省份.includes(reg) || r.城市.includes(reg)))
  }
  if (intent.industries.length) {
    result = result.filter((r) => intent.industries.some((ind) => r.行业 === ind || r.二级行业 === ind))
  }
  if (intent.productTypes.length) {
    result = result.filter((r) => intent.productTypes.some((p) => r.匹配关键词.includes(p)))
  }
  if (intent.timeRange) {
    const now = new Date()
    const today = now.toISOString().slice(0, 10)
    let start = ''
    switch (intent.timeRange) {
      case '近三个月': start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10); break
      case '近半年': start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10); break
      case '近一年': start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10); break
      case '本月': start = `${today.slice(0, 8)}01`; break
      case '本季度': { const q = Math.floor(now.getMonth() / 3); start = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`; break }
    }
    if (start) result = result.filter((r) => !r.发布日期 || r.发布日期 >= start)
  }
  return result
}

function num(v: unknown): number { return Number(v) || 0 }

/** 客户分级（ABCD）— 接受预分组 Map 以避免重复 filter */
function classifyBuyerTierFast(buyerRecords: BidRecord[]): { tier: 'A' | 'B' | 'C' | 'D'; freq: number; totalBudget: number; lastSeen: string; categories: string[] } {
  const freq = buyerRecords.length
  const totalBudget = buyerRecords.reduce((s, r) => s + num(r['招标金额(万)']), 0)
  const dates = buyerRecords.map((r) => r.发布日期).filter(Boolean).sort().reverse()
  const lastSeen = dates[0] || ''
  const categories = [...new Set(buyerRecords.map((r) => detectProductCategory(r.匹配关键词)))]
  let tier: 'A' | 'B' | 'C' | 'D' = 'D'
  if (freq >= 3 && totalBudget >= 200) tier = 'A'
  else if (freq >= 2 && totalBudget >= 100) tier = 'B'
  else if (freq >= 2 || totalBudget >= 50) tier = 'C'
  return { tier, freq, totalBudget, lastSeen, categories }
}

/** 保留旧签名向后兼容 */
function classifyBuyerTier(records: BidRecord[], unit: string): { tier: 'A' | 'B' | 'C' | 'D'; freq: number; totalBudget: number; lastSeen: string; categories: string[] } {
  const buyerRecords = records.filter((r) => r.采购单位 === unit)
  return classifyBuyerTierFast(buyerRecords)
}

/** 价位段分布 */
function budgetTierAnalysis(records: BidRecord[]) {
  const tiers = [
    { label: '小型(<50万)', min: 0, max: 50 },
    { label: '中型(50-200万)', min: 50, max: 200 },
    { label: '大型(200-500万)', min: 200, max: 500 },
    { label: '特大型(>500万)', min: 500, max: Infinity },
  ]
  return tiers.map((t) => {
    const subset = records.filter((r) => num(r['招标金额(万)']) >= t.min && num(r['招标金额(万)']) < t.max)
    const ahWins = findAhWins(subset)
    return {
      name: t.label,
      count: subset.length,
      amount: Math.round(subset.reduce((s, r) => s + num(r['招标金额(万)']), 0) * 100) / 100,
      ahWinCount: ahWins.length,
      ahWinRate: subset.length ? Math.round((ahWins.length / subset.length) * 100) : 0,
    }
  })
}

/** 竞对交叉矩阵：竞对×品类 — O(n) 单次遍历版 */
function competitorProductMatrix(records: BidRecord[]) {
  const closed = records.filter((r) => num(r['中标金额(万)']) > 0)
  // key = "竞对名|品类名", value = { wins, amount }
  const cellMap = new Map<string, { wins: number; amount: number }>()

  for (const r of closed) {
    const cat = detectProductCategory(r.匹配关键词)
    let compName = ''
    for (const ck of competitorKeywords) {
      if ((ck.alias || [ck.name]).some((a) => r.中标单位.includes(a))) {
        compName = ck.name
        break
      }
    }
    if (!compName) continue
    const key = `${compName}|${cat}`
    const cell = cellMap.get(key)
    if (cell) {
      cell.wins += 1
      cell.amount += num(r['中标金额(万)'])
    } else {
      cellMap.set(key, { wins: 1, amount: num(r['中标金额(万)']) })
    }
  }

  return Array.from(cellMap.entries())
    .map(([key, v]) => {
      const [competitor, category] = key.split('|')
      return { competitor, category, wins: v.wins, amount: Math.round(v.amount * 100) / 100 }
    })
    .sort((a, b) => b.wins - a.wins)
}

/** 安恒产品匹配 + 推荐 */
function matchAhProductsToBids(records: BidRecord[]) {
  return records.map((r) => {
    const matched = ahProducts.filter((p) => p.keywords.some((k) => r.匹配关键词.includes(k)))
    const primary = matched.slice(0, 2)
    return {
      ...r,
      _ahMatched: primary.map((m) => m.name),
      _ahScore: matched.length,
    }
  })
}

/** 生成 SWOT */
function generateSWOT(records: BidRecord[], _intent: ParsedIntent): { strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] } {
  const overview = computeOverview(records)
  const wl = winLossMatrix(records)
  const cards = competitorBattleCards(records)

  const strengths: string[] = []
  const weaknesses: string[] = []
  const opportunities: string[] = []
  const threats: string[] = []

  // 优势
  const bestProduct = wl.byProduct.find((m) => m.winRate >= 30 && m.total >= 3)
  if (bestProduct) strengths.push(`${bestProduct.dimension}品类安恒胜率${bestProduct.winRate}%，是核心优势领域`)
  if (overview.ahWinCount >= 5) strengths.push(`已中标${overview.ahWinCount}个项目，累计${overview.ahWinAmount.toFixed(0)}万元，市场存在感强`)
  const highMatch = matchAhProductsToBids(records).filter((r) => r._ahScore >= 3).length
  if (highMatch >= 5) strengths.push(`${highMatch}条标讯与安恒产品线高度匹配，市场对口需求旺盛`)
  if (overview.avgBudget > 80) strengths.push(`平均单标预算${overview.avgBudget.toFixed(1)}万元，项目规模适合安恒价格定位`)

  // 劣势
  const worstProduct = wl.byProduct.find((m) => m.total >= 3 && m.winRate <= 15)
  if (worstProduct) weaknesses.push(`${worstProduct.dimension}品类胜率仅${worstProduct.winRate}%，需强化方案或渠道覆盖`)
  const allCompCards = cards.filter((c) => c.winCount >= overview.closedCount * 0.2)
  if (allCompCards.length) weaknesses.push(`${allCompCards.map((c) => c.name).join('、')}在该市场占有较大份额，安恒渗透不足`)

  // 机会
  const unassigned = records.filter((r) => num(r['中标金额(万)']) === 0 && num(r['招标金额(万)']) >= 50)
  if (unassigned.length) opportunities.push(`${unassigned.length}条待定标项目（预算≥50万）可跟进，总预算${unassigned.reduce((s, r) => s + num(r['招标金额(万)']), 0).toFixed(0)}万元`)
  const topBuyerType = (() => {
    const btMap = new Map<string, { count: number; amount: number }>()
    for (const r of records) {
      const bt = classifyBuyerType(r.采购单位)
      const e = btMap.get(bt)
      if (e) { e.count += 1; e.amount += num(r['招标金额(万)']) }
      else btMap.set(bt, { count: 1, amount: num(r['招标金额(万)']) })
    }
    const sorted = Array.from(btMap.entries())
      .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount * 100) / 100 }))
      .sort((a, b) => (b.value || 0) - (a.value || 0))
    return sorted[0]
  })()
  if (topBuyerType) opportunities.push(`${topBuyerType.name}类客户是最大需求方（${topBuyerType.value}条/${(topBuyerType.amount || 0).toFixed(0)}万元），可重点深耕`)

  // 威胁
  if (cards.length >= 2) {
    const top2 = cards.slice(0, 2)
    threats.push(`${top2.map((c) => `${c.name}(${c.winCount}次中标/份额${c.winRate}%)`).join('、')}是最主要竞争对手`)
  }
  const largeBids = records.filter((r) => num(r['招标金额(万)']) >= 500 && num(r['中标金额(万)']) === 0)
  if (largeBids.length >= 2) threats.push(`${largeBids.length}个超大型项目（≥500万）尚未定标，竞争将非常激烈`)

  return { strengths, weaknesses, opportunities, threats }
}

/** 生成行动清单 */
function generateActionList(records: BidRecord[], intent: ParsedIntent): string[] {
  const actions: string[] = []

  // 商机跟进
  if (intent.intents.includes('opportunity') || intent.intents.includes('comprehensive')) {
    const radar = generateRadarBids(records, 3)
    radar.forEach((r, i) => {
      actions.push(`【P${i + 1}】跟进「${r.record.项目名称.slice(0, 20)}」（${r.record.采购单位.slice(0, 12)}，预算${num(r.record['招标金额(万)']).toFixed(0)}万元，${r.reason}）`)
    })
  }

  // 竞对应对
  if (intent.intents.includes('competition') || intent.intents.includes('comprehensive')) {
    const cards = competitorBattleCards(records).slice(0, 2)
    cards.forEach((c) => {
      actions.push(`【竞对】针对${c.name}：${c.strategy}`)
    })
  }

  // 客户触达
  const buyers = [...new Set(records.filter((r) => num(r['中标金额(万)']) === 0).map((r) => r.采购单位))].slice(0, 3)
  buyers.forEach((b) => {
    const records_ = records.filter((r) => r.采购单位 === b)
    const totalBudget = records_.reduce((s, r) => s + num(r['招标金额(万)']), 0)
    actions.push(`【客户】联系${b.slice(0, 10)}（累计预算${totalBudget.toFixed(0)}万元，标讯${records_.length}条）`)
  })

  return actions
}

// ---------- ④ 意图驱动报告生成器 ——————

export function generateCustomReport(records: BidRecord[], text: string): ReportSection[] {
  const intent = parseCustomQuery(text)
  const filtered = filterByIntent(records, intent)
  const overview = computeOverview(filtered)
  const sections: ReportSection[] = []

  // 维度标签
  const dimLabels: string[] = []
  if (intent.regions.length) dimLabels.push(`地域：${intent.regions.join('、')}`)
  if (intent.industries.length) dimLabels.push(`行业：${intent.industries.join('、')}`)
  if (intent.timeRange) dimLabels.push(`时间：${intent.timeRange}`)
  if (intent.productTypes.length) dimLabels.push(`产品：${intent.productTypes.join('、')}`)
  const intentLabels: Record<string, string> = {
    competition: '竞争格局', opportunity: '机会识别', trend: '趋势分析',
    customer: '客户画像', budget: '预算规模', comprehensive: '综合评估',
  }
  dimLabels.push(`意图：${intent.intents.map((i) => intentLabels[i] || i).join(' + ')}`)

  sections.push({
    title: '查询意图解析',
    type: 'text',
    description: dimLabels.join('\n'),
    insights: [`命中标讯 ${filtered.length} 条（全量 ${records.length} 条），以下为定向深度分析。`],
  })

  // 1. 市场概览仪表盘（所有意图都输出）
  sections.push({
    title: '定向市场概览仪表盘',
    type: 'summary',
    description: `招标金额合计 ${overview.totalBudget.toFixed(2)} 万元，已公布中标 ${overview.totalAward.toFixed(2)} 万元，平均单标预算 ${overview.avgBudget.toFixed(2)} 万元。`,
    insights: [
      `标讯总量 ${overview.totalCount} 条，已完结 ${overview.closedCount} 条（完结率 ${overview.totalCount ? Math.round((overview.closedCount / overview.totalCount) * 100) : 0}%）。`,
      `安恒信息直接中标 ${overview.ahWinCount} 条，中标金额 ${overview.ahWinAmount.toFixed(0)} 万元（份额 ${overview.totalAward ? Math.round((overview.ahWinAmount / overview.totalAward) * 100) : 0}%）。`,
      `市场可跟进空间约 ${(overview.totalBudget - overview.totalAward).toFixed(0)} 万元。`,
    ],
  })

  // 2. 价位段分层分析（budget/comprehensive）
  if (intent.intents.includes('budget') || intent.intents.includes('comprehensive')) {
    const tiers = budgetTierAnalysis(filtered)
    sections.push({
      title: '价位段分层分析',
      type: 'table',
      data: tiers.map((t) => ({
        name: t.name,
        标讯数: t.count,
        预算总额万元: Math.round(t.amount),
        安恒中标: t.ahWinCount,
        安恒胜率: `${t.ahWinRate}%`,
      })),
      insights: tiers.filter((t) => t.count > 0).slice(0, 2).map((t) =>
        `${t.name}项目 ${t.count} 个，安恒在该价位段胜率 ${t.ahWinRate}%，${t.ahWinRate >= 30 ? '应重点投入' : '需评估竞争策略'}。`
      ),
      suggestions: [
        tiers.find((t) => t.ahWinRate >= 30 && t.count >= 2)
          ? `安恒在${tiers.find((t) => t.ahWinRate >= 30 && t.count >= 2)!.name}价位段有优势，建议优先投入`
          : '建议在50-200万中型项目中建立标杆案例',
      ],
    })
  }

  // 3. 竞争格局深度分析（competition/comprehensive）
  if (intent.intents.includes('competition') || intent.intents.includes('comprehensive')) {
    const compData = detectCompetitors(filtered)
    if (compData.length) {
      sections.push({
        title: '竞对中标份额分析',
        type: 'bar',
        data: compData,
        insights: compData.slice(0, 3).map((c) =>
          `${c.name} 中标 ${c.value} 次，金额 ${(c.amount || 0).toFixed(0)} 万元，${c === compData[0] ? '是当前市场最大竞争者' : '需持续关注'}。`
        ),
        suggestions: [
          `分析${compData[0]?.name || '头部竞对'}的报价与方案策略，寻找差异化突破口`,
          '结合安恒态势感知、数据安全等优势产品发起正面竞争',
        ],
      })

      // 竞对×品类交叉矩阵
      const crossMatrix = competitorProductMatrix(filtered)
      if (crossMatrix.length >= 3) {
        sections.push({
          title: '竞对×品类交叉矩阵',
          type: 'table',
          data: crossMatrix.slice(0, 15).map((m) => ({
            竞对: m.competitor,
            品类: m.category,
            中标次数: m.wins,
            中标金额万元: m.amount,
          })),
          insights: crossMatrix.slice(0, 3).map((m) =>
            `${m.competitor} 在「${m.category}」品类中标 ${m.wins} 次/${m.amount.toFixed(0)}万元，${m.wins >= 3 ? '是该品类强势竞争者' : '存在竞争空间'}。`
          ),
          suggestions: ['针对竞对薄弱的品类集中资源突破', '在竞对强势品类避免价格战，改用方案差异化'],
        })
      }

      // 竞对作战卡
      const cards = competitorBattleCards(filtered)
      if (cards.length) {
        cards.slice(0, 3).forEach((card) => {
          sections.push({
            title: `竞对作战卡：${card.name}`,
            type: 'text',
            description: [
              `中标次数：${card.winCount} 次 | 中标总额：${card.winAmount.toFixed(0)} 万元 | 均价：${card.avgBidSize.toFixed(0)} 万元`,
              `市场份额：${card.winRate}%`,
              `优势行业：${card.topIndustries.map((i) => `${i.name}(${i.count}次)`).join('、')}`,
              `优势品类：${card.topProducts.map((i) => `${i.name}(${i.count}次)`).join('、')}`,
              `主要城市：${card.topCities.map((i) => `${i.name}(${i.count}次)`).join('、')}`,
            ].join('<br/>'),
            insights: [`📋 反制策略：${card.strategy}`],
          })
        })
      }
    }
  }

  // 4. 商机雷达（opportunity/comprehensive）
  if (intent.intents.includes('opportunity') || intent.intents.includes('comprehensive')) {
    const radar = generateRadarBids(filtered, 8)
    if (radar.length) {
      sections.push({
        title: '高价值商机雷达 TOP8',
        type: 'table',
        data: radar.map((r) => ({
          评分: r.score,
          项目: r.record.项目名称.slice(0, 30),
          采购单位: r.record.采购单位.slice(0, 16),
          预算万: Number(r.record['招标金额(万)']),
          行业: r.record.行业,
          城市: r.record.城市,
          推荐理由: r.reason.slice(0, 40),
        })),
        insights: radar.slice(0, 3).map((r) =>
          `TOP${radar.indexOf(r) + 1}：${r.record.项目名称.slice(0, 24)}（评分${r.score}）— ${r.reason}`
        ),
        suggestions: ['按评分从高到低依次触达采购单位', '提前准备定制化方案与产品演示'],
      })
    }

    // 安恒产品线匹配
    const matched = matchAhProductsToBids(filtered).filter((r) => r._ahMatched.length > 0)
    if (matched.length) {
      const productRecs: Record<string, number> = {}
      matched.forEach((r) => {
        r._ahMatched.forEach((p) => { productRecs[p] = (productRecs[p] || 0) + 1 })
      })
      const topProducts = Object.entries(productRecs).sort((a, b) => b[1] - a[1]).slice(0, 8)
      sections.push({
        title: '安恒产品线匹配热度',
        type: 'bar',
        data: topProducts.map(([name, count]) => ({ name, value: count })),
        insights: topProducts.slice(0, 3).map(([name, count]) =>
          `「${name}」在该市场匹配 ${count} 次，${count >= 3 ? '为重点推荐产品' : '可作为增值搭配推荐'}。`
        ),
        suggestions: ['优先推荐匹配次数最高的产品作为主力方案', '将高频搭配产品打包为行业解决方案包'],
      })
    }
  }

  // 5. 客户画像（customer/comprehensive）
  if (intent.intents.includes('customer') || intent.intents.includes('comprehensive')) {
    const buyerTypeData: ChartData[] = (() => {
      const btMap = new Map<string, { count: number; amount: number }>()
      for (const r of filtered) {
        const bt = classifyBuyerType(r.采购单位)
        const e = btMap.get(bt)
        if (e) { e.count += 1; e.amount += num(r['招标金额(万)']) }
        else btMap.set(bt, { count: 1, amount: num(r['招标金额(万)']) })
      }
      return Array.from(btMap.entries())
        .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount * 100) / 100 }))
        .sort((a, b) => (b.value || 0) - (a.value || 0))
    })()
    sections.push({
      title: '采购单位类型分布',
      type: 'pie',
      data: buyerTypeData,
      insights: buyerTypeData.slice(0, 3).map((r) =>
        `${r.name}类客户 ${r.value} 条，预算 ${(r.amount || 0).toFixed(0)} 万元`
      ),
    })

    // 客户分级（预分组，避免每条 buyer 重复 filter 全量数据）
    const buyerMap = new Map<string, BidRecord[]>()
    for (const r of records) {
      const unit = r.采购单位
      if (!unit) continue
      if (!buyerMap.has(unit)) buyerMap.set(unit, [])
      buyerMap.get(unit)!.push(r)
    }
    const filteredBuyers = [...new Set(filtered.map((r) => r.采购单位))].filter(Boolean)
    const tiers = filteredBuyers.map((u) => ({ unit: u, ...classifyBuyerTierFast(buyerMap.get(u) || []) }))
    const aList = tiers.filter((t) => t.tier === 'A')
    const bList = tiers.filter((t) => t.tier === 'B')
    if (aList.length + bList.length > 0) {
      sections.push({
        title: '高价值客户分级（A/B类）',
        type: 'table',
        data: [...aList, ...bList].slice(0, 10).map((t) => ({
          等级: t.tier,
          采购单位: t.unit.slice(0, 20),
          采购次数: t.freq,
          累计预算万: Math.round(t.totalBudget),
          常用品类: t.categories.join('、'),
          最近采购: t.lastSeen,
        })),
        insights: [
          `A类客户 ${aList.length} 家（高频大额），B类客户 ${bList.length} 家（中频中额），建议优先维护。`,
        ],
        suggestions: ['A类客户建立定期拜访机制', 'B类客户挖掘交叉销售机会'],
      })
    }
  }

  // 6. 趋势分析（trend/comprehensive）
  if (intent.intents.includes('trend') || intent.intents.includes('comprehensive')) {
    const trend = aggregateTrend(filtered)
    sections.push({
      title: '时间趋势与市场节奏',
      type: 'line',
      data: trend,
      insights: (() => {
        if (trend.length >= 2) {
          const last = trend[trend.length - 1]
          const prev = trend[trend.length - 2]
          const dir = last.value !== undefined && prev.value !== undefined && last.value > prev.value ? '环比上升' : '环比下降'
          return [`${last.name}月标讯量 ${last.value} 条，${dir}。`]
        }
        return ['数据时间跨度有限，建议持续积累。']
      })(),
      suggestions: ['结合采购周期规律，在淡季提前做客户关系维护', '预算释放高峰前1-2个月启动方案准备'],
    })
  }

  // 7. 区域/行业分布
  if (filtered.length >= 5) {
    if (intent.regions.length === 0 || intent.regions.length > 2) {
      sections.push({
        title: '区域分布',
        type: 'bar',
        data: aggregateBy(filtered, '城市', ['count', 'sumBudget']),
      })
    }
    if (intent.industries.length === 0 || intent.industries.length > 2) {
      sections.push({
        title: '行业分布',
        type: 'pie',
        data: aggregateBy(filtered, '行业', ['count', 'sumBudget']),
      })
    }
  }

  // 8. SWOT 总结
  const swot = generateSWOT(filtered, intent)
  sections.push({
    title: 'SWOT 战略评估',
    type: 'text',
    description: [
      `✅ <strong>优势</strong>：${swot.strengths.length ? swot.strengths.join('；') : '暂无明显优势区域'}`,
      `⚠️ <strong>劣势</strong>：${swot.weaknesses.length ? swot.weaknesses.join('；') : '暂未识别明显劣势'}`,
      `🚀 <strong>机会</strong>：${swot.opportunities.length ? swot.opportunities.join('；') : '暂无明确机会信号'}`,
      `🔴 <strong>威胁</strong>：${swot.threats.length ? swot.threats.join('；') : '未检测到重大威胁'}`,
    ].join('\n'),
  })

  // 9. 本周行动清单
  const actions = generateActionList(filtered, intent)
  if (actions.length) {
    sections.push({
      title: '本周行动清单',
      type: 'text',
      description: actions.map((a) => `• ${a}`).join('\n'),
      suggestions: ['以上行动按优先级排序，建议按顺序逐一推进'],
    })
  }

  return sections
}

// ===== P0-1: 商机雷达 + 智能评分（O(n) 优化版）=====

function clampScore(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** 预计算统计 — 全量 O(n) 一次遍历，无数组存储 */
interface ScoringStats {
  maxBudget: number
  maxAdvScore: number
  buyerCounts: Map<string, number>
  /** key=行业, value={已完结数, 竞对中标数} */
  industryStats: Map<string, { closed: number; compWins: number }>
}

function precomputeScoringStats(records: BidRecord[]): ScoringStats {
  let maxBudget = 1
  let maxAdvScore = 1
  const buyerCounts = new Map<string, number>()
  const industryStats = new Map<string, { closed: number; compWins: number }>()

  for (const r of records) {
    const b = Number(r['招标金额(万)']) || 0
    if (b > maxBudget) maxBudget = b
    const adv = detectAhAdvantage(r.匹配关键词).score
    if (adv > maxAdvScore) maxAdvScore = adv

    const buyer = r.采购单位
    buyerCounts.set(buyer, (buyerCounts.get(buyer) || 0) + 1)

    const ind = r.行业
    if (!industryStats.has(ind)) industryStats.set(ind, { closed: 0, compWins: 0 })
    const stat = industryStats.get(ind)!
    if (Number(r['中标金额(万)']) > 0) {
      stat.closed += 1
      // 判断是否竞对中标
      const winner = r.中标单位
      if (competitorKeywords.some((c) => (c.alias || [c.name]).some((a) => winner.includes(a)))) {
        stat.compWins += 1
      }
    }
  }

  return { maxBudget, maxAdvScore, buyerCounts, industryStats }
}

function scoreBidFast(r: BidRecord, stats: ScoringStats): ScoredBid {
  const budget = Number(r['招标金额(万)']) || 0

  // 1. 预算规模评分 (25%)
  const budgetScore = clampScore(
    Math.round((Math.log(budget + 1) / Math.log(stats.maxBudget + 1)) * 25), 0, 25
  )

  // 2. AH产品匹配度评分 (30%)
  const advResult = detectAhAdvantage(r.匹配关键词)
  const productScore = clampScore(
    Math.round((advResult.score / stats.maxAdvScore) * 30), 0, 30
  )

  // 3. 竞对薄弱度评分 (15%) — 直接读预计算计数，O(1)
  const indStat = stats.industryStats.get(r.行业)
  const indClosed = indStat?.closed ?? 0
  const indCompWins = indStat?.compWins ?? 0
  const compDensity = indClosed > 0 ? indCompWins / indClosed : 0
  const competitorScore = clampScore(Math.round((1 - compDensity) * 15), 0, 15)

  // 4. 时机紧迫度评分 (15%)
  let timingScore = 7
  if (r.开标日期) {
    const now = new Date()
    const opening = new Date(r.开标日期)
    const daysLeft = Math.ceil((opening.getTime() - now.getTime()) / 86400000)
    if (daysLeft <= 0) timingScore = 0
    else if (daysLeft <= 7) timingScore = 5
    else if (daysLeft <= 30) timingScore = 15
    else if (daysLeft <= 60) timingScore = 10
    else timingScore = 5
  }
  timingScore = clampScore(timingScore, 0, 15)

  // 5. 采购方画像评分 (15%)
  const buyerType = classifyBuyerType(r.采购单位)
  const buyerAppearances = stats.buyerCounts.get(r.采购单位) || 0
  let buyerScore = 0
  if (buyerType === '政府' || buyerType === '金融') buyerScore = 12
  else if (buyerType === '医疗' || buyerType === '教育') buyerScore = 10
  else if (buyerType === '企业') buyerScore = 8
  else buyerScore = 5
  if (buyerAppearances <= 2) buyerScore += 3
  buyerScore = clampScore(buyerScore, 0, 15)

  const totalScore = budgetScore + productScore + competitorScore + timingScore + buyerScore

  const reasonParts: string[] = []
  if (budget > 100) reasonParts.push(`预算${budget.toFixed(0)}万为大单`)
  else if (budget > 30) reasonParts.push(`预算${budget.toFixed(0)}万合理区间`)
  if (advResult.matched.length >= 3) reasonParts.push(`匹配${advResult.matched.slice(0, 3).join('/')}`)
  if (competitorScore >= 12) reasonParts.push(`${r.行业}行业竞争空白`)
  if (r.开标日期) reasonParts.push(`距开标${Math.ceil((new Date(r.开标日期).getTime() - Date.now()) / 86400000)}天`)
  if (buyerType === '政府' || buyerType === '金融') reasonParts.push(`${buyerType}客户预算稳定`)

  return {
    record: r,
    score: totalScore,
    maxScore: 100,
    details: { budgetScore, productScore, competitorScore, timingScore, buyerScore },
    reason: reasonParts.join('，'),
  }
}

/** 保留旧签名向后兼容 — 但内部用快速路径 */
export function scoreBid(r: BidRecord, allRecords: BidRecord[]): ScoredBid {
  return scoreBidFast(r, precomputeScoringStats(allRecords))
}

export function generateRadarBids(records: BidRecord[], topN = 10): ScoredBid[] {
  if (records.length === 0) return []
  // 预计算全局统计（1 次 O(n) 遍历）
  const stats = precomputeScoringStats(records)
  // 批量评分（每笔 O(1) Map 查询）
  return records
    .map((r) => scoreBidFast(r, stats))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}

// ===== P0-2: 胜负归因 + 竞对作战卡 =====

export function winLossMatrix(records: BidRecord[]): {
  byProduct: WinLossMatrix[]
  byBudgetTier: WinLossMatrix[]
  byIndustry: WinLossMatrix[]
  byCity: WinLossMatrix[]
} {
  const closed = records.filter((r) => Number(r['中标金额(万)']) > 0)
  const ahWon = findAhWins(closed)
  const ahWonSet = new Set(ahWon.map((w) => w.唯一id))

  function computeMatrix(
    items: { key: string; subset: BidRecord[] }[]
  ): WinLossMatrix[] {
    return items
      .map(({ key, subset }) => {
        const wins = subset.filter((r) => ahWonSet.has(r.唯一id))
        const total = subset.length
        return {
          dimension: key,
          ahWins: wins.length,
          ahAmount: Math.round(wins.reduce((s, r) => s + (Number(r['中标金额(万)']) || 0), 0) * 100) / 100,
          total,
          totalAmount: Math.round(subset.reduce((s, r) => s + (Number(r['中标金额(万)']) || 0), 0) * 100) / 100,
          winRate: total > 0 ? Math.round((wins.length / total) * 100) : 0,
        }
      })
      .sort((a, b) => b.total - a.total)
  }

  // 按产品类型
  const byProductMap = new Map<string, BidRecord[]>()
  for (const r of closed) {
    const cat = detectProductCategory(r.匹配关键词)
    if (!byProductMap.has(cat)) byProductMap.set(cat, [])
    byProductMap.get(cat)!.push(r)
  }

  // 按价位段
  const tiers = [
    { key: '小型(<50万)', min: 0, max: 50 },
    { key: '中型(50-200万)', min: 50, max: 200 },
    { key: '大型(200-500万)', min: 200, max: 500 },
    { key: '特大型(>500万)', min: 500, max: Infinity },
  ]
  const byTier = tiers.map((t) => ({
    key: t.key,
    subset: closed.filter((r) => r['招标金额(万)'] >= t.min && r['招标金额(万)'] < t.max),
  }))

  // 按行业
  const byIndustryMap = new Map<string, BidRecord[]>()
  for (const r of closed) {
    if (!byIndustryMap.has(r.行业)) byIndustryMap.set(r.行业, [])
    byIndustryMap.get(r.行业)!.push(r)
  }

  // 按城市
  const byCityMap = new Map<string, BidRecord[]>()
  for (const r of closed) {
    if (!byCityMap.has(r.城市)) byCityMap.set(r.城市, [])
    byCityMap.get(r.城市)!.push(r)
  }

  return {
    byProduct: computeMatrix(
      Array.from(byProductMap.entries()).map(([k, v]) => ({ key: k, subset: v }))
    ),
    byBudgetTier: computeMatrix(byTier),
    byIndustry: computeMatrix(
      Array.from(byIndustryMap.entries()).map(([k, v]) => ({ key: k, subset: v }))
    ),
    byCity: computeMatrix(
      Array.from(byCityMap.entries()).map(([k, v]) => ({ key: k, subset: v }))
    ),
  }
}

export function competitorBattleCards(records: BidRecord[]): CompetitorCard[] {
  const closed = records.filter((r) => Number(r['中标金额(万)']) > 0)
  const allCompWins = new Map<string, BidRecord[]>()
  for (const r of closed) {
    if (!r.中标单位) continue
    for (const ck of competitorKeywords) {
      const aliases = ck.alias || [ck.name]
      if (aliases.some((a) => r.中标单位.includes(a))) {
        if (!allCompWins.has(ck.name)) allCompWins.set(ck.name, [])
        allCompWins.get(ck.name)!.push(r)
        break
      }
    }
  }

  const cards: CompetitorCard[] = []
  for (const [name, wins] of allCompWins) {
    if (wins.length < 2) continue

    // 行业分布
    const indMap = new Map<string, number>()
    const cityMap = new Map<string, number>()
    const prodMap = new Map<string, number>()
    for (const w of wins) {
      indMap.set(w.行业, (indMap.get(w.行业) || 0) + 1)
      cityMap.set(w.城市, (cityMap.get(w.城市) || 0) + 1)
      const cat = detectProductCategory(w.匹配关键词)
      prodMap.set(cat, (prodMap.get(cat) || 0) + 1)
    }
    const topInd = Array.from(indMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => ({ name: n, count: c }))
    const topCity = Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => ({ name: n, count: c }))
    const topProd = Array.from(prodMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n, c]) => ({ name: n, count: c }))

    const totalAmount = wins.reduce((s, r) => s + (Number(r['中标金额(万)']) || 0), 0)
    const avgSize = wins.length > 0 ? Math.round((totalAmount / wins.length) * 100) / 100 : 0

    // 生成反制策略（基于竞对画像 + 实际数据）
    const profile = competitorProfiles[name]
    const strategyParts: string[] = []

    if (profile) {
      const ahCanFight = ahProducts.filter((p) =>
        !profile.coreProducts.some((cp) =>
          p.keywords.some((k) => k.includes(cp))
        )
      )
      const uniqueAh = ahCanFight.slice(0, 2).map((p) => p.name)
      if (uniqueAh.length) {
        strategyParts.push(`用${uniqueAh.join('/')}差异化竞争（非${name}核心产品）`)
      }
      strategyParts.push(`避开${profile.typicalPriceRange[0]}-${profile.typicalPriceRange[1]}万区间`)
      if (profile.weaknesses[0]) strategyParts.push(profile.weaknesses[0])
    }

    if (topInd.length) {
      strategyParts.push(`${topInd[0].name}行业正面交锋密度最高，建议提前布局客户关系`)
    }

    cards.push({
      name,
      winCount: wins.length,
      winAmount: Math.round(totalAmount * 100) / 100,
      avgBidSize: avgSize,
      topIndustries: topInd,
      topCities: topCity,
      topProducts: topProd,
      winRate: closed.length > 0 ? Math.round((wins.length / closed.length) * 100) : 0,
      strategy: strategyParts.join('；'),
    })
  }

  return cards.sort((a, b) => b.winCount - a.winCount)
}
