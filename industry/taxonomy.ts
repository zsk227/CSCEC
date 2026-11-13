// 这个行业的分类体系：类别、标签词表、公司（主体）名录，以及防止张冠李戴的身份词典。
// 模型按这里的词表打标签，主题页（topics.json）按标签归类，筛选栏按类别分组。
// 换行业时：类别的 key 会出现在网址里（/all?category=…），上线后就不要再改；标签和名录可以随时增减。

/**
 * 网页上的类别（筛选栏、卡片角标、RSS 分类订阅）。key 是网址和接口里的身份，上线后不要改。
 * section 是日报里的分节标题（几个类别可以共用一节，按这里的顺序排）；guide 告诉结构抽取模型这一类收什么、
 * 和相邻类别的边界在哪（总的归类原则写在 prompts/structure.md 里）。
 * commentary 标出评论类（教程、观点）：日报写过的事又有评论类的后续报道，只占一行快讯（报道它的信源够多时除外）。
 * 没归上类的资料在日报里放进第一个 key 为 industry 的类别所在的节（没有就放最后一节）。
 * tagColor 是飞书推送卡片里跟在标题后面的这一类小标签的颜色（飞书 text_tag 的颜色名）。
 * feedLabel 是分类 RSS 标题里的名字（不写就用 label）。公开接口、RSS 和 MCP 里要把一类并进另一类发布，写在站点设置里（site/site.ts 的 PUBLIC_CATEGORIES）。
 */
export const CATEGORIES = [
  { key: "digital-construction", tagColor: "turquoise", label: "数智建造", section: "数智建造", guide: "涉及工程的数字化设计、智慧工地、智能生产、建筑机器人、工程 AI 与数字化运维。" },
  { key: "six-networks", tagColor: "indigo", label: "六张网", section: "六张网", guide: "以水网、新型电网、算力网、新一代通信网、城市地下管网、物流网及多网协同的规划建设与运营为核心。" },
  { key: "projects", tagColor: "orange", label: "项目与招采", section: "项目与招采", guide: "核心信息是项目清单、招采、签约、开工、验收、投运或投融资节点，且项目与本站主题相关。" },
  { key: "industry", tagColor: "violet", label: "政策与产业", section: "政策与产业", guide: "跨领域的政策标准、行业机制、市场变化和机构动态。只针对一张网的专项建设方案归六张网。" },
  { key: "practice", tagColor: "green", label: "案例与方法", section: "案例与方法", guide: "核心信息是可复用的工程案例、实施方法、技术研究、工程标准实践或基于证据的分析。" },
] as const satisfies ReadonlyArray<{ key: string; tagColor: string; label: string; feedLabel?: string; section: string; guide: string; commentary?: true }>;

/**
 * 这个行业最受关注的一类发布（AI 行业是新模型）：日报报头的“N 个新模型”、改分类后修订已出的报告都按它数。
 * category 是类别，tag 是标签，两者都对上才算；unit 接在数字后面。
 * 没有这样一类的行业设成 null，报头就不显示这个数。
 */
export const RELEASE: { category: string; tag: string; unit: string } | null = null;

/** 周报月报可以直接使用的行业通用词（小写）。 */
export const PLAIN_TERMS: readonly string[] = ["bim", "cim", "gis", "iot", "ai", "5g", "5g-a", "gpu", "epc"];

/** 内容类型与内容理解、评分提示词的枚举一致。 */
export const ITEM_TYPES = ["policy_standard", "product_launch", "tool_or_prompt", "research_paper", "industry_event", "opinion_analysis", "tutorial_explainer"] as const;

// ── 标签词表 ────────────────────────────────────────────────────────────────────────────

/** 每篇资料的第一个标签必须是这些“分类标签”之一。 */
export const CATEGORY_TAGS = ["政策/标准", "项目进展", "招标采购", "投融资", "案例/实践", "产品/技术", "研究/观点", "行业动态", "其他"] as const;

/** 可选的主题标签。 */
export const TOPIC_TAGS = ["水网", "新型电网", "算力网", "新一代通信网", "城市地下管网", "物流网", "BIM/CIM", "智慧工地", "建筑机器人", "数字孪生", "AI+建造", "多网协同"] as const;

/** 可选的实体标签。 */
export const ENTITY_TAGS = ["国家发展改革委", "住房城乡建设部", "湖北省发展改革委", "湖北省住建厅", "湖北省经信厅", "中建集团", "中建三局"] as const;

