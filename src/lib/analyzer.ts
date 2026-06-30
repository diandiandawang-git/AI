import type { BidRecord, FilterState, ReportSection, CustomQuery, ChartData } from '../types'
import { productCategories, competitorKeywords, advantageKeywords } from './ahProducts'

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
    item.amount += r['招标金额(万)'] || 0
    item.award += r['中标金额(万)'] || 0
    if (r['中标金额(万)'] > 0) item.winCount += 1
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
    item.amount += r['招标金额(万)'] || 0
    item.award += r['中标金额(万)'] || 0
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
        item.amount += r['中标金额(万)'] || 0
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
      r.中标单位.includes('安恒') ||
      r.中标单位.includes('杭州安恒') ||
      r.匹配关键词.includes('安恒')
  )
}

export function computeOverview(records: BidRecord[]) {
  const totalCount = records.length
  const totalBudget = records.reduce((sum, r) => sum + (r['招标金额(万)'] || 0), 0)
  const totalAward = records.reduce((sum, r) => sum + (r['中标金额(万)'] || 0), 0)
  const closedCount = records.filter((r) => r['中标金额(万)'] > 0).length
  const ahWins = findAhWins(records)
  const avgBudget = totalCount ? totalBudget / totalCount : 0
  return {
    totalCount,
    totalBudget: Math.round(totalBudget * 100) / 100,
    totalAward: Math.round(totalAward * 100) / 100,
    closedCount,
    avgBudget: Math.round(avgBudget * 100) / 100,
    ahWinCount: ahWins.length,
    ahWinAmount: Math.round(ahWins.reduce((s, r) => s + r['中标金额(万)'], 0) * 100) / 100,
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

  const productData = aggregateBy(
    records.map((r) => ({ ...r, _product: detectProductCategory(r.匹配关键词) })) as unknown as BidRecord[],
    '_product' as keyof BidRecord,
    ['count', 'sumBudget']
  )

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

export function parseCustomQuery(text: string): CustomQuery['dimensions'] {
  const dims: CustomQuery['dimensions'] = {}
  const t = text.toLowerCase()

  const regionPatterns = /(浙江省|浙江|杭州市|杭州|宁波市|宁波|温州市|温州|绍兴市|绍兴|湖州市|湖州|嘉兴市|嘉兴|金华市|金华|台州市|台州|衢州市|衢州|舟山市|舟山)/g
  const regions = t.match(regionPatterns)
  if (regions) dims.region = regions[0].replace(/省|市$/, '')

  const industryKeywords = ['医疗', '政府', '金融', '教育', '运营商', '企业', '公安', '电力', '交通', '数据局', '网信', '油气']
  for (const ind of industryKeywords) {
    if (t.includes(ind)) {
      dims.industry = ind
      break
    }
  }

  const timePatterns = [
    { reg: /近三个月|最近三个月|近3个月/, val: '近三个月' },
    { reg: /近半年|最近半年|近6个月/, val: '近半年' },
    { reg: /近一年|最近一年|近12个月/, val: '近一年' },
    { reg: /本月|这个月/, val: '本月' },
    { reg: /本季度|这个季度/, val: '本季度' },
  ]
  for (const p of timePatterns) {
    if (p.reg.test(t)) {
      dims.timeRange = p.val
      break
    }
  }

  const productKeywords = ['安全服务', '等保测评', '网络安全', '数据安全', '密码应用', '态势感知', '防火墙', '安全运营']
  for (const p of productKeywords) {
    if (t.includes(p)) {
      dims.productType = p
      break
    }
  }

  const perspectiveKeywords = ['竞争格局', '竞争', '机会', '客户', '趋势', '分布', '排名']
  for (const p of perspectiveKeywords) {
    if (t.includes(p)) {
      dims.perspective = p
      break
    }
  }

  const competitorKeywordsList = ['天融信', '深信服', '奇安信', '启明星辰', '绿盟', '安恒']
  for (const c of competitorKeywordsList) {
    if (t.includes(c)) {
      dims.competitor = c
      break
    }
  }

  return dims
}

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
      case '近三个月':
        start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().slice(0, 10)
        break
      case '近半年':
        start = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate()).toISOString().slice(0, 10)
        break
      case '近一年':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10)
        break
      case '本月':
        start = `${today.slice(0, 8)}01`
        break
      case '本季度': {
        const q = Math.floor(now.getMonth() / 3)
        start = `${now.getFullYear()}-${String(q * 3 + 1).padStart(2, '0')}-01`
        break
      }
    }
    if (start) result = result.filter((r) => !r.发布日期 || r.发布日期 >= start)
  }
  return result
}

