export interface BidRecord {
  标题: string
  项目名称: string
  发布日期: string
  采购单位: string
  中标单位: string
  '招标金额(万)': number
  '中标金额(万)': number
  匹配关键词: string
  省份: string
  城市: string
  开标日期: string
  公告类型: string
  行业: string
  项目类别: string
  项目类型: string
  链接地址: string
  备份地址: string
  唯一id: string
  二级行业: string
}

export interface FilterState {
  minBudget: number | ''
  maxBudget: number | ''
  startDate: string
  endDate: string
  industries: string[]
  cities: string[]
  noticeTypes: string[]
}

export interface ChartData {
  name: string
  value?: number
  amount?: number
  [key: string]: string | number | undefined
}

export interface ReportSection {
  title: string
  type: 'summary' | 'bar' | 'line' | 'pie' | 'table' | 'text'
  data?: ChartData[]
  description?: string
  insights?: string[]
  suggestions?: string[]
}

export interface CustomQuery {
  id: string
  text: string
  timestamp: number
  dimensions: {
    region?: string
    industry?: string
    timeRange?: string
    productType?: string
    perspective?: string
    competitor?: string
  }
  sections: ReportSection[]
}

export type PageType = 'import' | 'default' | 'custom'
