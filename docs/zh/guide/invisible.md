---
description: "Cap 的隐形模式：调用 new Cap() 和 solve()，直接在你自己的 JavaScript 中运行这个开源 CAPTCHA，基于工作量证明，无可见组件。"
---

# 隐形模式

隐形模式通过你自己的代码求解质询，页面上不显示任何内容。它适合点赞按钮、后台请求等没有表单的操作。

```js
import Cap from "cap-widget";

const cap = new Cap({ apiEndpoint: "https://cap.example.com/<site-key>/" });
const { token } = await cap.solve();
```

使用 CDN 脚本时，`Cap` 是全局变量，无需导入。

## API

### `new Cap(config, element?)`

除非设置了 [`CAP_CUSTOM_FETCH`](./widget.md#options)，否则 `config.apiEndpoint` 为必填项。其他键都会设置为验证组件的属性，因此[验证组件属性](./widget.md#属性)在这里也适用：

```js
const cap = new Cap({
  apiEndpoint: "https://cap.example.com/<site-key>/",
  "data-cap-worker-count": "4",
});
```

未传入 `element` 时，Cap 会创建一个关闭触感反馈的隐藏 `<cap-widget>`。隐藏的验证组件不会提前获取或求解任何质询，因此所有工作都会在你调用 `solve()` 时开始。传入现有的验证组件，则会操作该组件。

### `cap.solve()`

请求并求解一个质询。Promise 成功时返回 `{ success, token }`。

失败时会触发 `error` 事件，并以一个 `Error` 拒绝 Promise，其 `code` 为[错误码](./troubleshooting/instrumentation.md#错误码)之一，例如[框架被拦截](./widget.md#内容安全策略)时的 `instr_csp_blocked`：

```js
try {
  const { token } = await cap.solve();
} catch (err) {
  console.error(err.code, err.message);
}
```

如果调用时已有求解正在进行，此次调用会返回成功状态的 Promise，结果为 `undefined`。

### `cap.token`

最近一次求解得到的令牌，或 `null`。

### `cap.reset()`

清除令牌。

### `cap.addEventListener(type, listener)`

监听验证组件的[事件](./widget.md#事件)：

```js
cap.addEventListener("progress", (e) => {
  console.log(`${e.detail.progress}%`);
});
```

## 启用行为评分的密钥

隐形求解没有针对验证组件的点击。在启用[行为评分](./instrumentation.md#行为评分)的密钥上，其判定为 `no_interaction`，因此当密钥开启拦截并要求交互时，求解会失败。在核心库中，请为这些路由的 `behavior` 策略设置 `requireInteraction: false`。
