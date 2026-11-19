import { compactTitle, topics } from "/topics.mjs";

const params = new URLSearchParams(location.search);
const tenderView = params.get("view") === "tenders";
const topic = topics.find(({ id }) => id === params.get("topic"));
const query = (params.get("q") ?? "").trim().slice(0, 100);
const featuredView = !tenderView && params.get("view") !== "all" && !topic && !query;
const relatedView = params.get("related") === "1" && tenderView && Boolean(query);
const view = tenderView ? "项目标讯" : featuredView ? "今日精选" : "全部动态";
const stageOptions = [
  { id: "", label: "全部阶段" },
  { id: "planning", label: "意向与计划" },
  { id: "bidding", label: "招采公告" },
  { id: "results", label: "候选与结果" },
  { id: "changes", label: "变更与答疑" },
];
const stage = stageOptions.find(({ id }) => id === params.get("stage"))?.id ?? "";
const allTenders = params.get("scope") === "all";
const digitalTitle = /数字化|数字孪生|数字建造|数字住建|数字校园|数字园区|数智|智能|智慧|信息化|信息系统|管理平台|一张图|一网统管|一网通办|城市生命线|电子政务|算力|智算|数据中心|光通信|通信网|(?<![a-z0-9])[56]G(?![a-z0-9])|千兆光网|无人机|低空智联网|感知|监测系统|物联网|\b(?:BIM|CIM|GIS|ICT)\b/i;
const coreTopics = new Set(topics.filter(({ primary }) => primary).map(({ id }) => id));
const titleSignals = /印发|发布|规划|实施方案|工作指引|征求意见|试点|专项债|预算|开工|验收|投运|上线|启动建设|典型案例|标准|改造|成果|投融资/;
const officialSources = /人民政府|发展改革委|住建[厅局部]|住房和城市更新局|住更局|自然资源|国家数据局|武汉市数据局|东湖高新区|中国政府网/;
const heading = document.querySelector("#feed-heading");
const list = document.querySelector("#feed");
const status = document.querySelector("#status");
const updated = document.querySelector("#updated");
const more = document.querySelector("#more");
const search = document.querySelector("#search");
const filters = document.querySelector("#filters");
const stageFilters = document.querySelector("#opportunity-filters");
const preview = document.querySelector("#opportunity-preview");
const previewStatus = document.querySelector("#opportunity-status");

heading.textContent = topic ? `${view} · ${topic.label}` : view;
if (!featuredView) document.title = `${heading.textContent} · 行业资讯`;
function markNavigation() {
  const selected = location.hash === "#topics" ? "topics" : tenderView ? "tenders" : featuredView ? "featured" : "all";
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.dataset.nav === selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}
markNavigation();
window.addEventListener("hashchange", markNavigation);
document.querySelector("#query").value = query;
document.querySelector("#feed-tools").hidden = featuredView;
preview.hidden = !featuredView;
document.querySelector("#content").classList.toggle("has-preview", featuredView);
stageFilters.hidden = !tenderView || relatedView;

function feedLink({ topicId = topic?.id, nextStage = stage, scope = allTenders, q = query, related = relatedView } = {}) {
  const href = new URL("/", location.href);
  href.searchParams.set("view", tenderView || related ? "tenders" : "all");
  if (topicId) href.searchParams.set("topic", topicId);
  if (nextStage) href.searchParams.set("stage", nextStage);
  if (scope) href.searchParams.set("scope", "all");
  if (q) href.searchParams.set("q", q);
  if (related) href.searchParams.set("related", "1");
  return `${href.pathname}${href.search}#articles`;
}

function filterLink(parent, label, href, selected) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = label;
  if (selected) link.setAttribute("aria-current", "page");
  parent.append(link);
  return link;
}

if (!featuredView && !relatedView) {
  for (const t of [{ id: "", label: "全部专题" }, ...topics]) {
    filterLink(filters, t.label, feedLink({ topicId: t.id }), t.id === (topic?.id ?? ""));
  }
}
if (tenderView && !relatedView) {
  for (const option of stageOptions) {
    filterLink(stageFilters, option.label, feedLink({ nextStage: option.id }), option.id === stage);
  }
  filterLink(stageFilters, allTenders ? "只看数字化项目" : "查看全部相关标讯",
    feedLink({ scope: !allTenders }), false).className = "scope";
}