export const TAG_SYNONYMS: Readonly<Record<string, string>> = {
  "BIM": "BIM/CIM", "CIM": "BIM/CIM", "智能工地": "智慧工地", "施工机器人": "建筑机器人",
  "智慧水利": "水网", "新型电力系统": "新型电网", "算力互联网": "算力网",
  "通信网": "新一代通信网", "城市管网": "城市地下管网", "智慧物流": "物流网",
  "政策": "政策/标准", "中标": "招标采购", "专项债": "投融资", "工程案例": "案例/实践",
};

// ── 公司与主体 ──────────────────────────────────────────────────────────────────────────

/**
 * 公司主题：id → 显示名、卡片上显示的标签（null 表示只用 entity:<id> 归类）、别名。
 * aliases 给结构抽取模型看；orgNames 是这家公司发消息时开头用的组织名（公司、实验室、团队），
 * 在它自己的主题页上读者知道说的是谁，可以省去；otherNames 是公司的其他称呼（官方账号名、子品牌）。
 * 所有这些名字都用来认出说的是哪家公司，比如把事实的主体对到发布方。
 */
export const ENTITIES: Record<string, { name: string; displayTag: string | null; aliases: string[]; orgNames?: string[]; otherNames?: string[] }> = {
  "ndrc": { name: "国家发展改革委", displayTag: "国家发展改革委", aliases: ["国家发展改革委", "国家发改委", "国家发展和改革委员会"] },
  "mohurd": { name: "住房城乡建设部", displayTag: "住房城乡建设部", aliases: ["住房城乡建设部", "住房和城乡建设部", "住建部"] },
  "hubei-drc": { name: "湖北省发展改革委", displayTag: "湖北省发展改革委", aliases: ["湖北省发展改革委", "湖北省发改委", "湖北省发展和改革委员会"] },
  "hubei-housing": { name: "湖北省住建厅", displayTag: "湖北省住建厅", aliases: ["湖北省住建厅", "湖北省住房和城乡建设厅", "湖北省住房城乡建设厅"] },
  "hubei-miit": { name: "湖北省经信厅", displayTag: "湖北省经信厅", aliases: ["湖北省经信厅", "湖北省经济和信息化厅"] },
  "cscec": { name: "中建集团", displayTag: "中建集团", aliases: ["中建集团", "中国建筑集团", "中国建筑股份有限公司"] },
  "cscec3b": { name: "中建三局", displayTag: "中建三局", aliases: ["中建三局", "中建三局集团"] },
};

/**
 * 身份词典：摘要和标题里出现的公司，必须在原文里也出现过，否则退回原标题、丢掉摘要（防止模型张冠李戴）。
 * 行业没有这个问题时可以留空数组。
 */
export const IDENTITY_LEXICON: ReadonlyArray<{ id: string; name: string; patterns: RegExp[] }> = [
  { id: "ndrc", name: "国家发展改革委", patterns: [/国家发展改革委|国家发改委|国家发展和改革委员会/u] },
  { id: "mohurd", name: "住房城乡建设部", patterns: [/住房城乡建设部|住房和城乡建设部|住建部/u] },
  { id: "hubei-drc", name: "湖北省发展改革委", patterns: [/湖北省发展改革委|湖北省发改委|湖北省发展和改革委员会/u] },
  { id: "hubei-housing", name: "湖北省住建厅", patterns: [/湖北省住建厅|湖北省住房和城乡建设厅|湖北省住房城乡建设厅/u] },
  { id: "hubei-miit", name: "湖北省经信厅", patterns: [/湖北省经信厅|湖北省经济和信息化厅/u] },
  { id: "cscec", name: "中建集团", patterns: [/中建集团|中国建筑集团|中国建筑股份有限公司/u] },
  { id: "cscec3b", name: "中建三局", patterns: [/中建三局|中建三局集团/u] },
];

/** 这些域名上的文章，发布方就是对应的公司（托管平台如 GitHub、arXiv 不算）。 */
export const PUBLISHER_DOMAINS: ReadonlyArray<{ entityId: string; domains: readonly string[] }> = [
  { entityId: "ndrc", domains: ["www.ndrc.gov.cn"] },
  { entityId: "mohurd", domains: ["www.mohurd.gov.cn"] },
  { entityId: "hubei-drc", domains: ["fgw.hubei.gov.cn"] },
  { entityId: "hubei-housing", domains: ["zjt.hubei.gov.cn"] },
  { entityId: "hubei-miit", domains: ["jxt.hubei.gov.cn"] },
  { entityId: "cscec", domains: ["www.cscec.com"] },
  { entityId: "cscec3b", domains: ["3bur.cscec.com"] },
];

/** 原文里的这些写法也算提到了对应公司。 */
export const IDENTITY_CONTEXT_ALIASES: ReadonlyArray<{ entityId: string; pattern: RegExp }> = [];
