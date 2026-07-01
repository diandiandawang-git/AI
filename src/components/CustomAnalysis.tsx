import { useState, useMemo, useEffect } from 'react'
import { MessageSquare, History, Sparkles, Send, Trash2, Target, Shield, TrendingUp, Users, DollarSign, Compass } from 'lucide-react'
import type { BidRecord, CustomQuery, ReportSection, AnalysisIntent } from '../types'
import { generateCustomReport, parseCustomQuery, filterByDimensions } from '../lib/analyzer'
import { BarChartCard, PieChartCard, TableCard } from './Charts'
import { ExportButtons } from './ExportButtons'

const EXAMPLE_QUERIES = [
  '分析浙江省医疗行业近三个月的安全服务类标讯竞争格局及安恒机会点',
  '杭州市和宁波市政府行业等保测评和网络安全类项目预算分布与客户画像',
  '浙江省金融行业数据安全与态势感知类中标情况，分析天融信和深信服的竞争策略',
  '温州市近半年终端安全与等保测评趋势，识别安恒可切入的商机与潜在客户',
]

const INTENT_ICONS: Record<AnalysisIntent, React.ReactNode> = {
  competition: <Shield size={14} />,
  opportunity: <Target size={14} />,
  trend: <TrendingUp size={14} />,
  customer: <Users size={14} />,
  budget: <DollarSign size={14} />,
  comprehensive: <Compass size={14} />,
}

const INTENT_LABELS: Record<AnalysisIntent, string> = {
  competition: '竞争格局',
  opportunity: '机会识别',
  trend: '趋势分析',
  customer: '客户画像',
  budget: '预算规模',
  comprehensive: '综合评估',
}

