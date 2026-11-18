import { topics } from "/topics.mjs";

const params = new URLSearchParams(location.search);
const tenderView = params.get("view") === "tenders";
const topic = topics.find(({ id }) => id === params.get("topic"));
const query = (params.get("q") ?? "").trim().slice(0, 100);
const view = tenderView ? "湖北标讯" : "行业动态";
const heading = document.querySelector("#feed-heading");
const list = document.querySelector("#feed");
const status = document.querySelector("#status");
const updated = document.querySelector("#updated");
const more = document.querySelector("#more");
const search = document.querySelector("#search");
const filters = document.querySelector("#filters");

heading.textContent = topic ? `${view} · ${topic.label}` : view;
if (tenderView || topic || query) document.title = `${heading.textContent} · 行业资讯`;
document.querySelector(`[data-nav="${tenderView ? "tenders" : "all"}"]`).setAttribute("aria-current", "page");
document.querySelector("#query").value = query;

function linkFor(topicId) {
  const href = new URL("/", location.href);
  if (tenderView) href.searchParams.set("view", "tenders");
  if (topicId) href.searchParams.set("topic", topicId);
  if (query) href.searchParams.set("q", query);
  return `${href.pathname}${href.search}#articles`;
}

for (const t of [{ id: "", label: "全部" }, ...topics]) {
  const link = document.createElement("a");
  link.href = linkFor(t.id);
  link.textContent = t.label;
  if (t.id === (topic?.id ?? "")) link.setAttribute("aria-current", "page");
  filters.append(link);
}

for (const [name, value] of [["view", tenderView ? "tenders" : ""], ["topic", topic?.id]]) {
  if (!value) continue;
  const input = document.createElement("input");
  input.type = "hidden";
  input.name = name;
  input.value = value;
  search.append(input);
}

function toRow(item) {
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
  const source = document.createElement("span");
  source.textContent = item.source;
  metadata.append(date, source);
  if (item.tender) {
    const label = document.createElement("span");
    label.className = "tag";
    label.textContent = "湖北标讯";
    metadata.append(label);
  }
  row.append(title, metadata);
  return row;
}

try {
  const response = await fetch("/feed.json");
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const feed = await response.json();
  const matches = feed.items.filter((item) => /^https?:\/\//.test(item.url) && (!tenderView || item.tender) &&
    (!topic || item.topics.includes(topic.id)) && (!query || `${item.title} ${item.source}`.toLowerCase().includes(query.toLowerCase())));
  updated.dateTime = feed.updated;
  updated.textContent = `最近更新 ${new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", dateStyle: "medium", timeStyle: "short" }).format(new Date(feed.updated))}`;
  updated.hidden = false;
  let count = 0;
  const renderNext = () => {
    const next = matches.slice(count, count + 30);
    list.append(...next.map(toRow));
    count += next.length;
    list.hidden = count === 0;
    more.hidden = count >= matches.length;
    status.textContent = count ? `共 ${matches.length} 条，当前显示 ${count} 条` : "当前筛选暂无内容，可切换专题或修改搜索词。";
  };
  more.addEventListener("click", renderNext);
  renderNext();
} catch {
  status.textContent = "资讯列表暂时无法读取，请稍后刷新。";
}
