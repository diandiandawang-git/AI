import jsPDF from 'jspdf'
import { Document, Paragraph, TextRun, Table, TableCell, TableRow, WidthType, AlignmentType, Packer } from 'docx'
import { saveAs } from 'file-saver'
import type { ReportSection, BidRecord } from '../types'

export function exportToPDF(title: string, sections: ReportSection[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  let y = 40
  doc.setFontSize(18)
  doc.text(title, 40, y)
  y += 30

  sections.forEach((section, idx) => {
    if (y > 750) {
      doc.addPage()
      y = 40
    }
    doc.setFontSize(14)
    doc.setTextColor(33, 33, 33)
    doc.text(`${idx + 1}. ${section.title}`, 40, y)
    y += 22

    doc.setFontSize(10)
    if (section.description) {
      const lines = doc.splitTextToSize(section.description, 500)
      doc.text(lines, 40, y)
      y += lines.length * 14 + 8
    }

    if (section.data && section.data.length) {
      const headers = Object.keys(section.data[0])
      doc.setFontSize(9)
      doc.setTextColor(100, 100, 100)
      doc.text(headers.join(' | '), 40, y)
      y += 14
      doc.setTextColor(50, 50, 50)
      section.data.slice(0, 12).forEach((row) => {
        if (y > 780) {
          doc.addPage()
          y = 40
        }
        const vals = headers.map((h) => String(row[h] ?? '')).join(' | ')
        const lines = doc.splitTextToSize(vals, 500)
        doc.text(lines, 40, y)
        y += lines.length * 12 + 4
      })
      y += 10
    }

    if (section.insights) {
      doc.setTextColor(0, 100, 0)
      section.insights.forEach((insight) => {
        const lines = doc.splitTextToSize(`• ${insight}`, 500)
        doc.text(lines, 40, y)
        y += lines.length * 12 + 4
      })
      y += 6
    }

    if (section.suggestions) {
      doc.setTextColor(0, 80, 150)
      section.suggestions.forEach((s) => {
        const lines = doc.splitTextToSize(`→ ${s}`, 500)
        doc.text(lines, 40, y)
        y += lines.length * 12 + 4
      })
      y += 10
    }
    y += 16
  })

  doc.save(`${title}.pdf`)
}

export async function exportToWord(title: string, sections: ReportSection[]) {
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      text: title,
      heading: 'Heading1',
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ]

  sections.forEach((section) => {
    children.push(
      new Paragraph({
        text: section.title,
        heading: 'Heading2',
        spacing: { before: 200, after: 100 },
      })
    )
    if (section.description) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: section.description, size: 21 })],
          spacing: { after: 100 },
        })
      )
    }

    if (section.data && section.data.length) {
      const headers = Object.keys(section.data[0])
      const rows = section.data.slice(0, 20).map(
        (row) =>
          new TableRow({
            children: headers.map(
              (h) =>
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: String(row[h] ?? ''), size: 18 })],
                    }),
                  ],
                  width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
                })
            ),
          })
      )
      const headerRow = new TableRow({
        children: headers.map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })],
              width: { size: 100 / headers.length, type: WidthType.PERCENTAGE },
            })
        ),
      })
      children.push(
        new Table({
          rows: [headerRow, ...rows],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      )
    }

    if (section.insights) {
      section.insights.forEach((insight) =>
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `• ${insight}`, color: '2E7D32', size: 20 })],
            spacing: { after: 60 },
          })
        )
      )
    }
    if (section.suggestions) {
      section.suggestions.forEach((s) =>
        children.push(
          new Paragraph({
            children: [new TextRun({ text: `→ ${s}`, color: '1565C0', size: 20 })],
            spacing: { after: 60 },
          })
        )
      )
    }
  })

  const doc = new Document({ sections: [{ children }] })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${title}.docx`)
}

export function exportRecordsToCSV(records: BidRecord[], filename = '标讯数据.csv') {
  const headers = Object.keys(records[0] || {})
  const rows = records.map((r) => headers.map((h) => `"${String((r as unknown as Record<string, unknown>)[h] ?? '').replace(/"/g, '""')}"`))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  saveAs(blob, filename)
}
