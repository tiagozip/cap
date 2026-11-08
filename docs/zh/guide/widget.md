---
outline: [2, 3]
description: "Cap 的客户端验证组件基于原生 Web Component 和 WASM，负责请求、求解并展示工作量证明质询。了解如何安装、在各种框架中使用并自定义它。"
---

# 验证组件

验证组件是一个 `<cap-widget>` Web Component。它从你的服务端获取质询，在 Web Workers 中使用 WebAssembly 求解，再交给你一个待校验的令牌。

## 安装

::: code-group

```sh [npm]
npm i cap-widget
```

```sh [pnpm]
pnpm add cap-widget
```

```sh [bun]
bun add cap-widget
```

```html [cdn]
<script src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

:::

使用 CDN 时，请固定[发布页面](https://github.com/tiagozip/cap/releases)中的某个版本。jsDelivr 在中国部分地区被屏蔽，如果你的访客来自这些地区，请通过 npm 安装或[自行托管验证组件](#自行托管验证组件)。

## 使用

通过 `data-cap-api-endpoint` 指向你的服务端。对于 capd，其格式为 `https://<instance>/<site-key>/`。

::: code-group

```html [HTML]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>

<script>
  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

```jsx [React]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      onsolve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```vue [Vue]
<script setup>
import "cap-widget";
</script>

<template>
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    @solve="(e) => console.log(e.detail.token)"
  />
</template>
```

```svelte [Svelte]
<script>
  import "cap-widget";
</script>

<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  onsolve={(e) => console.log(e.detail.token)}
></cap-widget>
```

```jsx [Solid]
import "cap-widget";

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="https://cap.example.com/<site-key>/"
      on:solve={(e) => console.log(e.detail.token)}
    />
  );
}
```

```tsx [Qwik]
import { component$ } from "@builder.io/qwik";
import "cap-widget";

export default component$(() => (
  <cap-widget
    data-cap-api-endpoint="https://cap.example.com/<site-key>/"
    on:solve$={(e: CustomEvent) => console.log(e.detail.token)}
  />
));
```

```astro [Astro]
<cap-widget id="cap" data-cap-api-endpoint="https://cap.example.com/<site-key>/" />

<script>
  import "cap-widget";

  document.getElementById("cap").addEventListener("solve", (e) => {
    console.log(e.detail.token);
  });
</script>
```

:::

各框架的注意事项：

- React 从版本 19 开始能正确处理自定义元素的事件。Preact 使用相同的语法。
- Vue 可能会提示未知组件。请告诉编译器，`cap-` 标签是自定义元素：

  ```js
  vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith("cap-") } } })
  ```

- Svelte 示例使用 Svelte 5。在 Svelte 4 中，请使用 `on:solve`。

### 在表单中使用

当验证组件位于 `<form>` 内时，求解成功后会添加一个隐藏的 `cap-token` 输入框，令牌会随其他字段一起提交。添加 `required` 可阻止表单在求解完成前提交。

```html
<form action="/submit" method="POST">
  <cap-widget required data-cap-api-endpoint="https://cap.example.com/<site-key>/"></cap-widget>
  <button type="submit">Submit</button>
</form>
```

如果不想显示验证组件，请使用[隐形模式](./invisible.md)。如果只想在按钮被按下时显示，请使用[浮动模式](./floating.md)。

## 获取和求解的时机

验证组件不会等到点击才开始工作。它在页面上可见时，就会获取质询并启动 [instrumentation](./instrumentation.md) 框架，持续观察页面直到求解结束。它会根据令牌中的质询有效期，在到期前一段时间重新获取质询。对于有效期为 10 分钟的质询，SHA-256 会提前 90 秒重新获取，HashWX 则提前 3 分钟。

