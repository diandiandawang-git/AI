import { useState, useRef, useMemo, useCallback, useDeferredValue } from 'react'
import { Upload, FileSpreadsheet, Filter, BarChart3, Download, Radar, TrendingUp, X, AlertTriangle, Loader2, Clock } from 'lucide-react'
import type { BidRecord, FilterState } from '../types'
import { parseFile, validateFile, loadDefaultData } from '../lib/parser'
import type { ParsePhase, ParseProgress, ParseError } from '../lib/parser'
import {
  filterRecords,
  getUniqueValues,
  aggregateBy,
  aggregateTrend,
  computeOverview,
  detectCompetitors,
  detectProductCategory,
  generateRadarBids,
} from '../lib/analyzer'
import { BarChartCard, PieChartCard, LineChartCard, StatCard, TableCard } from './Charts'
import { exportRecordsToCSV } from '../lib/export'

export function DataImport({
  records,
  setRecords,
  filter,
  setFilter,
}: {
  records: BidRecord[]
  setRecords: (r: BidRecord[]) => void
  filter: FilterState
  setFilter: (f: FilterState) => void
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [errorRetry, setErrorRetry] = useState(false) // 是否需要重试
  const [progress, setProgress] = useState<ParseProgress | null>(null)
  const [parseStats, setParseStats] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // ─ 延迟分析计算：大数据集时 React 先渲染 UI，再在低优先级计算分析 ─
  const deferredRecords = useDeferredValue(records)
  const analysisPending = deferredRecords !== records

  const filtered = useMemo(() => filterRecords(deferredRecords, filter), [deferredRecords, filter])
  const overview = useMemo(() => computeOverview(filtered), [filtered])
  const radarBids = useMemo(() => (deferredRecords.length > 0 ? generateRadarBids(deferredRecords) : []), [deferredRecords])

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // ─ 预校验 ─
    const preCheck = validateFile(file)
    if (preCheck) {
      setError(preCheck.detail)
      if (preCheck.code === 'FILE_TOO_LARGE') setErrorRetry(false)
      if (fileInput.current) fileInput.current.value = ''
      return
    }

    // ─ 开始解析 ─
    setLoading(true)
    setError('')
    setErrorRetry(false)
    setProgress({ phase: 'validating', percent: 0, detail: '正在校验文件...' })
    setParseStats(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await parseFile(file, setProgress, controller.signal)
      // 先标记解析完成（让进度条显示 100%）
      setProgress(null)
      setParseStats(`解析完成：${result.length.toLocaleString()} 条标讯`)
      // 延迟一帧再更新 records，让浏览器先渲染完成 UI，
      // 避免大数据量的 React re-render 阻塞"完成"提示的显示
      await new Promise((r) => requestAnimationFrame(r))
      setRecords(result)
    } catch (err) {
      // 用户主动取消 → 不显示错误
      if (controller.signal.aborted) {
        setProgress(null)
        return
      }
      if (err instanceof Error && err.name === 'ParseError') {
        const pe = err as ParseError
        setError(pe.detail)
        setErrorRetry(['PARSE_TIMEOUT', 'PARSE_ERROR', 'READ_ERROR'].includes(pe.code))
      } else {
        setError(`解析失败：${err instanceof Error ? err.message : String(err)}`)
        setErrorRetry(true)
      }
      setProgress(null)
    } finally {
      setLoading(false)
      abortRef.current = null
      if (fileInput.current) fileInput.current.value = ''
    }
  }, [setRecords])

  const cancelParse = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const loadDefault = async () => {
    setLoading(true)
    setError('')
    setErrorRetry(false)
    setProgress({ phase: 'reading', percent: 0, detail: '正在加载示例数据...' })
    try {
      const data = await loadDefaultData()
      setRecords(data)
      setProgress(null)
    } catch (err) {
      setError(`默认数据加载失败：${err instanceof Error ? err.message : String(err)}`)
      setErrorRetry(true)
      setProgress(null)
    } finally {
      setLoading(false)
    }
  }

  // ─ 派生数据 ─
  const industries = useMemo(() => getUniqueValues(deferredRecords, '行业'), [deferredRecords])
  const cities = useMemo(() => getUniqueValues(deferredRecords, '城市'), [deferredRecords])
  const noticeTypes = useMemo(() => getUniqueValues(deferredRecords, '公告类型'), [deferredRecords])
  const regionData = useMemo(() => aggregateBy(filtered, '城市', ['count', 'sumBudget']), [filtered])
  const industryData = useMemo(() => aggregateBy(filtered, '行业', ['count', 'sumBudget']), [filtered])
  const trendData = useMemo(() => aggregateTrend(filtered), [filtered])
  const productData = useMemo(() => {
    // 直接遍历聚合，避免 spread 复制 4 万个对象
    const prodMap = new Map<string, { count: number; amount: number }>()
    for (const r of filtered) {
      const cat = detectProductCategory(r.匹配关键词)
      const entry = prodMap.get(cat)
      if (entry) {
        entry.count += 1
        entry.amount += Number(r['招标金额(万)']) || 0
      } else {
        prodMap.set(cat, { count: 1, amount: Number(r['招标金额(万)']) || 0 })
      }
    }
    return Array.from(prodMap.entries())
      .map(([name, v]) => ({ name, value: v.count, amount: Math.round(v.amount * 100) / 100 }))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0))
  }, [filtered])
  const competitorData = useMemo(() => detectCompetitors(filtered), [filtered])

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]

  // ─ 进度阶段标签 ─
  const phaseLabels: Record<ParsePhase, string> = {
    validating: '校验中',
    reading: '读取中',
    parsing: '解析中',
    extracting: '提取中',
    normalizing: '处理中',
    receiving: '接收中',
    done: '完成',
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={20} className="text-blue-500" />
          数据导入
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv,.xlsm,.xlsb" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileInput.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition"
          >
            <FileSpreadsheet size={18} />
            上传 Excel/CSV
          </button>
          <button
            onClick={loadDefault}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 disabled:opacity-50 text-gray-200 transition"
          >
            <BarChart3 size={18} />
            加载示例数据
          </button>
          <button
            onClick={() => exportRecordsToCSV(filtered)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-200 transition"
          >
            <Download size={18} />
            导出筛选数据
          </button>
          {loading && (
            <button
              onClick={cancelParse}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-800 hover:bg-red-900/30 text-red-400 text-sm transition"
            >
              <X size={14} /> 取消
            </button>
          )}
        </div>

        {/* ─ 进度条 ─ */}
        {progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin text-blue-400" />
                {phaseLabels[progress.phase]} — {progress.detail}
              </span>
              <span className="text-sm text-blue-400 font-mono">{progress.percent}%</span>
            </div>
            <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-300 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* ─ 解析完成统计 ─ */}
        {parseStats && !progress && (
          <div className="mt-3 text-sm text-green-400 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
            {parseStats}
          </div>
        )}

        {/* ─ 错误提示（分类样式）─ */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-800/50 bg-red-950/30 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-red-300 text-sm font-medium">文件解析失败</p>
                <p className="text-red-400/80 text-sm mt-1 leading-relaxed">{error}</p>
                {errorRetry && (
                  <button
                    onClick={() => fileInput.current?.click()}
                    className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-900/50 hover:bg-red-800/50 text-red-300 text-sm transition border border-red-700/50"
                  >
                    <FileSpreadsheet size={14} /> 重新选择文件并重试
                  </button>
                )}
              </div>
              <button onClick={() => { setError(''); setErrorRetry(false); setProgress(null); }} className="text-gray-500 hover:text-gray-300">
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <div className="mt-3 text-sm text-gray-500">当前共 {records.length} 条标讯数据</div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Filter size={20} className="text-amber-500" />
          快速筛选
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-sm text-gray-400">最小预算（万）</label>
            <input
              type="number"
              value={filter.minBudget}
              onChange={(e) => setFilter({ ...filter, minBudget: e.target.value === '' ? '' : Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">最大预算（万）</label>
            <input
              type="number"
              value={filter.maxBudget}
              onChange={(e) => setFilter({ ...filter, maxBudget: e.target.value === '' ? '' : Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">发布开始日期</label>
            <input
              type="date"
              value={filter.startDate}
              onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400">发布结束日期</label>
            <input
              type="date"
              value={filter.endDate}
              onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-sm text-gray-400">行业（多选）</label>
            <div className="mt-1 flex flex-wrap gap-2 max-h-28 overflow-auto p-2 rounded-lg bg-gray-800 border border-gray-700">
              {industries.map((ind) => (
                <button
                  key={ind}
                  onClick={() => setFilter({ ...filter, industries: toggleArray(filter.industries, ind) })}
                  className={`px-2 py-1 text-xs rounded-full border transition ${
                    filter.industries.includes(ind)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400">城市（多选）</label>
            <div className="mt-1 flex flex-wrap gap-2 max-h-28 overflow-auto p-2 rounded-lg bg-gray-800 border border-gray-700">
              {cities.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilter({ ...filter, cities: toggleArray(filter.cities, c) })}
                  className={`px-2 py-1 text-xs rounded-full border transition ${
                    filter.cities.includes(c)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm text-gray-400">公告类型（多选）</label>
            <div className="mt-1 flex flex-wrap gap-2 max-h-28 overflow-auto p-2 rounded-lg bg-gray-800 border border-gray-700">
              {noticeTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilter({ ...filter, noticeTypes: toggleArray(filter.noticeTypes, t) })}
                  className={`px-2 py-1 text-xs rounded-full border transition ${
                    filter.noticeTypes.includes(t)
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'border-gray-600 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─ 分析计算中 ─ */}
      {analysisPending && records.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <div className="flex items-center gap-3">
            <Clock size={18} className="text-amber-400 animate-pulse" />
            <div>
              <p className="text-amber-300 text-sm font-medium">正在分析 {records.length.toLocaleString()} 条标讯...</p>
              <p className="text-gray-500 text-xs mt-1">数据已加载，分析报告正在后台计算中，计算期间页面保持可交互。</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 bg-gray-800 rounded-xl animate-pulse" />
            <div className="h-64 bg-gray-800 rounded-xl animate-pulse" />
          </div>
        </div>
      )}

      {/* ─ 分析就绪 ─ */}
      {!analysisPending && radarBids.length > 0 && (
        <div className="bg-gradient-to-br from-amber-950/30 via-gray-900 to-gray-900 border border-amber-800/30 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Radar size={20} className="text-amber-400" />
              商机雷达 — 今日必跟 TOP{radarBids.length}
            </h2>
            <span className="text-xs text-amber-400/70 flex items-center gap-1">
              <TrendingUp size={14} /> 智能评分排序
            </span>
          </div>
          <p className="text-sm text-gray-400 mb-4">
            基于预算规模、产品匹配度、竞对薄弱度、时机紧迫度和采购方画像五维评分，帮助一线销售快速锁定最优跟进目标。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {radarBids.slice(0, 10).map((bid, idx) => {
              const scoreColor = bid.score >= 70 ? 'text-green-400' : bid.score >= 45 ? 'text-amber-400' : 'text-gray-400'
              const barColor = bid.score >= 70 ? 'bg-green-500' : bid.score >= 45 ? 'bg-amber-500' : 'bg-gray-500'
              const urgencyBadge = bid.details.timingScore >= 12
                ? 'bg-red-900/50 text-red-300'
                : bid.details.timingScore >= 7
                  ? 'bg-amber-900/50 text-amber-300'
                  : 'bg-gray-800 text-gray-400'

              return (
                <div key={bid.record.唯一id || idx}
                  className="bg-gray-800/60 rounded-xl p-4 border border-gray-700/50 hover:border-amber-700/50 transition cursor-pointer group">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx < 3 ? 'bg-amber-600 text-white' : 'bg-gray-700 text-gray-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate max-w-[280px]" title={bid.record.项目名称}>
                          {bid.record.项目名称}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">{bid.record.采购单位?.slice(0, 16)}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-300">{bid.record.城市}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700/50 text-gray-300">{bid.record.行业}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <div className={`text-lg font-bold ${scoreColor}`}>{bid.score}</div>
                      <div className="text-xs text-gray-500">综合分</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 mb-2">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all`}
                        style={{ width: `${bid.score}%` }} />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded ${urgencyBadge}`}>
                      {bid.details.timingScore >= 12 ? '紧迫' : bid.details.timingScore >= 7 ? '可跟进' : '待观察'}
                    </span>
                    <span className="text-gray-500">¥{bid.record['招标金额(万)']?.toFixed(0)}万</span>
                    {bid.details.productScore >= 20 &&
                      <span className="text-blue-400">高匹配</span>
                    }
                    {bid.details.competitorScore >= 12 &&
                      <span className="text-green-400">蓝海</span>
                    }
                  </div>

                  <div className="mt-2 pt-2 border-t border-gray-700/30">
                    <p className="text-xs text-gray-500 leading-relaxed">
                      <span className="text-amber-400/70">推荐理由：</span>{bid.reason}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─ 分析图表（仅计算完成后渲染）─ */}
      {!analysisPending && records.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="标讯总数" value={overview.totalCount} sub={`筛选后 ${filtered.length} 条`} />
            <StatCard label="预算总额（万）" value={overview.totalBudget.toFixed(2)} />
            <StatCard label="平均预算（万）" value={overview.avgBudget.toFixed(2)} />
            <StatCard label="已公布中标" value={overview.closedCount} sub={`安恒中标 ${overview.ahWinCount} 条`} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-3">区域分布（项目数 & 金额）</h3>
              <BarChartCard data={regionData} valueKey="value" amountKey="amount" />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-3">行业分布</h3>
              <PieChartCard data={industryData} />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-3">发布时间趋势</h3>
              <LineChartCard data={trendData} />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-3">产品类型占比</h3>
              <PieChartCard data={productData} />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-3">竞争态势（主要竞争对手中标）</h3>
              <BarChartCard data={competitorData} valueKey="value" amountKey="amount" />
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <h3 className="text-white font-medium mb-3">高价值标讯 TOP10</h3>
              <TableCard
                data={filtered
                  .slice()
                  .sort((a, b) => b['招标金额(万)'] - a['招标金额(万)'])
                  .slice(0, 10)
                  .map((r) => ({
                    name: r.项目名称.slice(0, 36),
                    采购单位: r.采购单位.slice(0, 24),
                    预算: r['招标金额(万)'],
                    城市: r.城市,
                    行业: r.行业,
                  }))}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
