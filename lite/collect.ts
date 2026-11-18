// Builds a public list from the approved web and JSON sources, without a database or model calls.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beijingDate, beijingTime } from "@aihot/contracts/time";
import { assertSupportedConfig } from "../packages/backend/src/sources/config-keys.ts";
import { fetchJsonList } from "../packages/backend/src/sources/json-list.ts";
import { fetchDetail, fetchWebList } from "../packages/backend/src/sources/web-list.ts";
import { normalizeUrl } from "../packages/backend/src/lib/url.ts";
import type { Candidate, SourceRow } from "../packages/backend/src/sources/types.ts";
import { topics } from "./topics.mjs";

type Entry = { title: string; url: string; source: string; date: string; topics: string[]; tender: boolean };
type Feed = { updated: string; updatedLabel: string; items: Entry[] };

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

function topicIds(title: string): string[] {
  // Search highlights can introduce spaces inside Chinese names, e.g. 城市 生命 线.
  const text = title.replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, "");
  return topics.filter((topic) => topic.terms.test(text)).map((topic) => topic.id);
}

function normalize(item: Candidate, source: SourceRow): Entry | null {
  // A match in the title avoids publishing tenders that mention a keyword only in standard clauses.
  const matched = topicIds(item.title);
  if (!matched.length || !item.publishedAt) return null;
  const url = normalizeUrl(item.url);
  if (!url || !/^https?:\/\//.test(url) || new URL(url).username || new URL(url).password) return null;
  const date = beijingDate(item.publishedAt);
  if (date < earliest || date > currentDate) return null;
  const tender = source.id.startsWith("hb-tenders-") ||
    (["hb-procurement-intentions", "hubei-exchange-notices"].includes(source.id) && notice.test(item.title));
  return { title: item.title, url, source: source.name, date, topics: matched, tender };
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

const entries = new Map((previous?.items ?? []).filter((item) => item.date >= earliest).map((item) => [item.url, item]));
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
      const existing = entries.get(item.url);
      entries.set(item.url, { ...item, tender: item.tender || existing?.tender === true });
    }
    console.log(`${source.id}: ${result.found} listings, ${result.items.length} matched`);
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`${source.id}: unavailable (${message}${cause instanceof Error ? `, ${cause.message}` : ""})`);
  }
}

const items = [...entries.values()].sort((a, b) => b.date.localeCompare(a.date) || a.url.localeCompare(b.url));
console.log(`Sources ${successful}/${sources.length} (${newsSources} web, ${tenderSources} Hubei searches). Feed ${items.length} items (${items.filter((item) => item.tender).length} tenders).`);
if (!tenderSources || !newsSources || !items.some((item) => item.tender) || !items.some((item) => !item.tender)) {
  throw new Error("Collection must verify both Hubei tender searches and industry articles before publishing");
}
mkdirSync(out, { recursive: true });
const unchanged = previous && JSON.stringify(previous.items) === JSON.stringify(items);
const updated = unchanged ? previous.updated : now.toISOString();
writeFileSync(join(out, "feed.json"), JSON.stringify({ updated, updatedLabel: `${beijingDate(updated)} ${beijingTime(updated)}`, items } satisfies Feed));
