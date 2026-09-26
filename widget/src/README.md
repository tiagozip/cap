# cap-widget

Client-side widget for Cap, the self-hosted CAPTCHA for the modern web.

**[Learn more](https://trycap.dev/?utm_source=npm&utm_medium=referral&utm_campaign=readme)**

## Mascot card (`data-cap-mascot`)

`data-cap-mascot` is an opt-in attribute that turns the default pill into a
vertical card: a small "Priestess Verification" brand wordmark on top, a
character illustration in the middle (the same credits link is reused as the
wordmark, so no second credits entry appears), and the regular checkbox +
label trigger row at the bottom. Keyboard, click, ARIA, events and the token
behaviour are unchanged.

```html
<cap-widget
  data-cap-mascot
  data-cap-api-endpoint="https://verify.example.com/"
></cap-widget>
```

Without the attribute nothing changes: the stock pill is rendered and not a
single mascot image is requested.

### Character images

Three stacked `<img>` elements (`alt=""`, `aria-hidden="true"`) follow the
widget's `data-state` and cross-fade over ~200ms (`prefers-reduced-motion:
reduce` disables the transition):

| widget state                             | image      |
| ---------------------------------------- | ---------- |
| no state / initial / `verifying`         | `checking` |
| `error`                                  | `error`    |
| `done`                                   | `done`     |

### Image URL resolution

The attribute value is a **directory base URL**; the three file names
(`checking.webp`, `error.webp`, `done.webp`) are appended to it. A trailing
slash is optional. Priority, highest first:

1. the `data-cap-mascot` attribute value, when non-empty
   (`data-cap-mascot="/assets/mascot"`);
2. `window.CAP_MASCOT_URL` (same directory base, must be set before the widget
   script runs);
3. the directory the widget script was loaded from, plus `mascot/` — captured
   from `document.currentScript` while the script evaluates. This makes the
   jsDelivr build resolve to `.../widget/src/mascot/checking.webp` and the
   Worker's `/widget.js` resolve to `/mascot/checking.webp`.

`document.currentScript` is `null` when the bundle is loaded as a module or by
a bundler. In that case the widget falls back to a page-relative `mascot/`
directory and logs a single `warn`; set the attribute value or
`window.CAP_MASCOT_URL` to silence it.

The attribute is read on connect and re-read whenever it changes, so adding or
removing `data-cap-mascot` at runtime rebuilds (or removes) the card.

### CSS variables

| variable                   | default | meaning                                              |
| -------------------------- | ------- | ---------------------------------------------------- |
| `--cap-widget-width`       | `260px` | card width (shared with the default layout)           |
| `--cap-mascot-height`      | `268px` | card height                                           |
| `--cap-mascot-image-height`| `176px` | height of the illustration area (`object-fit: contain`) |
| `--cap-widget-height`      | `58px`  | height of the trigger row reserved at the bottom      |

With `.has-troubleshoot` (the troubleshooting link shown after an
instrumentation failure) the card grows by the same extra `26px` as the
default layout.
