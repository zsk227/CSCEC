import assert from "node:assert/strict";
import test from "node:test";
import { isAwardNotice, readCscecAwards } from "../lite/cscec-awards.ts";

test("reads the named winners of formal results, including member companies in a consortium", () => {
  assert.deepEqual(readCscecAwards(
    `<div class="article-content"><table>
      <tr><th>中标人</th><th>中标价(元)</th><th>其他</th></tr>
      <tr><td>湖北某建设有限公司、中国建筑第三工程局有限公司、联合体成员：中建三局安装工程有限公司</td><td>360000</td><td></td></tr>
    </table></div>`,
  ), ["中国建筑第三工程局有限公司", "中建三局安装工程有限公司"]);
  assert.deepEqual(readCscecAwards(
    `<div class="article-content">&lt;table&gt;&lt;tr&gt;&lt;td&gt;中标单位&lt;/td&gt;
     &lt;td&gt;中建壹品投资发展有限公司&lt;/td&gt;&lt;/tr&gt;&lt;/table&gt;</div>`,
  ), ["中建壹品投资发展有限公司"]);
});

test("reads the winner of a government procurement result and ignores other suppliers", () => {
  assert.deepEqual(readCscecAwards(
    `<div class="article-content"><h3>四、中标（成交）信息</h3>
     <p><span>供应商名称：</span><span>中建三局信息科技有限公司</span></p>
     <h3>五、未中标供应商</h3><p>供应商名称：中建三局智能技术有限公司</p></div>`,
  ), ["中建三局信息科技有限公司"]);
  assert.deepEqual(readCscecAwards(
    `<div class="article-content"><table><tr><td>采购人</td><td>中建三局集团有限公司</td></tr>
      <tr><td>中标人:</td><td>中建八局有限公司</td></tr></table>
      <p>参与投标：中建三局信息科技有限公司</p></div>`,
  ), []);
  assert.equal(readCscecAwards(
    `<div class="article-content"><p>附件记录：中建三局集团有限公司</p></div>`,
  ), undefined);
});

test("candidate, cancellation and correction notices do not qualify as formal awards", () => {
  const url = "https://www.hbggzy.cn/jyxx/003001/003001006/test.html";
  for (const title of ["中标候选人公示", "评标结果公示", "采购终止公告", "成交结果更正公告", "废标公告"]) {
    assert.equal(isAwardNotice(title, url), false, title);
  }
  assert.equal(isAwardNotice("城区管廊项目中标结果公告", url), true);
  assert.equal(isAwardNotice("软 件运维服务结果公告", url), true);
  const title = "地下综合管廊建设项目中标结果公告";
  assert.equal(isAwardNotice(title, "https://www.hbggzy.cn/jyxx/003001/003001006/20261027/422f10db-2a8e-4340-87bd-c2cd2e20d646.html"), true);
  assert.equal(isAwardNotice(title, "https://bidcloud.hbggzy.cn/hubei/jyxx/20261027/result.html"), true);
  assert.equal(isAwardNotice(title, "https://www.hbggzy.cn.example.org/jyxx/003001/003001006/test.html"), false);
});
