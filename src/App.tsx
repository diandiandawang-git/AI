import { useEffect, useState } from 'react'
import { Upload, FileText, MessageSquare, Shield } from 'lucide-react'
import type { BidRecord, FilterState, PageType } from './types'
import { loadDefaultData } from './lib/parser'
import { DataImport } from './components/DataImport'
import { DefaultReport } from './components/DefaultReport'
import { CustomAnalysis } from './components/CustomAnalysis'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

const initialFilter: FilterState = {
  minBudget: '',
  maxBudget: '',
  startDate: '',
  endDate: '',
  industries: [],
  cities: [],
  noticeTypes: [],
}

function App() {
  const [records, setRecords] = useState<BidRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<PageType>('import')
  const [filter, setFilter] = useState<FilterState>(initialFilter)

  useEffect(() => {
    loadDefaultData()
      .then(setRecords)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [])

  const navItems: { key: PageType; label: string; shortLabel: string; icon: React.ReactNode }[] = [
    { key: 'import', label: '数据导入与概览', shortLabel: '数据导入', icon: <Upload size={18} /> },
    { key: 'default', label: '默认固定维度报告', shortLabel: '默认报告', icon: <FileText size={18} /> },
    { key: 'custom', label: '自定义维度分析', shortLabel: '自定义', icon: <MessageSquare size={18} /> },
  ]

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="sticky top-0 z-50 bg-gray-900/90 backdrop-blur border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-lg font-bold text-white">安恒标讯 AI 分析系统</h1>
              <p className="text-xs text-gray-500">面向一线销售与售前团队的市场洞察工具</p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-gray-800 rounded-xl p-1 overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                  page === item.key
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                }`}
              >
                {item.icon}
                <span className="hidden lg:inline">{item.label}</span>
                <span className="lg:hidden">{item.shortLabel}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-500">加载默认数据中...</div>
        ) : (
          <ErrorBoundary key={page}>
            {page === 'import' && (
              <DataImport records={records} setRecords={setRecords} filter={filter} setFilter={setFilter} />
            )}
            {page === 'default' && <DefaultReport records={records} />}
            {page === 'custom' && <CustomAnalysis records={records} />}
          </ErrorBoundary>
        )}
      </main>

      <footer className="border-t border-gray-800 py-6 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-600">
          安恒信息 · 标讯 AI 分析报告系统 · 数据仅供内部参考
        </div>
      </footer>
    </div>
  )
}

export default App
