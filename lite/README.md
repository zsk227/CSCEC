# 行业资讯免费版

Cloudflare Pages 托管静态页面，GitHub Actions 每两小时读取一次已启用的官网和湖北标讯接口。网页公开展示原文标题、日期、来源和链接，按标题关键词分类，保留最近 120 天的匹配结果。来源短暂访问失败时保留已收录记录。如果整轮没有验证到可用的行业资讯和湖北标讯来源，保留上一版网页。

公众号文章可核对后录入 [wechat-links.json](wechat-links.json)，填写账号来源、原文标题、链接、日期和专题。免费版随正常更新发布这些文章的链接，公众号后续发文需逐篇补充。公众号项目报道在行业动态展示，湖北标讯使用公开交易公告。

[信源地图](public/sources.html) 提供原站查询入口。定时任务根据 [信源配置](../industry/sources.json) 读取已启用的公开栏目。城市更新、智慧城市和城市全域数字化转型的行业动态归入数字住建专题，湖北标讯沿用原有专题范围。

从仓库根目录运行：

```sh
npm ci
node lite/collect.ts
node lite/build.mjs
python -m http.server 5318 --bind 127.0.0.1 --directory lite/dist
```

公开数据只发布到 `cloudflare-pages` 分支。`Public feed` 工作流在测试分支只生成测试产物。在默认分支运行后会创建或更新发布分支。默认分支工作流可以手动运行，也会在北京时间每两小时的第 17 分钟触发。GitHub 可能延迟执行。

在 Cloudflare 控制台创建 Pages 项目，连接 `zsk227/CSCEC`，将生产分支设为 `cloudflare-pages`，禁用其他分支的预览构建。框架预设选 None，构建命令留空，输出目录设为 `.`。项目默认分配 `pages.dev` 地址。Pages 只需读取这个仓库。首次发布后，核对 HTTPS、首页和湖北标讯页面，再验证下一次数据分支更新是否触发 Pages 部署。

完整站点的运行方式见[部署说明](../docs/deploy.md)。