export function CustomAnalysis({ records }: { records: BidRecord[] }) {
  const [input, setInput] = useState('')
  const [queries, setQueries] = useState<CustomQuery[]>(() => {
    if (typeof window === 'undefined') return []
    const saved = localStorage.getItem('ah_bid_custom_queries')
    return saved ? JSON.parse(saved) : []
  })
  const [currentQuery, setCurrentQuery] = useState<CustomQuery | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    localStorage.setItem('ah_bid_custom_queries', JSON.stringify(queries))
  }, [queries])

  const runQuery = (text: string) => {
    if (!text.trim()) return
    setLoading(true)
    setTimeout(() => {
      const sections = generateCustomReport(records, text)
      const intent = parseCustomQuery(text)
      // 兼容旧的 dims 结构
      const dims: CustomQuery['dimensions'] = {
        region: intent.regions[0],
        industry: intent.industries[0],
        timeRange: intent.timeRange,
        productType: intent.productTypes[0],
        perspective: intent.intents[0],
        competitor: intent.competitors[0],
      }
      const query: CustomQuery = {
        id: Date.now().toString(),
        text,
        timestamp: Date.now(),
        dimensions: dims,
        sections,
      }
      setQueries((prev) => [query, ...prev])
      setCurrentQuery(query)
      setInput('')
      setLoading(false)
    }, 600)
  }

  const deleteQuery = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setQueries((prev) => prev.filter((q) => q.id !== id))
    if (currentQuery?.id === id) setCurrentQuery(null)
  }

  const filteredCount = useMemo(() => {
    if (!currentQuery) return 0
    return filterByDimensions(records, currentQuery.dimensions).length
  }, [currentQuery, records])

  const renderSection = (section: ReportSection, idx: number) => {
    const isSwot = section.title.includes('SWOT')
    const isAction = section.title.includes('行动清单')
    return (
      <div key={idx} className={`bg-gray-900 border ${isSwot ? 'border-purple-700/40' : isAction ? 'border-green-700/40' : 'border-gray-800'} rounded-2xl p-6`}>
        <h3 className={`text-lg font-semibold mb-3 ${isSwot ? 'text-purple-300' : isAction ? 'text-green-300' : 'text-white'}`}>
          {section.title}
        </h3>
        {section.description && (
          <div
            className={`text-gray-300 mb-4 text-sm leading-relaxed ${section.type === 'text' ? 'whitespace-pre-line' : ''}`}
            dangerouslySetInnerHTML={
              section.type === 'text'
                ? { __html: section.description.replace(/\n/g, '<br/>') }
                : undefined
            }
          >
            {section.type !== 'text' ? section.description : undefined}
          </div>
        )}
        {section.type === 'bar' && section.data && <BarChartCard data={section.data} valueKey="value" amountKey="amount" />}
        {section.type === 'pie' && section.data && <PieChartCard data={section.data} />}
        {section.type === 'table' && section.data && <TableCard data={section.data} />}
        {section.type === 'line' && section.data && (
          <div className="h-72 w-full">
            <BarChartCard data={section.data} valueKey="value" amountKey="amount" />
          </div>
        )}
        {section.type === 'summary' && section.insights && (
          <ul className="space-y-2">
            {section.insights.map((ins, i) => (
              <li key={i} className="text-green-400 text-sm">• {ins}</li>
            ))}
          </ul>
        )}
        {section.insights && (section.type === 'bar' || section.type === 'pie' || section.type === 'table' || section.type === 'text') && (
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
            <MessageSquare size={22} className="text-purple-500" />
            自定义维度分析
          </h2>
          <p className="text-gray-400 text-sm mt-1">用自然语言描述分析需求，系统自动拆解地域、行业、时间、产品类型等维度。</p>
        </div>
        {currentQuery && (
          <ExportButtons title={`安恒标讯分析报告_${currentQuery.text.slice(0, 20)}`} sections={currentQuery.sections} />
        )}
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <label className="text-sm text-gray-400 flex items-center gap-1 mb-2">
          <Sparkles size={14} />
          输入分析需求
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runQuery(input)}
            placeholder="例如：分析浙江省医疗行业近三个月的安全服务类标讯竞争格局及安恒机会点"
            className="flex-1 px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={() => runQuery(input)}
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white transition flex items-center gap-2"
          >
            {loading ? '分析中...' : <><Send size={16} /> 分析</>}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => runQuery(q)}
              className="text-xs px-3 py-1.5 rounded-full border border-gray-700 text-gray-400 hover:text-white hover:border-purple-500 transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <History size={16} />
              历史记录
            </h3>
            {queries.length === 0 ? (
              <div className="text-gray-500 text-sm">暂无历史分析</div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {queries.map((q) => (
                  <div
                    key={q.id}
                    onClick={() => setCurrentQuery(q)}
                    className={`p-3 rounded-lg cursor-pointer border transition group ${
                      currentQuery?.id === q.id
                        ? 'bg-purple-900/30 border-purple-700'
                        : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-sm text-gray-200 line-clamp-2">{q.text}</div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">{new Date(q.timestamp).toLocaleString()}</span>
                      <button
                        onClick={(e) => deleteQuery(q.id, e)}
                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {currentQuery && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <h3 className="text-white font-medium mb-2">已识别维度</h3>
              {(() => {
                const intent = parseCustomQuery(currentQuery.text)
                return (
                  <div className="space-y-3 text-sm">
                    {intent.intents.length > 0 && (
                      <div>
                        <div className="text-gray-500 text-xs mb-1.5">分析意图</div>
                        <div className="flex flex-wrap gap-1.5">
                          {intent.intents.map((i) => (
                            <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-900/50 border border-purple-700/50 text-purple-300 text-xs">
                              {INTENT_ICONS[i]}
                              {INTENT_LABELS[i]}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {intent.regions.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs">地域</span>
                        <div className="text-purple-300 mt-0.5">{intent.regions.join('、')}</div>
                      </div>
                    )}
                    {intent.industries.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs">行业</span>
                        <div className="text-purple-300 mt-0.5">{intent.industries.join('、')}</div>
                      </div>
                    )}
                    {intent.timeRange && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">时间</span>
                        <span className="text-purple-300">{intent.timeRange}</span>
                      </div>
                    )}
                    {intent.productTypes.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs">产品类型</span>
                        <div className="text-purple-300 mt-0.5">{intent.productTypes.join('、')}</div>
                      </div>
                    )}
                    {intent.competitors.length > 0 && (
                      <div>
                        <span className="text-gray-500 text-xs">竞对关注</span>
                        <div className="text-purple-300 mt-0.5">{intent.competitors.join('、')}</div>
                      </div>
                    )}
                  </div>
                )
              })()}
              <div className="mt-3 pt-3 border-t border-gray-800 text-sm text-gray-400">
                命中标讯：{filteredCount} 条
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-3 space-y-6">
          {!currentQuery ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center text-gray-500">
              输入分析需求或点击示例，开始生成定向深度报告
            </div>
          ) : (
            currentQuery.sections.map((s, i) => renderSection(s, i))
          )}
        </div>
      </div>
    </div>
  )
}