for (const [name, value] of [["view", tenderView ? "tenders" : "all"], ["topic", topic?.id], ["stage", stage], ["scope", allTenders ? "all" : ""]]) {
  if (!value) continue;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  search.append(input);
}

function noticeStage(item) {
  const title = compactTitle(item.title);
  if (/答疑|澄清|补遗|更正|变更/.test(title)) return { id: "changes", label: "变更与答疑" };
  if (/采购意向/.test(title)) return { id: "planning", label: "采购意向" };
  if (/需求公示|征求意见/.test(title)) return { id: "planning", label: "需求公示" };
  if (/报建/.test(title)) return { id: "planning", label: "项目报建" };
  if (/招标计划/.test(title)) return { id: "planning", label: "招标计划" };
  if (/候选人|评标结果/.test(title)) return { id: "results", label: "候选或评标结果" };
  if (/中标|成交|废标|流标|终止/.test(title)) return { id: "results", label: "结果公告" };
  if (/hbggzyfwpt\.cn\/jyxx\/jsgcXmxxDetail2\?/.test(item.url)) return { id: "planning", label: "招标计划" };
  if (/hbggzyfwpt\.cn\/jyxx\/jsgcXmxxDetail3\?/.test(item.url)) return { id: "planning", label: "招采文件提前公示" };
  const category = /\/jyxx\/00300[12]\/(00300[12]\d{3})\//.exec(item.url)?.[1];
  if (category === "003001002") return { id: "planning", label: "招标计划" };
  if (category === "003002001") return { id: "planning", label: "需求公示" };
  if (category === "003001004") return { id: "changes", label: "变更与答疑" };
  if (category === "003001005") return { id: "results", label: "候选或评标结果" };
  if (category === "003001006" || category === "003002004") return { id: "results", label: "结果公告" };
  if (/招标公告|采购公告|资审|竞争性|询价|询比/.test(title) || category === "003001003" || category === "003002002") {
    return { id: "bidding", label: "招采公告" };
  }
  return { id: "", label: "公告" };
}

function projectNumber(item) {
  return /\b[A-Z]{3,6}-\d{6}[A-Z]{2}-\d{9}\b/i.exec(item.title)?.[0].toUpperCase();
}

function metadataText(parent, value, className = "") {
  const text = document.createElement("span");
  text.textContent = value;
  if (className) text.className = className;
  parent.append(text);
}

function toRow(item, { compact = false, relatedCounts } = {}) {
  const row = document.createElement("li");
  row.className = "entry";
  const title = document.createElement("a");
  title.href = item.url;
  title.textContent = item.title;
  const metadata = document.createElement("div");
  metadata.className = "metadata";
  const date = document.createElement("time");
  date.dateTime = item.date;
  date.textContent = item.date;
  metadata.append(date);
  metadataText(metadata, item.source);
  if (item.tender) {
    metadataText(metadata, noticeStage(item).label, "tag");
    if (!compact) {
      const details = item.opportunity ?? {};
      const number = projectNumber(item);
      if (details.buyer) metadataText(metadata, `采购方 ${details.buyer}`);
      if (details.location) metadataText(metadata, `地点 ${details.location}`);
      if (details.amount) metadataText(metadata, details.amount);
      if (details.deadline) metadataText(metadata, `投标或响应截止 ${details.deadline}`);
      if (!relatedView && number && relatedCounts?.get(number) > 1) {
        const related = document.createElement("a");
        related.className = "related";
        related.href = feedLink({ topicId: "", nextStage: "", scope: true, q: number, related: true });
        related.textContent = "同标段公告 ↗";
        metadata.append(related);
      }
    }
  } else {
    for (const subject of topics.filter(({ id }) => item.topics.includes(id))) metadataText(metadata, subject.label, "tag");
  }
  row.append(title, metadata);
  return row;
}

const day = 86_400_000;
const beijing = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
const now = Date.now();
const today = beijing.format(now);
const sevenDaysAgo = beijing.format(now - 6 * day);
const thirtyDaysAgo = beijing.format(now - 29 * day);

