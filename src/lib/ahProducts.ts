export const ahProducts = [
  { name: 'AiLPHA大数据智能安全平台', category: '态势感知', keywords: ['态势感知', '安全运营平台', 'SOC', '大数据安全', 'AI安全'] },
  { name: '明御综合日志审计', category: '审计', keywords: ['日志审计', '综合日志'] },
  { name: '明御数据库审计', category: '数据安全', keywords: ['数据库审计', '数据库安全审计'] },
  { name: '明御WEB应用防火墙', category: '应用安全', keywords: ['WAF', 'WEB应用防火墙', 'web应用防火墙'] },
  { name: '明御防火墙', category: '边界安全', keywords: ['防火墙', '边界安全'] },
  { name: '明御入侵检测/防御', category: '边界安全', keywords: ['IDS', 'IPS', '入侵检测', '入侵防御'] },
  { name: '明御堡垒机', category: '运维安全', keywords: ['堡垒机', '运维堡垒机'] },
  { name: '明御漏洞扫描', category: '漏扫', keywords: ['漏洞扫描', 'web漏洞扫描', '漏扫'] },
  { name: '明御终端安全', category: '终端安全', keywords: ['终端安全', '终端DLP', 'EDR', '终端杀毒', '杀毒软件'] },
  { name: 'AiLPHA数据安全管控平台', category: '数据安全', keywords: ['数据安全', '数据防泄漏', 'DLP', '数据分级分类'] },
  { name: 'AiLPHA零信任', category: '零信任', keywords: ['零信任'] },
  { name: '天池云安全', category: '云安全', keywords: ['云安全'] },
  { name: '密盾密码服务', category: '密码应用', keywords: ['密码应用', '密评', 'SSL', 'IPSecVPN', 'VPN网关', '密码机'] },
  { name: '安全运营服务MSS', category: '安全服务', keywords: ['安全运营', '安全运维', '安全服务', '网络安全运维', 'SOC'] },
  { name: '等级保护测评服务', category: '等保测评', keywords: ['等保测评', '等级保护测评', '等级保护', '三级等保'] },
]

export const productCategories = [
  { name: '等保测评', keywords: ['等保测评', '等级保护测评', '等级保护', '三级等保'] },
  { name: '安全服务/运营', keywords: ['安全服务', '安全运营', '安全运维', '网络安全运维', '安全托管', 'MSS'] },
  { name: '数据安全', keywords: ['数据安全', '数据库审计', '数据防泄漏', 'DLP', '数据分级分类'] },
  { name: '态势感知/SOC', keywords: ['态势感知', '安全运营平台', 'SOC', '安全态势感知'] },
  { name: '边界安全', keywords: ['防火墙', 'IDS', 'IPS', '入侵检测', '入侵防御', '网闸', '隔离网闸'] },
  { name: '应用安全', keywords: ['WAF', 'web漏洞扫描', '应用安全', '代码审计'] },
  { name: '终端安全', keywords: ['终端安全', 'EDR', '终端杀毒', '杀毒软件', '终端DLP'] },
  { name: '运维安全', keywords: ['堡垒机', '运维堡垒机', '日志审计', '基线检查', '基线核查'] },
  { name: '密码应用', keywords: ['密码应用', '密评', 'SSL', 'VPN', '密码机', '签名验签'] },
  { name: '云安全', keywords: ['云安全'] },
  { name: '零信任', keywords: ['零信任'] },
  { name: '网络安全', keywords: ['网络安全', '网络及安全', '网络与信息安全', '信息系统安全'] },
]

export const competitorKeywords = [
  { name: '天融信', alias: ['天融信', 'Topsec'] },
  { name: '深信服', alias: ['深信服', 'Sangfor'] },
  { name: '奇安信', alias: ['奇安信', 'Qi-Anxin'] },
  { name: '启明星辰', alias: ['启明星辰', 'Venustech'] },
  { name: '绿盟科技', alias: ['绿盟', 'NSFOCUS'] },
  { name: '华为', alias: ['华为', 'Huawei'] },
  { name: '新华三', alias: ['新华三', 'H3C'] },
  { name: '中国电信', alias: ['天翼安全', '中国电信'] },
  { name: '中国移动', alias: ['中移', '中国移动'] },
  { name: '中国联通', alias: ['联通', '中国联通'] },
  { name: '中国软件', alias: ['中软', '中国软件'] },
]

