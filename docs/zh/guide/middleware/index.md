---
description: "Cap Checkpoint 会像 Cloudflare 一样添加一个浏览器检查过渡页，在机器人到达你的网站之前将其拦截。自托管、开源的工作量证明 CAPTCHA。"
---

# 关于 Checkpoint

Cap 的 Checkpoint（此前称为中间件）可以复刻 Cloudflare 的浏览器检查过渡页，帮助你在机器人、LLM 和自动化滥用到达你的网站之前就将其拦截。

它的设置和使用都很简单，只需在服务器上添加几行代码，无需把整个网站迁移到 Cloudflare。需要注意，这算是一种“核弹级”方案，因为它*也会*影响搜索引擎爬虫等善意的机器人。

![Cap Checkpoint 流程截图](/checkpoints_screenshot.webp)
