export const topics = [
  { id: "digital-construction", label: "数字建造", primary: true, terms: /数[字智]建造|智能建造|智慧工地|建造数字化|工程数字化|建筑机器人|\bBIM\b|装配式建筑数字/i },
  { id: "digital-housing", label: "数字住建", primary: true, terms: /数字住建|智慧住建|数字住房|智慧房管|智慧物业|城市生命线|城市信息模型|\bCIM\b|工程建设项目审批系统|房屋安全管理平台|智慧城建|智慧城市|全域数字化转型|一网统管|城市智能中枢|城市数字底座|城市运行管理(?:服务)?平台|数字公共基础设施/i },
  { id: "urban-renewal", label: "城市更新", primary: true, terms: /城市(?:有机)?更新|五改四好|老旧小区改造|老旧厂区改造|原拆原建|片区更新|城市体检/ },
  { id: "six-networks", label: "六张网", primary: true, terms: /六(?:张网|网协同)|现代水网|水网工程|灌区现代化|引调水|新型电力系统|新型电网|智能配电|配电网|源网荷储|算力|智算|超算|数据中心|通信网|(?<![a-z0-9])[56]G(?![a-z0-9])|千兆光网|城市地下管网|地下管网|综合管廊|供排水管网|燃气管网|排水管网|管网更新|多式联运|物流枢纽|智慧物流|物流网/i },
  { id: "smart-campus", label: "智慧校园", terms: /智慧校园|数字校园|校园信息化|教育数字化|教学信息化|智慧教室|智慧教学|教育专网|智慧教育/ },
  { id: "smart-park", label: "智慧园区", terms: /智慧园区|数字园区|园区数字化|化工园区.*(?:智能化|信息化)|园区.*智慧管理/ },
  { id: "low-altitude", label: "低空经济", terms: /低空经济|低空(?:基础设施|飞行|空域|物流|运行|产业|服务|智联网|运营)|无人机(?:机场|巡检|配送|物流|起降)|一网统飞|起降场/ },
];

export function compactTitle(title) {
  // Provincial search highlights can add spaces inside Chinese terms.
  return title.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, "");
}
