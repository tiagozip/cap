---
outline: [2, 3, 4]
description: "Cap 的客户端验证组件基于原生 Web Component 和 WASM，负责请求、求解并展示工作量证明质询。这是这款开源 CAPTCHA 的客户端文档。"
---

# 验证组件

Cap 的客户端验证组件负责请求、求解并展示质询，基于原生 Web Component 和 Rust 编写的 WASM。它还内置了[编程模式](./programmatic)。

## 安装

::: code-group

```sh [pnpm]
pnpm add cap-widget
```

```sh [npm]
npm i cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<!--

* 生产环境应固定具体版本以避免破坏性变更。你也可以使用 Standalone 的静态资源服务器
* `cdn.jsdelivr.net` 在部分地区（如中国部分区域）被屏蔽。如果你的网站需要从这些地区访问，建议使用 npm。

-->

<script type="module" src="https://cdn.jsdelivr.net/npm/cap-widget"></script>
```

:::

## 使用

验证组件需要通过 `data-cap-api-endpoint` 指向你的 Cap 部署。对于 Standalone 实例，其格式为：

```
https://<your-instance>/<site-key>/
```

### 原生 JavaScript

```html
<form>
  <cap-widget id="cap" required data-cap-api-endpoint="https://<your-instance>/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>

<script type="module">
  import "https://cdn.jsdelivr.net/npm/cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

::: tip

当验证组件位于 `<form>` 内时，它会自动注入一个隐藏的 `cap-token` 输入框，令牌会随其他字段一起提交，无需额外的 JavaScript。

:::

### React

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

::: tip

推荐使用 React 19 或更高版本，它改进了自定义元素的事件处理

:::

### Vue

```vue
<script setup>
import "cap-widget";
</script>

<template>
  <form>
    <cap-widget
      data-cap-api-endpoint="https://<your-instance>/<site-key>/"
      @solve="(e) => console.log('token:', e.detail.token)"
      @progress="(e) => console.log(e.detail.progress)"
      @error="(e) => console.error(e.detail.message)"
    />
    <button type="submit">Submit</button>
  </form>
</template>
```

如果出现未知组件的警告，在 `vite.config.js` 中添加：

```js
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") },
      },
    }),
  ],
});
```

### Svelte 5

```svelte
<script>
  import "cap-widget";
</script>

<form>
  <cap-widget
    data-cap-api-endpoint="https://<your-instance>/<site-key>/"
    on:solve={(e) => console.log("token:", e.detail.token)}
    on:progress={(e) => console.log(e.detail.progress)}
    on:error={(e) => console.error(e.detail.message)}
  />
  <button type="submit">Submit</button>
</form>
```

### SolidJS

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve={(e) => console.log("token:", e.detail.token)}
        on:progress={(e) => console.log(e.detail.progress)}
        on:error={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Astro

```astro
---
// ContactForm.astro
---

<form>
  <cap-widget id="cap" data-cap-api-endpoint="https://<your-instance>/<site-key>/" />
  <button type="submit">Submit</button>
</form>

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log("token:", e.detail.token);
  });
</script>
```

如果你在 Astro 中渲染 React/Vue/Svelte 组件，请参考上面对应框架的写法，并给组件加上 `client:load`。

### Preact

```jsx
import "cap-widget";

