import { useMemo, useDeferredValue } from 'react'
import { FileText, Radar, Shield, Clock } from 'lucide-react'
import type { BidRecord } from '../types'
import { generateDefaultReport, winLossMatrix, competitorBattleCards } from '../lib/analyzer'
import { BarChartCard, PieChartCard, LineChartCard, TableCard } from './Charts'
import { ExportButtons } from './ExportButtons'

function SkeletonBlock({ height = 'h-64' }: { height?: string }) {
  return <div className={`${height} bg-gray-800 rounded-xl animate-pulse`} />
}

export function DefaultReport({ records }: { records: BidRecord[] }) {
  const deferredRecords = useDeferredValue(records)
  const analysisPending = deferredRecords !== records

  const sections = useMemo(() => {
    if (deferredRecords.length === 0) return []
    return generateDefaultReport(deferredRecords)
  }, [deferredRecords])
  const wl = useMemo(() => {
    if (deferredRecords.length === 0) return { byProduct: [], byBudgetTier: [], byIndustry: [], byCity: [] }
    return winLossMatrix(deferredRecords)
  }, [deferredRecords])
  const battleCards = useMemo(() => {
    if (deferredRecords.length === 0) return []
    return competitorBattleCards(deferredRecords)
  }, [deferredRecords])

  if (records.length === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <FileText size={48} className="mx-auto mb-4 opacity-30" />
        <p>请先在上传页面导入标讯数据</p>
      </div>
    )
  }

  if (analysisPending || sections.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText size={22} className="text-blue-500" />
              默认固定维度报告
            </h2>
            <p className="text-gray-400 text-sm mt-1">基于安恒信息业务特点预置的标准化市场分析报告，可直接用于内部汇报。</p>
          </div>
        </div>
        <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 text-blue-200 text-sm flex items-center gap-3">
          <Clock size={16} className="text-amber-400 animate-pulse" />
          正在分析 {records.length.toLocaleString()} 条标讯，报告即将呈现...
        </div>
        <div className="grid grid-cols-1 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <SkeletonBlock height="h-6 w-48 mb-4" />
              <SkeletonBlock height="h-4 w-full mb-2" />
              <SkeletonBlock height="h-4 w-3/4 mb-4" />
              <SkeletonBlock height="h-64" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderSection = (section: ReturnType<typeof generateDefaultReport>[0], idx: number) => {
    return (
      <div key={idx} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 scroll-mt-24" id={`section-${idx}`}>
        <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">{idx + 1}</span>
          {section.title}
        </h3>
        {section.description && <p className="text-gray-300 mb-4 leading-relaxed">{section.description}</p>}
        {section.type === 'summary' && section.insights && (
          <ul className="space-y-2">
            {section.insights.map((ins, i) => (
              <li key={i} className="text-green-400 text-sm">• {ins}</li>
            ))}
          </ul>
        )}
        {section.type === 'bar' && section.data && <BarChartCard data={section.data} valueKey="value" amountKey="amount" />}
        {section.type === 'pie' && section.data && <PieChartCard data={section.data} />}
        {section.type === 'line' && section.data && <LineChartCard data={section.data} />}
        {section.type === 'table' && section.data && <TableCard data={section.data} />}
        {section.type === 'text' && <p className="text-gray-400 text-sm">{section.description}</p>}

        {section.insights && section.type !== 'summary' && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-200 mb-2">市场洞察</div>
            <ul className="space-y-1">
              {section.insights.map((ins, i) => (
                <li key={i} className="text-green-400 text-sm">• {ins}</li>
              ))}
            </ul>
          </div>
        )}
        {section.suggestions && (
          <div className="mt-4">
            <div className="text-sm font-medium text-gray-200 mb-2">销售建议</div>
            <ul className="space-y-1">
              {section.suggestions.map((s, i) => (
                <li key={i} className="text-blue-400 text-sm">→ {s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={22} className="text-blue-500" />
            默认固定维度报告
          </h2>
          <p className="text-gray-400 text-sm mt-1">基于安恒信息业务特点预置的标准化市场分析报告，可直接用于内部汇报。</p>
        </div>
        <ExportButtons title="安恒标讯市场分析报告_默认维度" sections={sections} />
      </div>

      <div className="bg-blue-900/20 border border-blue-800/50 rounded-xl p-4 text-blue-200 text-sm">
        报告基于 {records.length} 条标讯数据自动生成，包含 9 个固定分析模块。建议结合自定义维度分析交叉验证市场机会。
      </div>

      <div className="grid grid-cols-1 gap-6">
        {sections.map((s, i) => renderSection(s, i))}

        {/* P0-2: 胜负归因分析 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 scroll-mt-24" id="section-winloss">
          <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-amber-600 text-white text-sm flex items-center justify-center">{sections.length + 1}</span>
            <Radar size={20} className="text-amber-400" />
            胜负归因分析
          </h3>
          <p className="text-gray-300 mb-5 leading-relaxed">
            基于已中标数据的多维度交叉归因，识别安恒的"甜点区"和"失血区"，为资源分配提供数据支撑。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">按产品线看胜率</h4>
              <TableCard data={wl.byProduct.filter((m) => m.total > 0).map((m) => ({
                品类: m.dimension, name: m.dimension,
                总量: m.total,
                安恒中标: m.ahWins,
                中标金额万: m.ahAmount,
                胜率: `${m.winRate}%`,
              }))} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">按价位段看胜率</h4>
              <TableCard data={wl.byBudgetTier.filter((m) => m.total > 0).map((m) => ({
                价位段: m.dimension, name: m.dimension,
                总量: m.total,
                安恒中标: m.ahWins,
                胜率: `${m.winRate}%`,
              }))} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">按行业看胜率</h4>
              <TableCard data={wl.byIndustry.filter((m) => m.total > 0).map((m) => ({
                行业: m.dimension, name: m.dimension,
                总量: m.total,
                安恒中标: m.ahWins,
                胜率: `${m.winRate}%`,
              }))} />
            </div>
            <div>
              <h4 className="text-sm font-medium text-gray-200 mb-3">按城市看胜率</h4>
              <TableCard data={wl.byCity.filter((m) => m.total > 0).map((m) => ({
                城市: m.dimension, name: m.dimension,
                总量: m.total,
                安恒中标: m.ahWins,
                胜率: `${m.winRate}%`,
              }))} />
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium text-gray-200 mb-2">关键发现</div>
            <ul className="space-y-1">
              {(() => {
                const productWin = wl.byProduct.sort((a, b) => b.winRate - a.winRate)
                const productLose = [...wl.byProduct].sort((a, b) => a.winRate - b.winRate)
                const industryWin = wl.byIndustry.sort((a, b) => b.winRate - a.winRate)
                const findings: string[] = []
                if (productWin[0] && productWin[0].winRate > 0) findings.push(`安恒在「${productWin[0].dimension}」品类胜率最高（${productWin[0].winRate}%），应作为主力战场。`)
                if (productLose[0] && productLose[0].total >= 3 && productLose[0].winRate < 30) findings.push(`「${productLose[0].dimension}」品类胜率仅${productLose[0].winRate}%，建议调整打法或加大售前投入。`)
                if (industryWin[0] && industryWin[0].winRate > 0) findings.push(`「${industryWin[0].dimension}」行业胜率最高，可作为标杆案例行业。`)
                if (findings.length === 0) findings.push('样本中标数据有限，建议积累更多数据后再做结论。')
                return findings.map((f, i) => <li key={i} className="text-green-400 text-sm">• {f}</li>)
              })()}
            </ul>
          </div>
        </div>

        {/* P0-2: 竞对作战卡 */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 scroll-mt-24" id="section-battlecards">
          <h3 className="text-xl font-semibold text-white mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-red-600 text-white text-sm flex items-center justify-center">{sections.length + 2}</span>
            <Shield size={20} className="text-red-400" />
            竞争对手作战卡
          </h3>
          <p className="text-gray-300 mb-5 leading-relaxed">
            针对主要竞争对手的深度分析卡片，含胜率、优势域、惯用价位和针对性反制策略，直接服务于一线竞标决策。
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {battleCards.map((card) => (
              <div key={card.name} className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 hover:border-gray-600 transition">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-base font-semibold text-white">{card.name}</h4>
                  <span className="px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 text-xs">
                    中标 {card.winCount} 次
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div className="text-gray-400">中标总额</div>
                  <div className="text-white text-right">{card.winAmount.toFixed(0)} 万</div>
                  <div className="text-gray-400">均价</div>
                  <div className="text-white text-right">{card.avgBidSize.toFixed(0)} 万</div>
                  <div className="text-gray-400">份额</div>
                  <div className="text-white text-right">{card.winRate}%</div>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">优势行业</div>
                  <div className="flex flex-wrap gap-1">
                    {card.topIndustries.map((ind) => (
                      <span key={ind.name} className="px-1.5 py-0.5 text-xs rounded bg-amber-900/40 text-amber-300">
                        {ind.name}({ind.count})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="mb-3">
                  <div className="text-xs text-gray-500 mb-1">重点城市</div>
                  <div className="flex flex-wrap gap-1">
                    {card.topCities.map((c) => (
                      <span key={c.name} className="px-1.5 py-0.5 text-xs rounded bg-blue-900/40 text-blue-300">
                        {c.name}({c.count})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="border-t border-gray-700 pt-3">
                  <div className="text-xs text-gray-500 mb-1">反制策略</div>
                  <p className="text-sm text-green-400 leading-relaxed">{card.strategy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
