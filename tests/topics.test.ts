// Topic pages: which articles a topic takes, and their counts.
// Written before the code, from the ways it can go wrong:
// - a company topic takes an article about another company that only mentions it (several subjects,
//   its name nowhere in the title), or drops one about it whose title names it in English, in another
//   case, next to Chinese text, or only by a product (it is the article's only subject);
// - a Latin name matches inside another word ("Metadata" is not Meta); a headline naming a company
//   that is not a subject of the article gets in;
// - a technical-direction topic stops taking its tags;
// - withdrawn or not yet released articles appear in a list or a count;
// - an article or story page names a topic its reports do not belong to;
// - an article page cannot tell which of its tags are a topic's own, so they link to filtered lists;
// - a topic without content has no page, or an unknown slug or a page past the end has one.
import { tag } from "./setup.ts";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, test } from "node:test";
import { closeDb, sql } from "@aihot/backend/db";
import { upsertMaterial } from "@aihot/backend/content/materials";
import { stopBoss } from "@aihot/backend/jobs/queue";
import { publishArticle } from "@aihot/backend/publication/publish";
import { TOPICS, loadTopicPage, listTopicSummaries, topicsOfStory } from "@aihot/backend/publication/topics";
import { buildApp } from "../apps/api/src/app.ts";

const T = tag();
const OFFICIAL = `test-topics-official-${T}`;
const MEDIA = `test-topics-media-${T}`;
const app = await buildApp();

before(async () => {
  await sql`INSERT INTO sources (id, name, kind, tier, participation_mode, first_party, next_fetch_at) VALUES
    (${OFFICIAL}, 'Official', 'rss', 'T1', 'editorial', true, '2100-01-01'),
    (${MEDIA}, 'Media', 'rss', 'T2', 'editorial', false, '2100-01-01')`;
});
after(async () => {
  await app.close();
  await stopBoss();
  await closeDb();
});

let n = 0;
interface Report {
  source?: string;
  at: Date;
  title: string;
  originalTitle?: string;
  subjects?: string[];
  tags?: string[];
  score?: number;
  selected?: boolean;
  fact?: number;
  category?: string;
}

/** A published report; `fact` links it to a fact before publishing, as grouping would. */
async function report(r: Report): Promise<string> {
  n += 1;
  const { articleId } = await upsertMaterial({
    sourceId: r.source ?? MEDIA, url: `https://example.com/topics-${T}-${n}`, title: r.originalTitle ?? r.title, bodyText: "body", bodyHtml: "<p>body</p>", bodyStatus: "ok", via: "fetch", publishedAt: r.at,
  });
  await sql`UPDATE articles SET discovered_at = ${r.at}, timeline_at = ${r.at}, grouped_at = now() WHERE id = ${articleId}`;
  await sql`INSERT INTO analyses (article_id, input_revision, origin, relevance, category, title_zh, summary_zh, score, selected, subjects, tags)
            VALUES (${articleId}, 1, 'rule', 'pass', ${r.category ?? "digital-construction"}, ${r.title}, ${`摘要 ${n}`}, ${r.score ?? 80}, ${r.selected ?? true}, ${r.subjects ?? []}, ${["政策/标准", ...(r.tags ?? [])]})`;
  if (r.fact) await sql`INSERT INTO fact_articles (fact_id, article_id, role) VALUES (${r.fact}, ${articleId}, 'report')`;
  await publishArticle(articleId, { releasedAt: new Date(r.at.getTime() + 60_000) });
  return articleId;
}

async function story(title: string): Promise<{ id: number; publicId: string }> {
  const publicId = randomUUID();
  const [s] = await sql<{ id: number }[]>`INSERT INTO stories (public_id, title, first_report_at, latest_at) VALUES (${publicId}, ${title}, now(), now()) RETURNING id`;
  return { id: s!.id, publicId };
}

