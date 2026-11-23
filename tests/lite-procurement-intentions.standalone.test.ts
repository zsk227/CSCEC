import assert from "node:assert/strict";
import { test } from "node:test";
import { parseProcurementProjects } from "../lite/procurement-intentions.ts";

test("reads project name, budget in ten thousand yuan, and expected month from the public notice", () => {
  const html = "<table><tr><td>序号</td><td>采购项目名称</td><td>采购需求概况</td>"
    + "<td>预算金额<p>（万元）</p></td><td>预计采购时间<p>（填写到月）</p></td><td>备注</td></tr>"
    + "<tr><td>1</td><td>智慧校园平台</td><td>建设校园综合管理平台</td><td>200.5</td><td>2027-04</td><td></td></tr>"
    + "<tr><td>2</td><td>园区网络</td><td>设备更新</td><td>未公布</td><td>待定</td><td></td></tr></table>";
  assert.deepEqual(parseProcurementProjects(html), [
    { title: "智慧校园平台", requirement: "建设校园综合管理平台", amount: "预算金额 200.5万元", expectedMonth: "2027-04" },
    { title: "园区网络", requirement: "设备更新" },
  ]);
});

test("ignores unrelated tables or summary rows and leaves unknown budget units empty", () => {
  const html = "<table><tr><td>普通表格</td><td>100</td></tr></table>"
    + "<table><tr><th>采购项目名称</th><th>预算金额</th><th>预计采购时间</th></tr>"
    + "<tr><td>数字建造平台</td><td>100</td><td>2026年13月</td></tr><tr><td colspan='3'>合计</td></tr></table>";
  assert.deepEqual(parseProcurementProjects(html), [{ title: "数字建造平台", requirement: "" }]);
});
