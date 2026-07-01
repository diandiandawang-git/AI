# 安恒标讯 AI 分析系统 - 版本记录

## v1.0 (2026-06-30)

### 技术栈
- React 19 + TypeScript + Vite
- Tailwind CSS v4 (@tailwindcss/vite)
- Recharts (图表)
- SheetJS/xlsx (Excel/CSV 解析)
- jsPDF + html2canvas (PDF 导出)
- docx + file-saver (Word 导出)
- lucide-react (图标)

### 功能模块
1. **数据导入与概览页**
   - Excel/CSV 文件上传，浏览器端解析
   - 内置示例数据（238 条浙江区域标讯）
   - 看板：总标讯数、预算总额、平均预算、已公布中标数
   - 图表：区域分布柱状图、行业饼图、时间趋势折线图、产品类型占比、竞争态势
   - 筛选：预算区间、发布日期、行业、城市、公告类型
   - Top 10 高价值项目表格

2. **默认固定维度报告页**
   - 9 个预置分析模块：总量金额汇总、区域市场热度、行业需求分布、时间趋势、公告类型、采购单位类型、产品类型占比、竞争格局、安恒优势领域
   - 每模块含市场洞察 + 销售建议
   - 潜在合作伙伴推荐
   - PDF / Word 导出

3. **自定义维度分析页**
   - 自然语言输入框（前端规则解析）
   - 自动拆解：地域、行业、时间范围、产品类型、分析视角、竞争对手
   - 定向深度报告 + 安恒机会点 + 高价值潜在客户
   - 历史记录 localStorage 存储，可回看
   - PDF / Word 导出

### 数据源
- 文件：招投标项目清单__(按发布日期倒序排列) (34).xlsx
- 规模：238 条记录，19 个字段
- 区域：浙江省（10 个城市）
- 行业：13 个行业分类
- 时间范围：2026 年 6 月

### Git
- 仓库：app/.git
- Tag: v1.0
- Commit: 483f4ba

### 部署
- CloudStudio URL: https://788276d5bd17420faeee74b1458b6e4a.app.codebuddy.work

### 已知限制
- 自然语言解析为前端规则匹配，未接 LLM
- 区域仅浙江省，地图热力图降级为柱状图
- 无后端，所有计算在浏览器端完成

---

## v2.0 (2026-07-01)

### 重大升级概述
- P0 双模块上线：商机雷达 + 竞对作战卡
- 自定义分析 v2.0：意图驱动引擎重写
- 大文件解析架构：Web Worker 分片传输
- 评分引擎算法优化：O(n²) → O(n)

### P0 新增模块

1. **商机雷达（DataImport 页顶部）**
   - 五维评分引擎：预算规模(25%) + 产品匹配(30%) + 竞对薄弱(15%) + 时机紧迫(15%) + 买方画像(15%)
   - `precomputeScoringStats()` 单次遍历预计算，评分 O(1) 查表
   - "今日必跟 TOP10"高亮卡片，含评分柱状图 + 核心理由
   - 每条商机：综合分、五维细分、标讯标签

2. **胜负归因矩阵（DefaultReport 页）**
   - `winLossMatrix()` 四维交叉分析：产品线/价位段/行业/城市
   - 安恒胜率 + 中标金额排名，Set 结构 O(1) 查表
   - 可视化表格 + 决策建议

3. **竞对作战卡（DefaultReport 页）**
   - `competitorBattleCards()` 主要竞对画像（深信服/奇安信/天融信/启明星辰/绿盟/新华三/华为）
   - 完整竞对数据：优劣势、惯用价位、核心产品、反制策略
   - 数据存于 `src/lib/ahProducts.ts` 的 `competitorProfiles`

### 自定义分析 v2.0

4. **意图驱动分析引擎**
   - `parseCustomQuery()` → `ParsedIntent`：多值维度解析 + 6 种意图分类（竞争/机会/趋势/客户/预算/综合）
   - `generateCustomReport()` 意图匹配深度模板，数据驱动洞察（非模板字符串）
   - UI：意图标签 + 多值维度联动 + 富文本渲染

5. **新增深度分析函数**
   - `generateSWOT()`：优势/劣势/机会/威胁四象限
   - `classifyBuyerTier()`：客户 ABCD 分级（预分组 Map，O(n)）
   - `competitorProductMatrix()`：竞对×品类交叉矩阵（单次遍历+复合 key）
   - 价位段分析、产品匹配度、本周行动清单

### 大文件解析架构

6. **Web Worker 分片传输**
   - `src/lib/parser.worker.ts`：XLSX 解析全部移入独立线程
   - Worker 分批提取（500条/批），`postMessage` 分 40+ 片发送
   - 主线程用 `useRef` 累积数据，避免 React state 每次触发重渲染
   - 新增 `receiving` 阶段，进度条平滑滚动
   - Vite 独立打包 Worker，~336KB（含 XLSX 库）

7. **进度与容错**
   - 三阶段进度条：校验 → 读取 → 解析结构 → 提取行 → 规范化字段 → 接收数据
   - 每阶段实时进度百分比 + 文字提示
   - 120s 超时 + AbortController 取消
   - 6 种分类错误提示：格式/大小/空文件/读取/超时/损坏

### 性能优化

8. **评分引擎 O(n²) → O(n)**
   - `precomputeScoringStats()` 预计算 Map：行业闭标数、竞对胜场、买家频次
   - `scoreBidFast()` O(1) 查表，4 万条从 16 亿次 → 4 万次操作
   - `winLossMatrix`：`Set.has()` O(1) 替代 `Array.some()` O(m)
   - `classifyBuyerTier`：预分组 Map 替代每条 filter 全量
   - `competitorProductMatrix`：单次遍历分组替代三重嵌套
   - `productData` 等聚合：直接遍历替代 `map(spread)` 创建临时对象

9. **React 延迟计算**
   - `useDeferredValue` 延迟分析计算，先渲染 UI 后计算
   - Loading 骨架脉冲动画 + "正在分析 N 条标讯..." 提示

### 压测数据

10. **合成数据集**
    - 脚本：`scripts/gen_large_bids.py`（openpyxl write_only 流式模式）
    - `app/public/data/synthetic_large.xlsx`：50,000 行 / 8.7MB / 19 字段
    - 数据特点：浙江标讯 ~50%、安恒中标 ~35%、真实字段分布

### 新增/修改文件
- `src/lib/ahProducts.ts` — 竞对画像数据
- `src/lib/analyzer.ts` — 评分/矩阵/作战卡/意图引擎（重写）
- `src/lib/parser.ts` — 分片接收 + 错误分类
- `src/lib/parser.worker.ts` — Web Worker（新增）
- `src/components/ErrorBoundary.tsx` — React 错误边界（新增）
- `src/components/DataImport.tsx` — 进度条三阶段 + 骨架
- `src/components/DefaultReport.tsx` — 胜负归因 + 作战卡渲染
- `src/components/CustomAnalysis.tsx` — 意图标签 + SWOT

### Git
- 仓库：app/.git
- Tag: v2.0

### 部署
- CloudStudio: https://788276d5bd17420faeee74b1458b6e4a.app.codebuddy.work