export default function ContactForm() {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        onsolve={(e) => console.log("token:", e.detail.token)}
        onprogress={(e) => console.log(e.detail.progress)}
        onerror={(e) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Qwik

```tsx
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => {
  return (
    <form>
      <cap-widget
        data-cap-api-endpoint="https://<your-instance>/<site-key>/"
        on:solve$={(e: CustomEvent) => console.log("token:", e.detail.token)}
        on:progress$={(e: CustomEvent) => console.log(e.detail.progress)}
        on:error$={(e: CustomEvent) => console.error(e.detail.message)}
      />
      <button type="submit">Submit</button>
    </form>
  );
});
```

## 编程模式

如果你不想显示可见的验证组件，比如在保护发帖之类的后台操作时，可以使用[编程模式](./programmatic)：

```js
import Cap from "cap-widget";

const cap = new Cap({
  apiEndpoint: "https://<your-instance>/<site-key>/",
});

const { token } = await cap.solve();
```

## 事件

所有事件都以 CustomEvent 形式派发。

| 事件       | 触发时机               | Detail                 |
| ---------- | ---------------------- | ---------------------- |
| `solve`    | 质询求解成功           | `{ token: string }`    |
| `progress` | 求解过程中的进度更新   | `{ progress: number }` |
| `error`    | 发生错误               | `{ message: string }`  |
| `reset`    | 组件重置回初始状态     | `{}`                   |

## 选项

你可以通过 `window.CAP_CUSTOM_FETCH` 指定自定义的 fetch 函数：

```js
window.CAP_CUSTOM_FETCH = (url, params) => fetch(url, params);
```

如果你的页面启用了严格的 Content-Security-Policy，可以提供 nonce，避免组件注入的 `<style>` 和 `<script>` 元素被拦截：

- `window.CAP_CSS_NONCE`：应用到组件的 `<style>` 标签。当 `CAP_SCRIPT_NONCE` 未设置时，也会作为注入脚本的备用 nonce。
- `window.CAP_SCRIPT_NONCE`：应用到组件注入的脚本，即 pako 解压回退脚本和 instrumentation（浏览器环境检测）质询 iframe。

你还可以通过 `window.CAP_CUSTOM_WASM_URL` 设置自定义的 WASM 地址（比如 Standalone 静态资源服务器的地址）。

要禁用触感反馈（移动设备上的振动），可以全局设置 `window.CAP_DISABLE_HAPTICS = true`，或给单个组件添加 `data-cap-disable-haptics` 属性：

```js
window.CAP_DISABLE_HAPTICS = true;
```

```html
<cap-widget data-cap-disable-haptics data-cap-api-endpoint="..."></cap-widget>
```

在[编程模式](./programmatic)下触感反馈会自动禁用，因为没有可供用户交互的可见组件

### 属性

| 属性                           | 说明                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------- |
| `data-cap-api-endpoint`        | **必填。**你的 Cap 端点：`https://<instance>/<site-key>/`                     |
| `data-cap-worker-count`        | 求解器 worker 数量（默认为 `navigator.hardwareConcurrency \|\| 8`）           |
| `data-cap-hidden-field-name`   | `<form>` 中隐藏令牌输入框的名称（默认：`cap-token`）                          |
| `data-cap-troubleshooting-url` | 用户被拦截时显示的"故障排查"链接的自定义 URL                                  |
| `data-cap-disable-haptics`     | 在该组件上禁用触感反馈（振动）                                                |

#### i18n

所有组件文案都可以通过 `data-cap-i18n-*` 属性覆盖。默认为英文

```html
<cap-widget
  data-cap-api-endpoint="https://<your-instance>/<site-key>/"
  data-cap-i18n-initial-state="Verify you're human"
  data-cap-i18n-verifying-label="Verifying..."
  data-cap-i18n-solved-label="You're human"
  data-cap-i18n-error-label="Error"
  data-cap-i18n-troubleshooting-label="Troubleshooting"
  data-cap-i18n-wasm-disabled="Enable WASM for significantly faster solving"
  data-cap-i18n-verify-aria-label="Click to verify you're a human"
  data-cap-i18n-verifying-aria-label="Verifying, please wait"
  data-cap-i18n-verified-aria-label="Verified"
  data-cap-i18n-required-label="Please verify you're human"
  data-cap-i18n-error-aria-label="An error occurred, please try again"
></cap-widget>
```

### 样式

在 `cap-widget` 元素上覆盖以下任意 CSS 变量即可：

```css
cap-widget {
  --cap-background: #fdfdfd;
  --cap-border-color: #dddddd8f;
  --cap-border-radius: 14px;
  --cap-widget-height: 30px;
  --cap-widget-width: 230px;
  --cap-widget-padding: 14px;
  --cap-gap: 15px;
  --cap-color: #212121;
  --cap-checkbox-size: 25px;
  --cap-checkbox-border: 1px solid #aaaaaad1;
  --cap-checkbox-border-radius: 6px;
  --cap-checkbox-background: #fafafa91;
  --cap-checkbox-margin: 2px;
  --cap-font: system-ui, -apple-system, sans-serif;
  --cap-spinner-color: #000;
  --cap-spinner-background-color: #eee;
  --cap-spinner-thickness: 5px;
}
```
