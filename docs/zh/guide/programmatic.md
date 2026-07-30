---
description: "Cap 的编程模式：调用 new Cap() 和 solve()，直接在你自己的 JavaScript 中运行这个开源 CAPTCHA，基于工作量证明，无可见组件。"
---

# 编程模式

你可以在客户端 JavaScript 中使用 `new Cap({ ... })` 创建一个新的 Cap 实例，并使用 `solve()` 方法求解质询。

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // 或：apiEndpoint: "/api/",
});
const solution = await cap.solve();

console.log(solution.token);
```

你也可以设置[事件监听器](widget.md#supported-events)：

```js
const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
  // 或：apiEndpoint: "/api/",
});

cap.addEventListener("progress", (event) => {
  console.log(`求解中… 已完成 ${event.detail.progress}%`);
});
```

在幕后，Cap 会创建一个隐藏的 `cap-widget` 元素，并用它来求解质询。

## 支持的方法与参数

支持以下方法：

#### `new Cap({ ... })`

创建一个新的 Cap 实例。如果提供了第二个参数，将使用该元素，而不是在内存中新建一个。

**参数**

```json
{
  apiEndpoint: ..., // API 端点，类似验证组件的 `data-cap-api-endpoint` 属性
  workers: navigator.hardwareConcurrency || 8 // 使用的 worker 线程数
}
```

#### `cap.solve()`

请求并求解一个质询。

**输出：**`{ token }`

#### `cap.token`

返回最近一次求解得到的令牌

#### `cap.reset()`

重置 `cap.token`

#### `cap.addEventListener(..., function () { ... })`

监听 cap 验证组件的事件。参见[支持的事件](widget.md#supported-events)
