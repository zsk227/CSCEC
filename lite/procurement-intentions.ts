import { load } from "cheerio";

export type ProcurementProject = {
  title: string;
  requirement: string;
  amount?: string;
  expectedMonth?: string;
};

export function parseProcurementProjects(html: string): ProcurementProject[] {
  const $ = load(html);
  const projects: ProcurementProject[] = [];
  for (const table of $("table").toArray()) {
    const rows = $(table).find("tr").toArray().map((row) => $(row).children("td, th").toArray()
      .map((cell) => $(cell).text().replace(/\s+/g, " ").trim()));
    const headerIndex = rows.findIndex((row) => row.some((cell) => cell.replace(/\s/g, "") === "采购项目名称"));
    if (headerIndex < 0) continue;
    const columns = rows[headerIndex]!.map((cell) => cell.replace(/\s/g, ""));
    const name = columns.indexOf("采购项目名称");
    const requirement = columns.findIndex((cell) => cell.startsWith("采购需求概况"));
    const budget = columns.findIndex((cell) => /^预算金额[（(]万元[）)]$/.test(cell));
    const time = columns.findIndex((cell) => cell.startsWith("预计采购时间"));
    for (const row of rows.slice(headerIndex + 1)) {
      const title = row[name];
      if (!title || row.length !== columns.length) continue;
      const value = row[budget]?.replace(/,/g, "");
      const amount = value && /^\d+(?:\.\d+)?$/.test(value) ? "预算金额 " + value + "万元" : undefined;
      const month = /^(20\d{2})\s*[-年]\s*(0?[1-9]|1[0-2])月?$/.exec(row[time] ?? "");
      const expectedMonth = month ? month[1] + "-" + month[2]!.padStart(2, "0") : undefined;
      projects.push({ title, requirement: row[requirement] ?? "", ...(amount && { amount }), ...(expectedMonth && { expectedMonth }) });
    }
  }
  return projects;
}
