// Builds a public list from the approved web and JSON sources, without a database or model calls.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beijingDate, beijingTime } from "@aihot/contracts/time";
import { assertSupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import { fetchJsonList } from "../packages/backend/src/sources/json-list.ts";
import { fetchDetail, fetchWebList } from "../packages/backend/src/sources/web-list.ts";
import { normalizeUrl } from "../packages/backend/src/lib/url.ts";
import type { Candidate, SourceRow } from "../packages/backend/src/sources/types.ts";
import { articleUrl } from "./links.ts";
import { compactTitle, topics } from "./topics.mjs";

type Opportunity = { buyer?: string; location?: string; amount?: string; deadline?: string };
type Entry = { title: string; url: string; source: string; date: string; topics: string[]; tender: boolean; curated?: true; opportunity?: Opportunity };
type Feed = { updated: string; updatedLabel: string; items: Entry[] };
type WechatLink = Pick<Entry, "title" | "url" | "date" | "topics"> & { sourceId: string };

const archiveDays = 120;
const now = new Date();
const earliest = beijingDate(new Date(now.getTime() - archiveDays * 86_400_000));
const currentDate = beijingDate(now);
const out = process.argv[2] ?? "lite/dist";
const old = process.argv[3];
const input: { sources: SourceRow[] } = JSON.parse(readFileSync(new URL("../industry/sources.json", import.meta.url), "utf8"));
const sources = input.sources.filter((source) => source.enabled !== false && ["web_list", "json_list"].includes(source.kind));
const previous: Feed | undefined = old && existsSync(old) ? JSON.parse(readFileSync(old, "utf8")) : undefined;
const notice = /招标|采购|成交|中标|竞争性(?:磋商|谈判)|询价|询比/;

function isExchangeNotice(url: string): boolean {
  return /^https?:\/\/(?:www\.)?hbggzyfwpt\.cn\/jyxx\//i.test(url);
}

function isTender(title: string, source: SourceRow, url: string): boolean {
  return source.id.startsWith("hb-tenders-") ||
    (source.id === "hubei-exchange-notices" && isExchangeNotice(url)) ||
    (["hb-procurement-intentions", "hubei-exchange-notices"].includes(source.id) && notice.test(title));
}

function topicIds(title: string): string[] {
  const text = compactTitle(title);
  return topics.filter((topic) => topic.terms.test(text)).map((topic) => topic.id);
}

function opportunity(excerpt: string): Opportunity | undefined {
  const buyer = /(?:招标人为|(?:采购人|采购单位|招标人)\s*[:：])\s*([\p{Script=Han}（）()·]{4,60})(?=[，。；、;,.]|\s|$)/u.exec(excerpt)?.[1];
  const location = /建设地点\s*[:：]\s*([^。；，;<>]{2,35}?)(?=[。；，;]|\s+(?:建设规模|其他|招标范围)|$)/.exec(excerpt)?.[1].trim();
  const amount = /((?:采购预算|预算金额|招标控制价|最高限价|合同估算价|投资总额)(?:为|\s*[:：])\s*(?:人民币\s*)?[\d,.]+\s*(?:万元|元|亿元))/.exec(excerpt)?.[1];
  const deadline = /(?:投标文件递交截止时间|投标截止时间|响应文件提交截止时间)\s*(?:为|[:：])\s*(20\d{2}[-年/]\s*\d{1,2}[-月/]\s*\d{1,2}日?(?:\s+\d{1,2}[:：]\d{2})?)/.exec(excerpt)?.[1];
  return buyer || location || amount || deadline ? { buyer, location, amount, deadline } : undefined;
}

function normalize(item: Candidate, source: SourceRow): Entry | null {
  // A match in the title avoids publishing tenders that mention a keyword only in standard clauses.
  const tender = isTender(item.title, source, item.url);
  const matched = topicIds(item.title);
  if (!matched.length || !item.publishedAt) return null;
  const url = articleUrl(item.url);
  if (!url) return null;
  const date = beijingDate(item.publishedAt);
  if (date < earliest || date > currentDate) return null;
  const detail = tender && item.excerpt ? opportunity(item.excerpt) : undefined;
  return { title: item.title, url, source: source.name, date, topics: matched, tender, ...(detail && { opportunity: detail }) };
}

async function read(source: SourceRow) {
  assertSupportedConfig(source.kind, source.config);
  if (typeof source.config.url !== "string" || !/^https?:\/\//.test(source.config.url) || /^https?:\/\/r\.jina\.ai\//.test(source.config.url)) {
    throw new Error("Only public, direct listings are allowed");
  }
  const items = await (source.kind === "json_list" ? fetchJsonList(source) : fetchWebList(source));
  let dateReads = 0;
  for (const item of items) {
    if (item.publishedAt || !source.config.detail || dateReads >= 4 || !topicIds(item.title).length) continue;
    dateReads++;
    const detail = await fetchDetail(item.url, source, { date: true, title: false, summary: false, body: false }).catch(() => null);
    if (detail?.publishedAt) item.publishedAt = detail.publishedAt;
  }
  return { found: items.length, items: items.map((item) => normalize(item, source)).filter((item): item is Entry => item !== null) };
}

// Keep canonical identity keys separate from the original links readers open.
const entries = new Map<string, Entry>();
for (const item of previous?.items ?? []) {
  if (item.curated || item.date < earliest) continue;
  const url = articleUrl(item.url, { legacy: true });
  if (!url) continue;
  const topics = [...new Set([...item.topics, ...topicIds(item.title)])];
  entries.set(normalizeUrl(url)!, { ...item, url, topics, tender: item.tender || isExchangeNotice(url) });
}
let successful = 0;
let tenderSources = 0;
let newsSources = 0;
// Serialize fetches to avoid bursts against the province's shared search endpoint.
for (const source of sources) {
  try {
    const result = await read(source);
    if (!result.found) throw new Error("The source returned an empty listing");
    successful++;
    if (source.kind === "json_list") tenderSources++;
    else newsSources++;
    for (const item of result.items) {
      const key = normalizeUrl(item.url)!;
      const existing = entries.get(key);
      const details = item.opportunity ?? existing?.opportunity;
      entries.set(key, { ...item, tender: item.tender || existing?.tender === true, ...(details && { opportunity: details }) });
    }
    console.log(`${source.id}: ${result.found} listings, ${result.items.length} matched`);
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${source.id}: unavailable (${message}${cause instanceof Error ? `, ${cause.message}` : ""})`);
  }
}

const wechatLinks: WechatLink[] = JSON.parse(readFileSync(new URL("./wechat-links.json", import.meta.url), "utf8"));
for (const { sourceId, title, url, date, topics: selectedTopics } of wechatLinks) {
  const source = input.sources.find((source) => source.id === sourceId && source.kind === "mp_account");
  if (!source || !title.trim() || !/^https:\/\/mp\.weixin\.qq\.com\/s\/[\w-]+$/.test(url) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) || !selectedTopics.every((id) => topics.some((topic) => topic.id === id))) {
    throw new Error(`Invalid curated WeChat link for ${sourceId}`);
  }
  const key = normalizeUrl(url)!;
  if (date < earliest || date > currentDate || entries.has(key)) continue;
  entries.set(key, { title, url, date, source: `${source.name} · 微信公众号`, topics: [...new Set([...selectedTopics, ...topicIds(title)])], tender: false, curated: true });
}

const items = [...entries.values()].sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
console.log(`Sources ${successful}/${sources.length} (${newsSources} web, ${tenderSources} Hubei searches). Feed ${items.length} items (${items.filter((item) => item.tender).length} tenders).`);
if (!tenderSources || !newsSources || !items.some((item) => item.tender) || !items.some((item) => !item.tender && !item.curated)) {
  throw new Error("Collection must verify both Hubei tender searches and industry articles before publishing");
}
mkdirSync(out, { recursive: true });
const unchanged = previous && JSON.stringify(previous.items) === JSON.stringify(items);
const updated = unchanged ? previous.updated : now.toISOString();
writeFileSync(join(out, "feed.json"), JSON.stringify({ updated, updatedLabel: `${beijingDate(updated)} ${beijingTime(updated)}`, items } satisfies Feed));