页面上的第一次鼠标移动、触摸或按键会触发预先求解。对于 HashWX 使用的 [format 2](./capjs-core.md#format-2-hashwx) 质询，验证组件只会提前下载 HashWX 模块。对于 format 1 的 SHA-256 质询，它会等待 2.5 秒，然后在单个 worker 中求解。点击验证组件后，剩余求解工作会交给全部 worker。当密钥不需要交互数据时，验证组件还会在后台兑换求解结果并保留令牌，因此点击验证组件就能立即返回。当密钥需要检查交互或进行行为评分时，组件会等到点击后才兑换，因为点击本身就是服务端检查的内容之一。如果服务端拒绝了后台兑换，点击后会显示该错误。

## 事件

每个事件都是一个 `CustomEvent`。

| 事件 | 触发时机 | `detail` |
| --- | --- | --- |
| `solve` | 质询求解成功 | `{ token }` |
| `progress` | 求解进度更新 | `{ progress }`，范围为 0 到 100 |
| `error` | 发生错误 | `{ isCap, code, message }`。错误码见[故障排查](./error-codes.md)。 |
| `reset` | 验证组件重置 | `{}` |

## 属性

| 属性 | 说明 |
| --- | --- |
| `data-cap-api-endpoint` | 你的服务端端点。必填。 |
| `data-cap-worker-count` | 求解器 worker 数量。默认为 CPU 核心数，或 8。 |
| `data-cap-hidden-field-name` | 隐藏表单输入框的名称。默认为 `cap-token`。 |
| `data-cap-lang` | 强制使用指定[语言](#语言)。 |
| `data-cap-troubleshooting-url` | 访客被拦截时，故障排查链接指向的地址。 |
| `data-cap-disable-haptics` | 关闭手机上的振动。 |
| `required` | 在验证组件求解完成前阻止表单提交。 |

## 语言

验证组件会跟随浏览器语言，支持阿拉伯语、简体中文、法语、德语、印地语、日语、葡萄牙语、俄语和西班牙语，其他情况使用英语。你也可以在组件上设置 `data-cap-lang="de"`，或为整个页面设置 `window.CAP_LANG = "de"`，自行指定语言。

要修改任何文案，请设置对应的 `data-cap-i18n-*` 属性：

```html
<cap-widget
  data-cap-api-endpoint="https://cap.example.com/<site-key>/"
  data-cap-i18n-initial-state="I'm not a robot"
  data-cap-i18n-solved-label="Done"
></cap-widget>
```

可用的键包括 `initial-state`、`verifying-label`、`solved-label`、`error-label`、`csp-error-label`、`required-label`、`troubleshooting-label`、`wasm-disabled`，以及屏幕阅读器标签 `group-aria-label`、`verify-aria-label`、`verifying-aria-label`、`verified-aria-label` 和 `error-aria-label`。

## 样式

在 `cap-widget` 上覆盖以下 CSS 变量即可。这里列出的值都是默认值。

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

## 页面级选项 {#options}

在验证组件加载之前，将这些选项设置到 `window` 上。

| 选项 | 说明 |
| --- | --- |
| `CAP_CUSTOM_FETCH` | 替换验证组件请求所用的 `fetch`。 |
| `CAP_CSS_NONCE` | 为注入的 `<style>` 标签提供 nonce，以适配严格的内容安全策略。未设置 `CAP_SCRIPT_NONCE` 时，也用于脚本。 |
| `CAP_SCRIPT_NONCE` | 为注入的脚本提供 nonce，包括解压回退脚本和 instrumentation iframe。 |
| `CAP_ISOLATE` | 让 instrumentation 框架在不使用你的页面来源的情况下运行。见[存在 HTML 注入漏洞的页面](#pages-with-an-html-injection-bug)。 |
| `CAP_PAKO_URL` | `pako_inflate.min.js` 的 URL，验证组件仅在不支持 `DecompressionStream` 的浏览器中加载它。 |
| `CAP_CUSTOM_WASM_URL` | `cap_wasm_bg.wasm` 的 URL。 |
| `CAP_CUSTOM_HASHWX_URL` | `hashwx.wasm` 的 URL。 |
| `CAP_LANG` | 强制所有验证组件使用指定[语言](#语言)。 |
| `CAP_DISABLE_HAPTICS` | 关闭所有验证组件的振动。 |
| `CAP_DISABLE_WIDGET_REF` | 不在验证组件的 Cap 署名链接中包含你的页面地址。 |
| `CAP_DEBUG` | 将获取和求解的每一步记录到控制台。 |
| `CAP_SILENT` | 关闭验证组件的全部控制台输出。 |

## 内容安全策略

验证组件支持严格的内容安全策略。它需要允许以下来源：

| 指令 | 来源 | 原因 |
| --- | --- | --- |
| `script-src` | `'nonce-...'` 或验证组件所在的主机 | 加载验证组件脚本。 |
| `script-src` | `'wasm-unsafe-eval'` | 编译 WebAssembly 求解器。 |
| `worker-src` | `blob:` | 在通过 blob URL 创建的 Web Workers 中运行求解器。 |
| `connect-src` | 你的 Cap 服务端，以及 `cdn.jsdelivr.net`，除非你[自行托管](#自行托管验证组件) | 获取质询、兑换质询并下载 WASM 文件。 |
| `style-src` | `'nonce-...'` | 允许验证组件注入的 `<style>` 标签。请设置 `CAP_CSS_NONCE`。 |

[instrumentation](./instrumentation.md) 脚本在 `srcdoc` iframe 中运行，并继承页面的策略。只有在验证组件加载前，将 `window.CAP_SCRIPT_NONCE` 设置为 `script-src` 中的 nonce，组件才会将该 nonce 添加到此脚本，以及旧浏览器中的 pako 回退脚本。如果没有设置，浏览器会拦截脚本，求解会在框架加载后 250 ms 失败。验证组件会显示 "Blocked by this page"，触发错误码为 `instr_csp_blocked` 的 `error` 事件，并在控制台记录一条指向本节的错误。服务端使用相同的错误码记录此次失败。如果你从 jsDelivr 以外的地方加载 pako，请设置 `CAP_PAKO_URL`，并在 `script-src` 中允许该主机。

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_CSS_NONCE = "r4nd0m";
</script>
<script nonce="r4nd0m" src="https://cdn.jsdelivr.net/npm/cap-widget@<version>"></script>
```

```
Content-Security-Policy: script-src 'nonce-r4nd0m' 'wasm-unsafe-eval'; worker-src blob:; style-src 'nonce-r4nd0m'; connect-src 'self' https://cdn.jsdelivr.net
```

为每个响应生成新的 nonce。如果你从 capd 的 `/assets` 提供验证组件，请在 `script-src` 和 `connect-src` 中允许你的 Cap 服务端，并移除 jsDelivr。

你不需要 `'unsafe-eval'`。部分 instrumentation 检查会使用 `eval` 和 `new Function`。当两者都抛出 `EvalError` 时，脚本会跳过这些检查，执行其余检查，服务端则向 `riskFlags` 添加 `csp_eval_blocked`。如果只有其中一个抛出异常，脚本会将其视为篡改，并以 `instr_natives_tampered` 失败。脚本还会记录浏览器是否为被拦截的 `eval` 触发了 `securitypolicyviolation` 事件，并忽略 `isTrusted` 为 `false` 的事件，因此页面脚本无法伪造这一确认信号。该标志仅供参考，绝不会作为有利于访客的证据。

早于此版本的验证组件仍能配合新服务端使用，限制见[旧版本验证组件](./instrumentation.md#旧版验证组件)。

### 存在 HTML 注入漏洞的页面 {#pages-with-an-html-injection-bug}

instrumentation 框架与你的页面同源。一旦设置 `CAP_SCRIPT_NONCE`，验证组件就会将你的 nonce 提供给框架中的脚本。验证组件会运行 `data-cap-api-endpoint` 所指定服务端发送的任何脚本。如果攻击者能够向设置了 `CAP_SCRIPT_NONCE` 的页面注入 HTML，就可以添加一个指向其自有服务端的 `<cap-widget>`，该服务端的脚本随后便会以你的页面来源运行，并通过你的安全策略。在这样的页面上，原本能被安全策略限制的漏洞就会变成跨站脚本漏洞。

这只影响依赖 nonce 策略来限制 HTML 注入的页面。没有这样的策略时，注入的 HTML 本就能运行脚本，验证组件不会增加这种风险。

在这样的页面上，请在验证组件加载前，在脚本中设置 `window.CAP_ISOLATE = true`：

```html
<script nonce="r4nd0m">
  window.CAP_SCRIPT_NONCE = "r4nd0m";
  window.CAP_ISOLATE = true;
</script>
```

验证组件随后会在不含 `allow-same-origin` 的沙箱中运行框架，因此无论脚本来自哪个服务端，它都使用不透明来源，无法读取或修改你的页面、cookie 或存储。此选项必须通过 JavaScript 设置，因为注入的 HTML 无法运行 JavaScript，而验证组件上的属性会受攻击者控制。

这项检查会放弃从页面读取信息。它仍会在自己的框架内运行[自动化浏览器检查](./instrumentation.md#自动化浏览器检测)，但无法记录交互、行为轨迹或 AI 智能体标记。对于仅报告这些信号的密钥，服务端会接受这些求解，并附加 `isolated_frame` 风险标志；对于拦截自动化交互、开启行为评分拦截或拦截智能体的密钥，服务端会以 `instr_isolated` 拒绝求解。

## 自行托管验证组件

验证组件默认从 jsDelivr 加载，求解器获取的两个 WASM 文件也是如此。要全部通过你自己的域名提供：

1. 自行提供脚本，可以通过打包工具导入 `cap-widget`，也可以使用 capd 的[静态资源服务器](./capd/options.md#asset-server)的 `/assets/widget.js`。
2. 在验证组件开始求解前，将求解器指向你托管的 WASM 文件：

```html
<script>
  window.CAP_CUSTOM_WASM_URL = "https://cap.example.com/assets/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "https://cap.example.com/assets/hashwx.wasm";
</script>
<script src="https://cap.example.com/assets/widget.js"></script>
```

使用打包工具时，请在 `import "cap-widget"` 执行前设置这两个全局变量。URL 可以指向你托管这些文件的任何位置。
