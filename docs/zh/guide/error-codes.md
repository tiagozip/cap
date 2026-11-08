---
description: "Cap 组件、capjs-core 和 capd 返回的所有错误码，以及每个错误码的含义和来源。"
---

# 错误码

此表供站点所有者参考。验证组件将这些错误码放在 `error` 事件的 `code` 中，`validateChallenge` 将它们作为 `reason` 返回，capd 则将它们显示为被拦截和失败事件的原因。

| 错误码 | 来源 | 含义 |
| --- | --- | --- |
| `missing_endpoint` | 验证组件 | 验证组件既没有 `data-cap-api-endpoint`，也没有 `CAP_CUSTOM_FETCH`。 |
| `network_error` | 验证组件 | 质询端点返回了错误，或未收到质询。 |
| `challenge_parse_error` | 验证组件 | 质询响应不是 JSON。 |
| `challenge_unsupported` | 验证组件 | 质询使用了此验证组件版本无法求解的协议，或在不支持 WebAssembly 的浏览器中使用 HashWX。 |
| `solve_failed` | 验证组件 | 求解 worker 失败、请求无法到达服务器，或发生了没有专属错误码的错误。 |
| `redeem_failed` | 验证组件 | `/redeem` 响应不是 JSON。 |
| `invalid_solution` | 验证组件、服务端 | 服务端拒绝了兑换。在验证组件中，事件的 `message` 是服务端的 `error`。由服务端返回时，表示工作量证明错误。 |
| `invalid_expires` | 验证组件 | 令牌的过期时间不在接下来的 24 小时内，说明服务器时钟有误。 |
| `instr_csp_blocked` | 验证组件、服务端 | 页面的内容安全策略拦截了 instrumentation 脚本。请按[内容安全策略](./widget.md#内容安全策略)所述设置 `CAP_SCRIPT_NONCE`。 |
| `instr_natives_tampered` | 验证组件、服务端 | 脚本依赖的浏览器函数在运行前被扩展或页面脚本替换。 |
| `instr_env_failed` | 验证组件、服务端 | 程序运行前的环境检查失败。脚本并未运行在真实浏览器页面中，或框架被修改。 |
| `instr_script_failed` | 验证组件、服务端 | 环境检查通过后，程序抛出异常。 |
| `instr_blocked` | 验证组件 | 脚本自身的自动化浏览器检查失败。如果密钥拦截自动化浏览器，服务端记录 `instr_automated_browser`，否则记录 `instr_failed`。 |
| `instr_timeout` | 验证组件、服务端 | 验证组件通知脚本完成后，脚本未在 20 秒内响应。 |
| `invalid_body`, `missing_token`, `missing_solutions`, `invalid_solutions` | 服务端 | `/redeem` 请求格式错误。 |
| `invalid_token` | 服务端 | 质询令牌被伪造、格式错误，或使用了其他密钥签名。 |
| `scope_mismatch` | 服务端 | 令牌属于其他站点密钥或 scope。 |
| `expired` | 服务端 | 质询在兑换前已过期。 |
| `already_redeemed` | 服务端 | 质询已被使用。失败的 instrumentation 检查也会消耗它。 |
| `nonce_store_error` | 服务端 | `consumeNonce` 抛出异常。 |
| `instr_missing` | 服务端 | 请求没有 instrumentation 结果。 |
| `instr_corrupted` | 服务端 | 服务端无法解密质询的 instrumentation 数据，通常是因为密钥发生了变化。 |
| `instr_expired` | 服务端 | instrumentation 结果在质询过期后才到达。 |
| `instr_stale` | 服务端 | 结果声称的耗时超过质询允许的时长。 |
| `instr_oversized` | 服务端 | 收集的数据超过 65,536 个字符。 |
| `id_mismatch` | 服务端 | 结果属于其他质询。 |
| `failed_challenge` | 服务端 | 结果中的数值错误。结果被修改，或浏览器执行程序时计算错误。 |
| `invalid_state`, `missing_output`, `missing_meta`, `invalid_meta` | 服务端 | 结果或密封的质询数据格式错误。 |
| `instr_failed` | 服务端 | 验证组件报告了服务端不识别的失败。 |
| `instr_automated_browser` | 服务端 | [自动化浏览器检查](./instrumentation.md#自动化浏览器检测)失败。`blockedBy` 列出失败项。 |
| `instr_probe_missing` | 服务端 | 密钥拦截自动化浏览器，但结果没有浏览器信息。 |
| `instr_automated_interaction` | 服务端 | 脚本派发了三次或更多点击或按键。见[交互检测](./instrumentation.md#交互检测)。 |
| `instr_host_unreachable` | 服务端 | 脚本无法读取框架外的页面，而密钥策略依赖这些信息。 |
| `instr_isolated` | 服务端 | 页面设置了 [`CAP_ISOLATE`](./widget.md#pages-with-an-html-injection-bug)，而此密钥需要隔离框架无法收集的交互、行为或智能体数据。请关闭此密钥上的这些拦截设置，或移除 `CAP_ISOLATE`。 |
| `instr_widget_outdated` | 服务端 | [旧版验证组件](./instrumentation.md#旧版验证组件)无法满足此密钥的要求。请更新验证组件。 |
| `behavior_missing` | 服务端 | 行为评分已开启，但结果没有行为轨迹。 |
| `behavior_automated` | 服务端 | [行为分数](./instrumentation.md#行为评分)达到阈值。 |
| `behavior_no_interaction` | 服务端 | 没有任何操作按下验证组件，而密钥要求交互。 |
| `behavior_agent` | 服务端 | 检测到 [AI 智能体](./instrumentation.md#ai-智能体检测)，且密钥拦截它。 |
| `rate_limited` | capd | 客户端超过了密钥的速率限制。 |
| `non_browser_ua`, `missing_header` | capd | 质询请求未通过密钥的请求过滤器。 |
| `rule:<id>` | capd | 密钥上的某条规则拦截了请求。 |
| `signal:<flag>` | capd | 密钥设置为在出现该风险标志时拦截。 |

capd 的 `/redeem` 响应会在自己的 `reason` 字段中重命名其中一些错误码：`instr_automated_browser` 变为 `automated_browser_detected`，`instr_automated_interaction` 变为 `automated_interaction_detected`，`instr_corrupted` 变为 `corrupted_instrumentation_data`，`instr_missing` 变为 `missing_instrumentation_response`，`instr_expired` 变为 `expired`，`instr_timeout` 变为 `timeout`，并以 `429` 状态发送。
