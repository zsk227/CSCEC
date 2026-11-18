import { cpSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2] ?? "lite/dist";
const feed = join(out, "feed.json");
if (!existsSync(feed)) throw new Error("Run the collector before building the site");
const { items } = JSON.parse(readFileSync(feed, "utf8"));
if (!items.some((item) => item.tender) || !items.some((item) => !item.tender)) throw new Error("The site requires both industry articles and tenders");
cpSync(new URL("./public", import.meta.url), out, { recursive: true });
cpSync(new URL("./topics.mjs", import.meta.url), join(out, "topics.mjs"));
cpSync(new URL("../site/brand/favicon.ico", import.meta.url), join(out, "favicon.ico"));
