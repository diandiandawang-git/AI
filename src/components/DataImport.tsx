import { useState, useRef, useMemo } from 'react'
import { Upload, FileSpreadsheet, Filter, BarChart3, Download } from 'lucide-react'
import type { BidRecord, FilterState } from '../types'
import { parseExcelFile, parseCSVFile, loadDefaultData } from '../lib/parser'
import {
  filterRecords,
  getUniqueValues,
  aggregateBy,
  aggregateTrend,
  computeOverview,
  detectCompetitors,
  detectProductCategory,
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
  const fileInput = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => filterRecords(records, filter), [records, filter])
  const overview = useMemo(() => computeOverview(filtered), [filtered])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const parsed = file.name.toLowerCase().endsWith('.csv')
        ? await parseCSVFile(file)
        : await parseExcelFile(file)
      setRecords(parsed)
    } catch (err) {
      setError(`解析失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const loadDefault = async () => {
    setLoading(true)
    try {
      const data = await loadDefaultData()
      setRecords(data)
    } catch (err) {
      setError(`默认数据加载失败：${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }

  const industries = useMemo(() => getUniqueValues(records, '行业'), [records])
  const cities = useMemo(() => getUniqueValues(records, '城市'), [records])
  const noticeTypes = useMemo(() => getUniqueValues(records, '公告类型'), [records])

  const regionData = useMemo(() => aggregateBy(filtered, '城市', ['count', 'sumBudget']), [filtered])
  const industryData = useMemo(() => aggregateBy(filtered, '行业', ['count', 'sumBudget']), [filtered])
  const trendData = useMemo(() => aggregateTrend(filtered), [filtered])
  const productData = useMemo(
    () =>
      aggregateBy(
        filtered.map((r) => ({ ...r, _product: detectProductCategory(r.匹配关键词) })) as unknown as BidRecord[],
        '_product' as keyof BidRecord,
        ['count', 'sumBudget']
      ),
    [filtered]
  )
  const competitorData = useMemo(() => detectCompetitors(filtered), [filtered])

  const toggleArray = (arr: string[], val: string) =>
    arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val]

  return (
    <div className="space-y-6">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Upload size={20} className="text-blue-500" />
          数据导入
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <input ref={fileInput} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            <FileSpreadsheet size={18} />
            上传 Excel/CSV
          </button>
          <button
            onClick={loadDefault}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 hover:bg-gray-800 text-gray-200 transition"
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
          {loading && <span className="text-gray-400">解析中...</span>}
        </div>
        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
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
    </div>
  )
}
