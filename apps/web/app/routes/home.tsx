import { redirect, useLoaderData } from "react-router";
import { SITE } from "@aihot/site";
import type { Route } from "./+types/home";
import type { TimelineResponse } from "@aihot/contracts/site";
import { cachedPage, loadOr404 } from "../lib/api.server";
import { pageReuse } from "../lib/page-reuse";
import { filterParams, hasFeedFilters, itemListLd, listPath, pageMeta, readFilters, siteLd } from "../lib/seo";
import { inNav } from "../components/shell/nav";
import type { Screen } from "../components/shell/screens";
import { Timeline } from "../features/feed/Timeline";
import { HotTopics } from "../features/feed/HotTopics";
import { ActiveFilters, CategoryTabs, FeedBar, SearchField } from "../features/feed/Filters";
import { IntentLink } from "../components/ui/IntentLink";
import directory from "../../../../industry/topics.json";

export const handle: Screen = { tab: "featured", name: "精选" };
export { pageHeaders as headers } from "../lib/api.server";
export const { clientLoader, shouldRevalidate } = pageReuse<typeof loader>();

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q");
  // Search lives on /all; keep the parameters so old links still land on results.
  if (q && q.trim()) throw redirect(`/all${url.search}`);
  const filters = readFilters(url.searchParams);
  const upstream = new Headers();
  const data = await loadOr404<TimelineResponse>(listPath("/api/site/timeline", filterParams(filters)), { responseHeaders: upstream, signal: request.signal });
  // A minute at most, here and on /all: new selections must not wait longer at the edge or in a browser.
  return cachedPage(60, { data, filters }, upstream);
}

export function meta({ loaderData }: Route.MetaArgs) {
  const path = listPath("/", loaderData ? filterParams(loaderData.filters) : {});
  const titles = loaderData?.data.cards.map((c) => c.item.title) ?? [];
  const tags = pageMeta({ path, noindex: hasFeedFilters(loaderData?.filters), jsonLd: path === "/" ? [...siteLd(), itemListLd("/", "精选", titles)] : undefined });
  // Webmaster platforms look for their verification tag on the home page only.
  if (path !== "/") return tags;
  return [...tags, ...Object.entries(SITE.siteVerification).map(([name, content]) => ({ name, content }))];
}

const networkTopics = directory.topics.filter((topic) => topic.group === "six-networks");
const reading = [
  { title: "全国智能建造工作会", source: "住房城乡建设部", href: "https://www.mohurd.gov.cn/xinwen/jsyw/art/2025/art_d78f4db2f9e646fb94c623e506e16051.html" },
  { title: "六张网规划建设解读", source: "国家发展改革委", href: "https://www.ndrc.gov.cn/xwdt/wszb/7yxwfbh/" },
  { title: "2026 年湖北绿色智能建造试点项目名单", source: "湖北省住建厅", href: "https://zjt.hubei.gov.cn/zfxxgk/zc/qtzdgkwj/202609/t20260908_6009802.shtml" },
  { title: "湖北六张网重大项目投融资对接", source: "国家发展改革委", href: "https://www.ndrc.gov.cn/xwdt/dt/dfdt/202609/t20260922_1407755.html" },
];

function IndustryOverview() {
  return (
    <section aria-labelledby="industry-heading" className="mb-6 overflow-hidden rounded-card bg-[#132d34] text-[#f3f8f7]">
      <div className="grid gap-6 p-5 sm:p-7 xl:grid-cols-[1.15fr_1fr] xl:items-center">
        <div>
          <h1 id="industry-heading" data-page-title="" className="text-[clamp(1.65rem,4.2vw,2.85rem)] font-bold leading-[1.2] tracking-tight">
            数智建造与六张网
          </h1>
          <p className="mt-3 max-w-[36ch] text-[14px] leading-relaxed text-[#d2e4e3]">
            关注湖北及全国的行业政策、项目进展和工程实践。
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-[13px] font-semibold">
            <IntentLink to="/?category=digital-construction" className="rounded-tile bg-[#c9f1e7] px-3 py-2 text-[#132d34] hover:bg-white">
              浏览数智建造
            </IntentLink>
            <IntentLink to="/topics" className="rounded-tile px-2 py-2 text-[#c9f1e7] hover:underline">
              查看全部专题 <span aria-hidden="true">↗</span>
            </IntentLink>
          </div>
        </div>
        <ul aria-label="六张网专题" className="grid grid-cols-2 gap-px overflow-hidden rounded-tile border border-[#49676d] bg-[#49676d] sm:grid-cols-3 xl:grid-cols-2">
          {networkTopics.map((topic) => (
            <li key={topic.slug}>
              <IntentLink to={`/topics/${topic.slug}`} className="flex h-full items-center justify-between gap-1 bg-[#1c3a43] px-3 py-3 text-[13px] font-medium hover:bg-[#2e535b] focus-visible:relative">
                {topic.name}<span aria-hidden="true" className="text-[#a3d6ce]">↗</span>
              </IntentLink>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t border-[#49676d] px-5 py-4 sm:px-7">
        <h2 className="mb-2 text-[13px] font-semibold text-[#c9f1e7]">政策与项目资料</h2>
        <ul className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {reading.map(({ title, source, href }) => (
            <li key={href} className="text-[13px] leading-relaxed">
              <a href={href} className="underline-offset-4 hover:underline">{title}</a>
              <span className="ml-2 text-[#aac7c8]">{source}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function Home() {
  const { data, filters } = useLoaderData<typeof loader>();
  const title = filters.tag ? `#${filters.tag}` : "精选";
  const showOverview = !hasFeedFilters(filters);
  return (
    <div className="pb-6">
      {/* Phones: the bar (精选 | 全部, filter, search), the filter in use, today's hot topics, the feed. */}
      <FeedBar base="/" category={filters.category} channel={filters.channel} />
      <ActiveFilters base="/" category={filters.category} channel={filters.channel} tag={filters.tag} />
      {showOverview && <IndustryOverview />}
      <div className="hidden lg:block">
        {showOverview
          ? <h2 className="text-[24px] font-semibold leading-[1.3] text-ink">{title}</h2>
          : <h1 className="text-[24px] font-semibold leading-[1.3] text-ink">{title}</h1>}
        <div className="mb-5 mt-4 flex items-center justify-between gap-4">
          <CategoryTabs base="/" category={filters.category} channel={filters.channel} layoutId="home-cat-desk" className="min-w-0" />
          <SearchField keep={{ category: filters.category }} />
        </div>
      </div>

      {data.hot && inNav("/hot") && <HotTopics entries={data.hot} />}

      <Timeline initial={data} filters={data.filters} />
    </div>
  );
}
