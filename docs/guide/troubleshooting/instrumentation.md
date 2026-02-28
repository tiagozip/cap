---
sidebar: false
editLink: false
prev: false
next: false
footer: false
---

# Troubleshooting

This verification can fail for various reasons, not solely due to bot activity. If you're having trouble completing verification, follow these steps to resolve the issue.

## 1. Try incognito or private mode

Open your browser's incognito or private mode to rule out issues caused by extensions or cached data.

- **Chrome / Edge:** Press `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac)
- **Firefox:** Press `Ctrl+Shift+P` (Windows) or `Cmd+Shift+P` (Mac)
- **Safari:** Go to **File → New Private Window**

## 2. Disable your browser extensions

Some extensions may interfere with the verification process. Try disabling them temporarily:

1. Open your browser's extensions or add-ons settings
2. Temporarily disable **all** extensions
3. Reload the page and try again

If this fixes the issue, re-enable extensions one by one to find the culprit.

## 3. Try a different browser or device

The issue may be specific to your current browser. Switch to another browser or device to test.

- Try **Chrome**, **Firefox**, **Edge**, or **Safari**
- Note: **Internet Explorer is not supported** — use a modern browser instead
- If possible, try on a completely different device (e.g., your phone)

## 4. Update your browser

An outdated browser can cause verification to fail.

1. Open your browser's menu
2. Go to **Help → About** (or similar)
3. Install any available updates and restart your browser

## 5. Switch to a different network

Your current network may have restrictions that interfere with verification.

- Connect to a **different Wi-Fi network**
- Try using a **mobile hotspot** from your phone
- If you're on a corporate or school network, those often have strict filtering that can block verification

## 6. Close any automated browser sessions

If you're using a browser controlled by automation software (such as Selenium, Puppeteer, or Playwright), verification will be blocked.

1. **Fully close** the automated browser session
2. Open the page in a **regular, manually-operated browser**
3. Complete the verification there

AI agent browsers are also blocked — make sure you're using a standard browser.

---

If you've tried all of the above and still can't get through, consider reaching out to the site owner for further assistance. You may also alternatively [file an issue](https://github.com/tiagozip/cap/issues).