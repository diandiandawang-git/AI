import { useMemo } from 'react'
import { FileText } from 'lucide-react'
import type { BidRecord } from '../types'
import { generateDefaultReport } from '../lib/analyzer'
import { BarChartCard, PieChartCard, LineChartCard, TableCard } from './Charts'
import { ExportButtons } from './ExportButtons'

export function DefaultReport({ records }: { records: BidRecord[] }) {
  const sections = useMemo(() => generateDefaultReport(records), [records])

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
      </div>
    </div>
  )
}