export const competitorProfiles: Record<string, {
  strengths: string[]
  weaknesses: string[]
  typicalPriceRange: [number, number]
  coreProducts: string[]
  primaryIndustries: string[]
}> = {
  '天融信': {
    strengths: ['防火墙/边界安全市场份额领先', '政府行业客户基础深厚', '产品线全面覆盖等保合规'],
    weaknesses: ['大数据安全/态势感知能力弱于安恒', '安全运营服务经验较少', '新一代人工智能安全产品布局慢'],
    typicalPriceRange: [40, 300],
    coreProducts: ['防火墙', '入侵检测', 'VPN'],
    primaryIndustries: ['政府', '公安', '金融'],
  },
  '深信服': {
    strengths: ['渠道覆盖广、代理商体系成熟', 'SaaS化安全产品领先', '中小企业市场品牌认知高'],
    weaknesses: ['大型企业定制化能力弱', '数据安全产品线不完整', '等保测评并非核心业务'],
    typicalPriceRange: [20, 200],
    coreProducts: ['WAF', '上网行为管理', '超融合'],
    primaryIndustries: ['企业', '教育', '医疗'],
  },
  '奇安信': {
    strengths: ['国家级安全项目经验丰富', '冬奥等大型赛事安全运营', '威胁情报与态势感知品牌强'],
    weaknesses: ['产品售价偏高', '中小客户覆盖不足', '浙江本地化团队较弱'],
    typicalPriceRange: [50, 500],
    coreProducts: ['态势感知', '终端安全', '大数据安全'],
    primaryIndustries: ['政府', '金融', '运营商'],
  },
  '启明星辰': {
    strengths: ['安全管理平台与等保合规经验丰富', '军队/公安行业渠道深', '堡垒机/运维安全有优势'],
    weaknesses: ['创新速度慢', '云安全布局少', '安全数据分析能力一般'],
    typicalPriceRange: [30, 250],
    coreProducts: ['IDS/IPS', '安全管理平台', '堡垒机'],
    primaryIndustries: ['公安', '国防', '政府'],
  },
  '绿盟科技': {
    strengths: ['Web安全产品口碑好', '安全服务经验丰富', '攻击检测技术领先'],
    weaknesses: ['整体解决方案能力弱', '渠道体系不如深信服', '大数据安全平台成熟度低'],
    typicalPriceRange: [25, 220],
    coreProducts: ['WAF', '漏洞扫描', '抗DDoS'],
    primaryIndustries: ['金融', '运营商', '政府'],
  },
  '华为': {
    strengths: ['ICT整体方案能力强', '品牌溢价高', '政企大客户资源丰富'],
    weaknesses: ['安全非核心业务线', '产品灵活性不足', '服务响应较慢'],
    typicalPriceRange: [100, 1000],
    coreProducts: ['防火墙', '态势感知', '终端安全'],
    primaryIndustries: ['政府', '金融', '运营商'],
  },
  '新华三': {
    strengths: ['网络设备+安全打包优势', '教育/医疗行业渗透深', '本地化服务覆盖广'],
    weaknesses: ['安全独立品牌力弱', '产品创新跟随策略', '安全运营服务刚起步'],
    typicalPriceRange: [30, 400],
    coreProducts: ['防火墙', 'WAF', '态势感知'],
    primaryIndustries: ['教育', '医疗', '政府'],
  },
  '中国电信': {
    strengths: ['央企背书公信力强', '线路+安全打包销售', '地市级覆盖最深'],
    weaknesses: ['安全产品自研能力弱', '多采用OEM/集成模式', '响应速度慢'],
    typicalPriceRange: [20, 200],
    coreProducts: ['安全运维服务', '等保测评', '云安全'],
    primaryIndustries: ['政府', '教育', '医疗'],
  },
  '中国移动': {
    strengths: ['5G+安全场景先发', '移动政务客户资源', '预算充足低价竞标'],
    weaknesses: ['安全能力以集成为主', '自主产品成熟度低', '非核心安全厂商'],
    typicalPriceRange: [20, 300],
    coreProducts: ['安全运维服务', '等保测评', '云安全'],
    primaryIndustries: ['政府', '教育', '公安'],
  },
  '中国联通': {
    strengths: ['本地化服务团队', '价格灵活', '政企关系'],
    weaknesses: ['安全技术能力弱', '核心安全产品欠缺', '多以总包集成身份出现'],
    typicalPriceRange: [15, 180],
    coreProducts: ['安全运维服务', '等保测评'],
    primaryIndustries: ['政府', '企业'],
  },
  '中国软件': {
    strengths: ['系统集成总包能力强', '政府大项目优先入围', '资质齐全'],
    weaknesses: ['安全非核心业务', '多作为总包再分包安全', '利润率要求低'],
    typicalPriceRange: [50, 800],
    coreProducts: ['系统集成', '等保测评', '安全运维'],
    primaryIndustries: ['政府', '金融', '交通'],
  },
}

export const advantageKeywords = [
  '态势感知',
  '安全运营',
  '数据安全',
  '数据库审计',
  'WAF',
  '日志审计',
  '堡垒机',
  '漏洞扫描',
  '等保测评',
  '零信任',
  '云安全',
  '密码应用',
  '终端安全',
  '网络安全',
]

export const regionFullNames: Record<string, string> = {
  浙江: '浙江省',
  杭州: '杭州市',
  宁波: '宁波市',
  温州: '温州市',
  绍兴: '绍兴市',
  湖州: '湖州市',
  嘉兴: '嘉兴市',
  金华: '金华市',
  台州: '台州市',
  衢州: '衢州市',
  舟山: '舟山市',
  丽水: '丽水市',
}
