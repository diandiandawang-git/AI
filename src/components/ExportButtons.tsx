import { FileDown, FileText } from 'lucide-react'
import { exportToPDF, exportToWord } from '../lib/export'
import type { ReportSection } from '../types'

export function ExportButtons({ title, sections }: { title: string; sections: ReportSection[] }) {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportToPDF(title, sections)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white transition"
      >
        <FileDown size={16} />
        导出 PDF
      </button>
      <button
        onClick={() => exportToWord(title, sections)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
      >
        <FileText size={16} />
        导出 Word
      </button>
    </div>
  )
}
