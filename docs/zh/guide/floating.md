---
description: "Cap 验证组件的浮动模式会隐藏这个开源 CAPTCHA，直到按钮被按下时才按需运行工作量证明。只需一个 data 属性即可启用。"
---

# 浮动模式

Cap 可以自动隐藏 CAPTCHA，直到按钮被按下。要使用此功能，请在触发元素上添加 `data-cap-floating` 属性，其值为你想使用的 `cap-widget` 元素的查询选择器。

```html
<cap-widget
  id="floating"
  onsolve="console.log(`token: ${event.detail.token}`)"
  data-cap-api-endpoint="<api endpoint>"
></cap-widget>

<button data-cap-floating="#floating" data-cap-floating-position="bottom">
  Trigger floating mode
</button>
```

你还需要从 JSDelivr 同时引入 Cap 库和浮动模式脚本：

```html{2}
<script src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
<script src="https://cdn.jsdelivr.net/npm/cap-widget/cap-floating.min.js"></script> <!-- [!code ++] -->
```

或从 Standalone 服务端引入：

```html
<script src="https://<server url>/assets/widget.js"></script>
<script src="https://<server url>/assets/floating.js"></script>
<!-- [!code ++] -->
```

支持以下属性：

- `data-cap-floating`：你想使用的 `cap-widget` 元素的 CSS 选择器。
- `data-cap-floating-position`：浮动组件的位置，可以是 `top` 或 `bottom`。
- `data-cap-floating-offset`：浮动组件相对触发元素的偏移量。
