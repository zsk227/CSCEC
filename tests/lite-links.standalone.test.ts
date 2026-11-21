import assert from "node:assert/strict";
import { test } from "node:test";
import { articleUrl } from "../lite/links.ts";

const official = "https://www.nea.gov.cn/20261120/60a2897046794cb0a0f0ef3e36e538f1/c.html";
const archived = official.replace("www.", "");

test("new articles retain the original address, including scheme, query and fragment", () => {
  assert.equal(articleUrl(official), official);
  const original = "http://www.example.com/notice/?source=bulletin&guid=123#attachment";
  assert.equal(articleUrl(original), original);
  assert.equal(articleUrl(archived), archived);
});

test("repair archived articles on verified hosts while preserving the rest of the link", () => {
  assert.equal(articleUrl(archived, { legacy: true }), official);
  const other = "https://hzj.nea.gov.cn/article?guid=123";
  assert.equal(articleUrl(other, { legacy: true }), other);
  assert.equal(articleUrl(official, { legacy: true }), official);
});

test("public article links require an absolute HTTP address without credentials", () => {
  for (const invalid of ["/article", "javascript:void(0)", "https://user:secret@example.com/"]) {
    assert.equal(articleUrl(invalid), null);
  }
});
