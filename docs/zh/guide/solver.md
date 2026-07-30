---
description: "@cap.js/solver 在 Bun 上于服务端求解 Cap 的工作量证明质询，适用于机器对机器（M2M）场景。开源 CAPTCHA 中一个小巧、零依赖的组成部分。"
---

# M2M

`@cap.js/solver` 是一个独立库，可用于在服务端求解 Cap 质询。它极其简单（零依赖、单文件），但与验证组件一样快速高效。注意它**只能在 Bun 上使用**。

这个包不会绕过任何实际的工作量证明。**它不支持 instrumentation 质询。**

## 安装

```bash
bun add @cap.js/solver
```

## 用法

#### 基于种子的质询

```js
import solver from "@cap.js/solver";

console.log(
  await solver("challenge token", {
    c: 50, // 质询数量
    s: 32, // 盐的长度
    d: 4, // 难度
  }),
);
```

#### 基于质询列表

```js
import solver from "@cap.js/solver";

const challenges = [
  ["a5b6fda4aaed97cf61d7dd9259f733b5", "d455"],
  ["286bcc39249f9ee698314b600c32e40f", "f0ff"],
  ["501350aa7c46573cb604284554045703", "4971"],
  ["a55c02f3b9b4cd088a5a7ee3d4941c14", "eab7"],
  ["5f3362c12e2779f56f4ef75b4494f5e6", "999f"],
  /* ... */
];

console.log(await solver(challenges));
```

**输出：**

```json
[67302, 64511, 40440, 27959, 71259 /* ... */]
```

第二个参数是可选的，但任何时候都可以提供，且始终是一个对象。

- 对于**所有质询类型**，`workerCount` 指定使用的 worker 数量（默认为 CPU 核心数）。

- 对于**所有质询类型**，还可以通过 `onProgress` 提供进度更新的回调。

- **仅对基于种子的质询**，它用于指定要生成的解的数量、质询的大小以及难度
