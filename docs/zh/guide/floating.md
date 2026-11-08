---
description: "Cap 验证组件的浮动模式会隐藏这个开源 CAPTCHA，直到按钮被按下时才按需运行工作量证明。只需一个 data 属性即可启用。"
---

# 浮动模式

浮动模式会隐藏验证组件，直到有人按下按钮。随后组件会显示在按钮旁边，完成求解后再次隐藏，并第二次点击按钮，因此提交按钮会继续提交带有令牌的表单。

在验证组件之后加载浮动模式脚本：

```html
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>/cap-floating.min.js"></script>
```

在 capd 的[静态资源服务器](./capd/options.md#asset-server)中，浮动模式脚本位于 `/assets/floating.js`。

然后使用 CSS 选择器将按钮指向验证组件：

```html
<form action="/submit" method="POST">
  <cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit" data-cap-floating="#cap">Submit</button>
</form>
```

| 属性 | 说明 |
| --- | --- |
| `data-cap-floating` | 要显示的验证组件的选择器。 |
| `data-cap-floating-position` | 显示在按钮的 `top` 或 `bottom`。默认为 `top`。 |
| `data-cap-floating-offset` | 按钮与验证组件之间的间距，单位为像素。默认为 `8`。 |

求解完成后，按钮的 `data-cap-token` 中也会包含令牌。

验证组件一出现就会开始求解，无需点击它。在启用[行为评分](./instrumentation.md#行为评分)并要求交互的密钥上，浮动求解会以 `behavior_no_interaction` 失败，与[隐形求解](./invisible.md#启用行为评分的密钥)相同。