async function fact(storyId: number | null, title: string): Promise<number> {
  const [f] = await sql<{ id: number }[]>`INSERT INTO facts (public_id, story_id, title) VALUES (${`f-${T}-${randomUUID()}`}, ${storyId}, ${title}) RETURNING id`;
  return f!.id;
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const ids = (items: Array<{ id: string }>) => items.map((i) => i.id);
const page = async (slug: string, p = 1) => {
  const data = await loadTopicPage(slug, p, new Date());
  assert.ok(data, `${slug} page ${p}`);
  return data;
};
/** Every article of a topic, over all its pages. */
async function members(slug: string): Promise<string[]> {
  const first = await page(slug);
  const out = ids(first.items);
  for (let p = 2; p <= first.pageCount; p++) out.push(...ids((await page(slug, p)).items));
  return out;
}

test("a company topic takes the articles about it, not the ones that only mention it", async () => {
  const about = await report({ at: hoursAgo(30), title: `中建集团发布工程平台 ${T}`, subjects: ["cscec"] });
  const product = await report({ at: hoursAgo(31), title: `工地系统新版上线 ${T}`, subjects: ["cscec"] });
  const english = await report({ at: hoursAgo(32), title: `新模型发布 ${T}`, originalTitle: `中国建筑集团发布工程方案 ${T}`, subjects: ["cscec", "hubei-housing"] });
  const subpoena = await report({ at: hoursAgo(33), title: `湖北省住建厅发布试点名单 ${T}`, subjects: ["hubei-housing", "cscec", "cscec3b"] });
  const lowerCase = await report({ at: hoursAgo(34), title: `湖北省住房和城乡建设厅公布新的交付指南 ${T}`, subjects: ["hubei-housing", "cscec"] });
  const pact = await report({ at: hoursAgo(35), title: `二十余家科技公司签署安全协议 ${T}`, subjects: ["hubei-housing", "cscec", "hubei-miit"] });
  const unrelated = await report({ at: hoursAgo(36), title: `数据标准发布，湖北省住建厅参与 ${T}`, subjects: ["mohurd", "hubei-housing"] });
  const adjacent = await report({ at: hoursAgo(37), title: `住建部发布新的工程标准 ${T}`, subjects: ["mohurd", "hubei-housing"] });
  const headline = await report({ at: hoursAgo(38), title: `中建集团被一篇盘点提到 ${T}`, subjects: ["hubei-miit"] });
  const agent = await report({ at: hoursAgo(39), title: `算力调度平台发布 ${T}`, tags: ["算力网"] });

  const cscec = await members("cscec");
  for (const id of [about, product, english]) assert.ok(cscec.includes(id), "about 中建集团");
  for (const id of [subpoena, lowerCase, pact, headline]) assert.ok(!cscec.includes(id), "only mentions 中建集团");
  const hubeiHousing = await members("hubei-housing");
  for (const id of [subpoena, lowerCase, unrelated]) assert.ok(hubeiHousing.includes(id), "about 湖北省住建厅");
  for (const id of [english, pact]) assert.ok(!hubeiHousing.includes(id), "only mentions 湖北省住建厅");
  const mohurd = await members("mohurd");
  assert.ok(mohurd.includes(adjacent), "the ministry's common short name matches");
  assert.ok(!mohurd.includes(unrelated), "a subject absent from the headline does not match");
  assert.ok((await members("computing-network")).includes(agent), "a technical direction takes its tag");

  // The article page names the topics it belongs to.
  const topicsOf = async (id: string) => {
    const res = await app.inject({ method: "GET", url: `/api/site/items/${id}` });
    return (JSON.parse(res.body) as { topics: Array<{ slug: string }> }).topics.map((t) => t.slug);
  };
  assert.deepEqual(await topicsOf(about), ["policy-standards", "cscec"]);
  assert.deepEqual(await topicsOf(subpoena), ["policy-standards", "hubei-housing"]);
  assert.deepEqual(await topicsOf(pact), ["policy-standards"]);
  assert.deepEqual(await topicsOf(agent), ["computing-network", "policy-standards"]);
});

test("an article page says which of its tags are a topic's own", async () => {
  // A direction's or a form's tags, and the tag cards show for a company (its subject tag is never shown).
  const id = await report({ at: hoursAgo(3), title: `中建集团发布算力调度平台 ${T}`, subjects: ["cscec", "hubei-housing"], tags: ["算力网", "案例/实践", "中建集团", "湖北省住建厅", "框架"] });
  const res = await app.inject({ method: "GET", url: `/api/site/items/${id}` });
  const body = JSON.parse(res.body) as { tags: string[]; tagTopics: Record<string, string>; topics: Array<{ slug: string }> };
  assert.deepEqual(body.tags, ["政策/标准", "算力网", "案例/实践", "中建集团", "湖北省住建厅", "框架"]);
  assert.deepEqual(body.tagTopics, { "政策/标准": "policy-standards", "算力网": "computing-network", "案例/实践": "case-practice", 中建集团: "cscec", 湖北省住建厅: "hubei-housing" });
  // The company its title does not name is a topic of the tag, not of the article.
  assert.deepEqual(body.topics.map((t) => t.slug), ["computing-network", "policy-standards", "case-practice", "cscec"]);
});

test("a company alias finds reports tagged with its subject", async () => {
  const id = await report({at: hoursAgo(2), title: `地方智能建造试点启动 ${T}`, subjects: ['hubei-drc'], selected: false});
  for (const query of ['湖北省发展改革委', '湖北省发改委']) {
    const res = await app.inject({method: 'GET', url: `/api/site/pool?q=${encodeURIComponent(query)}`});
    assert.equal(res.statusCode, 200);
    assert.ok(ids(JSON.parse(res.body).items).includes(id), 'full company names must still find subject-tagged reports');
  }
});

test("a story page names the topics of its reports", async () => {
  const launch = await story(`算力调度平台上线 ${T}`);
  await report({ source: OFFICIAL, at: hoursAgo(26), title: `算力调度平台上线 ${T}`, tags: ["算力网"], fact: await fact(launch.id, "平台上线") });
  assert.deepEqual(await topicsOfStory(launch.id), [{ slug: "computing-network", name: "算力网" }, { slug: "policy-standards", name: "政策与标准" }]);
});

test("withdrawn articles stay out of lists and counts", async () => {
  const kept = await report({ at: hoursAgo(5), title: `国家发展改革委公布算力方案 ${T}`, subjects: ["ndrc"] });
  const withdrawn = await report({ at: hoursAgo(4), title: `国家发展改革委撤回的消息 ${T}`, subjects: ["ndrc"] });
  await sql`UPDATE publications SET visibility = 'withdrawn' WHERE article_id = ${withdrawn}`;

  const data = await page("ndrc");
  assert.deepEqual(ids(data.items), [kept]);
  assert.equal(data.topic.total, 1);
  const summary = (await listTopicSummaries()).topics.find((t) => t.slug === "ndrc")!;
  assert.equal(summary.latest?.title, `国家发展改革委公布算力方案 ${T}`, "the index shows the newest public article");
});

test("every topic has a page; unknown topics and pages past the end have none", async () => {
  const empty = await page("water-network");
  assert.equal(empty.topic.indexable, false, "a topic without content is not indexed");
  assert.deepEqual(empty.items, []);
  assert.equal(await loadTopicPage("not-a-topic", 1, new Date()), null);
  assert.equal(await loadTopicPage("water-network", 2, new Date()), null);
  const index = await app.inject({ method: "GET", url: "/api/site/topics" });
  const body = JSON.parse(index.body) as { groups: Array<{ key: string }>; topics: Array<{ slug: string }> };
  assert.deepEqual(body.groups.map((g) => g.key), ["six-networks", "field", "genre", "company"]);
  assert.deepEqual(body.topics.map((t) => t.slug).sort(), TOPICS.map((t) => t.slug).sort(), "the index lists every topic");
});