export function generateCustomReport(records: BidRecord[], text: string): ReportSection[] {
  const dims = parseCustomQuery(text)
  const filtered = filterByDimensions(records, dims)
  const overview = computeOverview(filtered)

  const sections: ReportSection[] = [
    {
      title: '查询意图解析',
      type: 'text',
      description: `已识别维度：${[
        dims.region && `地域：${dims.region}`,
        dims.industry && `行业：${dims.industry}`,
        dims.timeRange && `时间：${dims.timeRange}`,
        dims.productType && `产品类型：${dims.productType}`,
        dims.perspective && `分析视角：${dims.perspective}`,
        dims.competitor && `竞争要素：${dims.competitor}`,
      ]
        .filter(Boolean)
        .join('，') || '未识别到明确维度，已返回全量分析'}。`,
    },
    {
      title: '定向市场概览',
      type: 'summary',
      description: `符合条件标讯 ${overview.totalCount} 条，招标金额 ${overview.totalBudget.toFixed(2)} 万元，平均预算 ${overview.avgBudget.toFixed(2)} 万元。`,
      insights: [
        `已公布中标 ${overview.closedCount} 条，安恒直接中标 ${overview.ahWinCount} 条。`,
        `市场容量与可跟进空间如下表所示。`,
      ],
    },
  ]

  if (dims.region || (!dims.industry && !dims.productType)) {
    sections.push({
      title: '区域分布',
      type: 'bar',
      data: aggregateBy(filtered, '城市', ['count', 'sumBudget']),
    })
  }

  if (dims.industry || (!dims.region && !dims.productType)) {
    sections.push({
      title: '行业分布',
      type: 'pie',
      data: aggregateBy(filtered, '行业', ['count', 'sumBudget']),
    })
  }

  if (dims.productType || (!dims.industry && !dims.region)) {
    sections.push({
      title: '产品/关键词分布',
      type: 'bar',
      data: aggregateBy(filtered, '匹配关键词', ['count', 'sumBudget']).slice(0, 15),
    })
  }

  const competitorData = detectCompetitors(filtered)
  if (competitorData.length) {
    sections.push({
      title: '竞争格局',
      type: 'bar',
      data: competitorData,
      insights: competitorData.slice(0, 3).map((c) => `${c.name} 中标 ${c.value} 次，金额 ${(c.amount || 0).toFixed(2)} 万元。`),
      suggestions: ['对比竞争对手方案差异，突出安恒产品与服务优势'],
    })
  }

  // 安恒机会点
  const highValue = filtered
    .filter((r) => r['招标金额(万)'] >= 50 && !r.中标单位)
    .sort((a, b) => b['招标金额(万)'] - a['招标金额(万)'])
    .slice(0, 8)
  const ahMatch = filtered
    .map((r) => ({ ...r, _score: detectAhAdvantage(r.匹配关键词).score }))
    .filter((r) => r._score >= 2)
    .sort((a, b) => b._score - a._score || b['招标金额(万)'] - a['招标金额(万)'])
    .slice(0, 8)

  sections.push({
    title: '安恒机会点',
    type: 'table',
    data: ahMatch.map((r) => ({
      name: r.项目名称.slice(0, 30),
      value: r._score,
      amount: r['招标金额(万)'],
      industry: r.行业,
      city: r.城市,
    })),
    insights: ['高匹配项目具备安恒产品替代或新增机会。'],
    suggestions: ['优先触达采购单位，提供POC与方案宣讲'],
  })

  sections.push({
    title: '高价值潜在客户',
    type: 'table',
    data: highValue.map((r) => ({
      name: r.采购单位.slice(0, 24),
      value: 1,
      amount: r['招标金额(万)'],
      project: r.项目名称.slice(0, 30),
    })),
    insights: ['以下客户预算充足且尚未定标，建议重点跟进。'],
    suggestions: ['建立客户触达优先级清单，分配销售资源'],
  })

  return sections
}