function edition(items) {
  const byHeadline = new Set();
  const recent = items.filter((item) => {
    if (item.tender || item.date < sevenDaysAgo || !item.topics.some((id) => coreTopics.has(id)) ||
      !titleSignals.test(item.title) || /签约仪式|工作会议召开|党建|庆祝活动/.test(item.title)) return false;
    const headline = compactTitle(item.title).replace(/[\p{P}\p{Z}]+/gu, "");
    if (byHeadline.has(headline)) return false;
    byHeadline.add(headline);
    return true;
  });
  const publishedToday = recent.filter((item) => item.date === today);
  const selected = publishedToday.length ? publishedToday : recent;
  return selected.map((item) => ({ item, rank: Number(officialSources.test(item.source)) }))
    .sort((a, b) => b.item.date.localeCompare(a.item.date) || b.rank - a.rank)
    .slice(0, 6).map(({ item }) => item);
}

function renderPreview(items) {
  const recent = items.filter((item) => item.tender && item.date >= thirtyDaysAgo && digitalTitle.test(compactTitle(item.title)));
  const priorities = ["planning", "bidding"];
  const shown = priorities.flatMap((id) => recent.filter((item) => noticeStage(item).id === id)).slice(0, 4);
  const previewList = document.querySelector("#opportunity-feed");
  previewList.append(...shown.map((item) => toRow(item, { compact: true })));
  previewList.hidden = !shown.length;
  previewStatus.textContent = shown.length ? "近 30 天意向、计划与招采公告" : "近 30 天暂无匹配的意向、计划或招采公告。";
}

try {
  const response = await fetch("/feed.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const feed = await response.json();
  const items = feed.items.filter((item) => /^https?:\/\//.test(item.url));
  updated.dateTime = feed.updated;
  updated.textContent = `最近更新 ${feed.updatedLabel}`;
  updated.hidden = false;

  if (featuredView) {
    const selected = edition(items);
    const earlier = selected.length > 0 && selected[0].date !== today;
    if (earlier) heading.textContent = "近 7 天精选";
    list.append(...selected.map((item) => toRow(item)));
    list.hidden = !selected.length;
    status.textContent = selected.length ? `共 ${selected.length} 条` : "近 7 天暂无符合精选规则的内容。";
    renderPreview(items);
    const featuredUrls = new Set(selected.map((item) => item.url));
    const latest = items.filter((item) => !item.tender && !featuredUrls.has(item.url)).slice(0, 5);
    document.querySelector("#latest-feed").append(...latest.map((item) => toRow(item)));
    document.querySelector("#latest").hidden = !latest.length;
  } else {
    const matches = items.filter((item) => item.tender === tenderView &&
      (!tenderView || allTenders || relatedView || digitalTitle.test(compactTitle(item.title))) &&
      (!topic || item.topics.includes(topic.id)) && (!stage || !tenderView || noticeStage(item).id === stage) &&
      (!query || `${compactTitle(item.title)} ${item.source} ${item.opportunity?.buyer ?? ""} ${item.opportunity?.location ?? ""}`
        .toLowerCase().includes(compactTitle(query).toLowerCase())));
    if (relatedView) heading.textContent = "同标段公告";
    const relatedCounts = new Map();
    if (tenderView && !relatedView) {
      for (const item of items) {
        const number = item.tender && projectNumber(item);
        if (number) relatedCounts.set(number, (relatedCounts.get(number) ?? 0) + 1);
      }
    }
    let count = 0;
    const renderNext = () => {
      const next = matches.slice(count, count + 30);
      list.append(...next.map((item) => toRow(item, { relatedCounts })));
      count += next.length;
      list.hidden = count === 0;
      more.hidden = count >= matches.length;
      status.textContent = count ? `共 ${matches.length} 条，当前显示 ${count} 条` : "当前筛选暂无内容，可切换专题或修改搜索词。";
    };
    more.addEventListener("click", renderNext);
    renderNext();
  }
} catch {
  status.textContent = "资讯列表暂时无法读取，请稍后刷新。";
  previewStatus.textContent = "商机列表暂时无法读取，请稍后刷新。";
}
