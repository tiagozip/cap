<div align="center">
    <br/>
    <p>
        <img src="/docs/public/logo.png" alt="cap logo" width="80" />
    </p>
    <p>
        a privacy-first and self-hosted CAPTCHA.
        <br>
        <a href="https://trycap.dev/?utm_source=github&utm_campaign=read_docs">read the docs</a> or <a href="https://trycap.dev/guide/demo?utm_source=github&utm_campaign=demo_link">try the demo</a>
    </p>
    <br/>
    <a href="https://trycap.dev/guide/demo?utm_source=github&utm_campaign=captcha_animated">
        <img src="./assets/captcha-animated.svg" alt="cap widget" width="270" />
    </a>
    <br/>
</div>

## what's cap?

cap is a self-hosted and privacy-first captcha alternative that doesn't force your users to click on traffic lights. there are no puzzles, no tracking, and no third parties watching your visitors.

instead, the user's browser quietly solves a few small challenges in the background, such as gpu-resistant proof-of-work and instrumentation, which can also be configured to stop autonomous AI agents from using up your resources.

it has no dependencies by default, is 200x smaller than hCaptcha, and you can run it with docker, on workers or on railway. it's already used in production by large companies like [bunny.net](https://bunny.net) and [adguard](https://adguard.com).

### license

cap is licensed under [apache 2.0](LICENSE).

<br/>

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/9920/badge?v=gold)](https://www.bestpractices.dev/projects/9920) [![jsdelivr](https://data.jsdelivr.com/v1/package/npm/@cap.js/wasm/badge)](https://www.jsdelivr.com/package/npm/@cap.js/wasm)
