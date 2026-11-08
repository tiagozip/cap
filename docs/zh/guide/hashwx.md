---
outline: [2, 3]
description: "HashWX 是 Cap 的抗 GPU 工作量证明。每个质询都会生成一个全新的哈希函数，GPU 相对 CPU 的优势因此只有约 2 倍，而不是 150 倍。"
---

# HashWX

HashWX 是 Cap 默认的工作量证明。SHA-256 使用固定的哈希函数，HashWX 则为每个 nonce 块生成一个新的哈希函数，由 GPU 不擅长执行的整数运算和分支构成。它由 [tevador](https://github.com/tevador/hashwx) 设计，他也是 RandomX 的作者，其[设计文档](https://github.com/tevador/hashwx/blob/master/doc/design.md)解释了工作原理。Cap 使用他的 WebAssembly 参考构建。

它是 capd 新建密钥的默认协议。在核心库中则需要[手动启用](./capjs-core.md#format-2-hashwx)。

## 为什么不用 SHA-256

机器人防护关注的是攻击者每小时能解出多少个质询，而不是单个质询要花多久。GPU 可以在成千上万条通道上同时运行 SHA-256 这样的固定函数。Cap 在 HashWX 之前使用 RSW 时间锁谜题，单个谜题内部无法并行，但 GPU 仍然能同时运行数千个独立谜题。与一块消费级 GPU 对比的测量结果如下：

| 算法 | CPU，Ryzen 3700X，16 线程 | GPU，RTX 5060 Ti | GPU 优势 |
|---|---:|---:|---:|
| SHA-256 | 41 MH/s | 6150 MH/s | ~150x |
| RSW | 26 H/s | 4400 H/s | ~170x |
| HashWX | 2.8 MH/s | 5.8 MH/s | ~2x |

这些数字来自 tevador，用的是他自己未公开的 CUDA 实现。Cap 复现了 RSW 那一行的数据，M3 上每线程为 2.11 H/s，折算到 16 个 Ryzen 线程就是 26 H/s。

RSW 已被弃用。capd 现在会为原本设置为 RSW 的密钥提供 HashWX。核心库仍会在你明确要求时签发 RSW 质询，但新部署不应选用它。

## 成本

每个质询在 Apple M3 单个核心上的服务端耗时，取 200 次生成和 40 次验证的中位数：

| 协议 | 生成 | 验证 | 合计 |
|---|---:|---:|---:|
| HashWX，1 个质询 | 14 µs | 40 µs | 54 µs |
| HashWX，4 个子质询，默认配置 | 20 µs | 129 µs | 149 µs |
| SHA-256，50 个质询，难度 4 | 4 µs | 83 µs | 87 µs |
| RSW，t = 75,000 | 1522 µs | 14 µs | 1536 µs |

难度不影响这些数字，因为无论找到解花了多久，验证每个子质询都只需要计算一次哈希。

客户端单个质询的求解时间是随机的，同样的难度，一位访客可能 30 ms 解完，下一位却要 3 s。Cap 默认把难度拆成四个子质询，让求解时间更均匀。以下是在 8 核 M3 上用 Chrome 通过验证组件测得的结果，每组 72 次求解，两种难度调到大致相同的中位数：

| | 1 个质询，d = 1,330,000 | 4 个子质询，d = 1,000,000 |
|---|---:|---:|
| 中位数 | 536 ms | 490 ms |
| p90 | 1447 ms | 778 ms |
| 72 次中最慢 | 2378 ms | 1490 ms |

右侧一列就是默认配置。对接 capd 密钥时，测得中位数 578 ms，p90 为 0.9 s。拆分不改变攻击者要付出的代价，因为无论怎么拆，预期工作量都是 `d` 次哈希。

### 浏览器

WebAssembly 构建的速度大约是原生的 60%。在同一台 M3 上测得：

| 浏览器 | 1 个 worker | 8 个 worker | 解释执行回退 |
|---|---:|---:|---:|
| Chrome 153 | 440 KH/s | 2050 KH/s | 94 KH/s |
| Firefox 156 | 420 KH/s | 1850 KH/s | 105 KH/s |
| Safari 27.2 | 410 KH/s | 1480 KH/s | 105 KH/s |

所有核心都跑满时，Safari 大约只有 Chrome 速度的 70%，所以调难度时要以 Safari 为准。默认配置下，Chrome 约需 0.5 s，Safari 约需 0.7 s。

如果你要自己测，请用各浏览器的正式发布版，并让标签页保持在前台。Playwright 自带的 Firefox 跑任何 WebAssembly 负载都比正式版 Firefox 慢三到六倍，而后台标签页可能会被调度到能效核心上。

### 手机

以下是默认难度在 BrowserStack 真机上的结果，每台 15 次求解，每次都从刚加载的页面开始：

| 设备 | 系统 | 全部核心 | 中位数 | 最慢 |
|---|---|---:|---:|---:|
| Galaxy S24 | Android 14 | 1238 KH/s | 1.1 s | 1.8 s |
| Pixel 9 | Android 15 | 837 KH/s | 1.4 s | 2.0 s |
| Pixel 6 | Android 12 | 746 KH/s | 1.9 s | 2.4 s |
| iPhone 15 | iOS 17 | 未测 | 1.9 s | 4.3 s |
| iPhone 12 | iOS 17 | 620 KH/s | 2.0 s | 3.3 s |
| iPhone 13 | iOS 15 | 678 KH/s | 2.2 s | 4.1 s |
| iPhone SE 2022 | iOS 15 | 588 KH/s | 2.4 s | 4.0 s |
| Redmi Note 11 | Android 11 | 456 KH/s | 2.4 s | 4.8 s |

每次求解都包含两次到测试服务器的往返，每次 80 到 190 ms。页面已经运行 HashWX 一分钟后，求解速度快了 24% 到 29%，所以先预热再测的基准测试会比访客的实际体验好。

如果你的流量以移动端为主，请调低难度。求解时间与难度成正比，因此 500,000 大约能让这些数字中的求解部分减半。

HashWX 需要 WebAssembly，iPhone 则需要 iOS 15 或更高版本。对于不支持 WebAssembly 的浏览器，请使用带有 JavaScript 回退方案的 SHA-256。

## 限制

定制硬件仍然会比 CPU 更快。专为 HashWX 设计 FPGA 或 ASIC 的费用高达数百万美元，对求解 CAPTCHA 而言不划算，但这是经济层面的判断，不是密码学上的保证。

它也拦不住付费人工打码。请将它与 [instrumentation](./instrumentation.md) 搭配使用，这样还会要求对方使用真实的浏览器。
