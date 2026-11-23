import { load } from "cheerio";

// Group filings and official recruitment notices document legal names and operating names.
// https://static.sse.com.cn/disclosure/bond/announcement/company/c/new/2026-04-30/240425_20260430_QHO9.pdf
// https://www.cscec.com/zgjz_new/ztzl_new/ggsnxd/ggzs/202211/3603090.html
// https://afdata.org.cn/EnterpriseArchives/f893b7b1-d49e-11ee-82b3-fa163e9af115
const subsidiaries = new Set([
  "中建壹品投资有限公司",
  "中建壹品投资发展有限公司",
  "武汉中建智能工程有限公司",
]);
const groupName = /^(?:中国建筑第三工程局|中建三局|湖北中建三局)[\p{Script=Han}\p{Script=Latin}\d().·-]*公司$/u;
const companyName = /^[\p{Script=Han}\p{Script=Latin}\d().·-]{3,80}公司$/u;

export function isAwardNotice(title: string, url: string): boolean {
  const headline = title.replace(/\s+/g, "");
  if (/候选人|评标结果|废标|流标|终止|结果(?:更正|变更|撤销)|(?:更正|变更|撤销)公告/.test(headline)) return false;
  return /(?:中标|成交|定标).{0,16}(?:公告|公示|结果)|(?:采购)?结果公告/.test(headline) ||
    /\/(?:003001006|003002004)\//.test(url);
}

const finalWinner = /^(?:中标人(?:名称)?|中标单位(?:名称)?|中标供应商(?:名称)?|成交人(?:名称)?|成交单位(?:名称)?|成交供应商(?:名称)?|中标\(成交\)(?:供应商|人|单位)(?:名称)?)$/;
const winnerSubfield = /^(?:联合体(?:牵头人|成员)(?:名称)?|牵头单位|成员单位)$/;

function label(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, "").replace(/[:]+$/, "");
}

function companyNames(value: string): string[] {
  return value.normalize("NFKC").split(/[、,;\r\n]+/).map((part) => {
    const compact = part.replace(/\s+/g, "");
    return compact
      .replace(/^(?:\d+[.、]|[（(]?[一二三四五六七八九十]+[）)、.])/, "")
      .replace(/^(?:联合体(?:牵头人|成员(?:单位)?)(?:名称)?|牵头单位|成员单位)[:]?/, "")
      .replace(/\((?:联合体)?(?:牵头人|牵头单位|成员|成员单位)\)$/, "");
  }).filter((name) => companyName.test(name));
}

/** undefined means that the page did not expose a readable winner field; [] means other winners. */
export function readCscecAwards(html: string): string[] | undefined {
  let $ = load(html);
  let article = $(".article-content, .ewb-article-info, #contentText, .v_news_content").first();
  if (!article.length) return undefined;
  const raw = article.text();
  // Some local exchange templates print the actual result table as escaped HTML.
  if (!article.find("td, th").length && /<table[\s>]/i.test(raw)) {
    $ = load("<article>" + raw + "</article>");
    article = $("article").first();
  }

  article.find("script, style, noscript").remove();
  article.find("br").replaceWith("\n");
  const names = new Set<string>();
  const add = (value: string) => companyNames(value).forEach((name) => names.add(name));
  article.find("tr").each((_index, row) => {
    const cells = $(row).children("td, th").toArray();
    const labels = cells.map((cell) => label($(cell).text()));
    const horizontal = labels.some((value) => /^(?:中标价|中标价格|中标金额|成交金额|中标报价|报价|其他)(?:\(.+\))?$/.test(value));
    labels.forEach((value, column) => {
      const direct = finalWinner.test(value);
      const consortium = winnerSubfield.test(value) && $(row).closest("table").find("td, th").toArray()
        .some((cell) => finalWinner.test(label($(cell).text())));
      if (!direct && !consortium) return;
      if (horizontal) {
        const data = $(row).next("tr").children("td, th").eq(column);
        add(data.text());
      } else if (direct || column === 0) {
        const next = cells[column + 1];
        if (next) add($(next).text());
      }
    });
  });

  let inAwardInformation = false;
  article.find("h2, h3, h4, p, div, li, td").each((_index, element) => {
    if ($(element).find("p, div, li, td").length) return;
    for (const line of $(element).text().split("\n")) {
      const heading = /^[一二三四五六七八九十]+、(.+)$/.exec(label(line));
      if (heading) inAwardInformation = /^(?:中标\(成交\)|中标|成交)(?:供应商)?(?:信息|结果)$/.test(heading[1]!);
      const field = /^\s*(?:\d+[、.]\s*)?([^:：]{1,30})\s*[:：]\s*(.+)$/.exec(line);
      if (field && (finalWinner.test(label(field[1]!)) || (inAwardInformation && label(field[1]!) === "供应商名称"))) add(field[2]!);
    }
  });
  return names.size ? [...names].filter((name) => groupName.test(name) || subsidiaries.has(name)) : undefined;
}
