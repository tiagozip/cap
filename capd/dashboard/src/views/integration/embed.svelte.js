import { capAssets } from "../../../../package.json";
import { api } from "../../lib/api.js";

const CDN = "https://cdn.jsdelivr.net/npm";

export const widgetFiles = $state({
  selfHosted: false,
  widget: capAssets.widget,
  wasm: capAssets.wasm,
  loaded: false,
});

export const setWidgetFiles = (s) => {
  if (!s || s.error) return;
  widgetFiles.selfHosted = !!s.enabled;
  widgetFiles.widget = s.widget || capAssets.widget;
  widgetFiles.wasm = s.wasm || capAssets.wasm;
  widgetFiles.loaded = true;
};

let fetching = null;
export const loadWidgetFiles = () => {
  fetching ??= api("GET", "/settings/assets").then(setWidgetFiles);
  return fetching;
};

export const cdnWidgetUrl = (version) => `${CDN}/@cap.js/widget@${version}`;

export const widgetScript = (files = widgetFiles) => {
  if (!files.selfHosted)
    return `<script src="${cdnWidgetUrl(files.widget)}"></${"script"}>`;
  const base = `${location.origin}/assets`;
  return `<script>
  window.CAP_CUSTOM_WASM_URL = "${base}/cap_wasm_bg.wasm";
  window.CAP_CUSTOM_HASHWX_URL = "${base}/hashwx.wasm";
</${"script"}>
<script src="${base}/widget.js"></${"script"}>`;
};

export const endpointOf = (siteKey) => `${location.origin}/${siteKey}/`;

const inject = (src) =>
  new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      script.remove();
      reject(new Error(`Couldn't load ${src}`));
    };
    document.head.append(script);
  });

let loading = null;

export const loadWidget = () => {
  if (customElements.get("cap-widget")) return Promise.resolve();
  loading ??= loadWidgetFiles()
    .catch(() => {})
    .then(() => {
      const self = `${location.origin}/assets`;
      const cdn = cdnWidgetUrl(widgetFiles.widget);
      if (!widgetFiles.selfHosted) return inject(cdn);
      window.CAP_CUSTOM_WASM_URL = `${self}/cap_wasm_bg.wasm`;
      window.CAP_CUSTOM_HASHWX_URL = `${self}/hashwx.wasm`;
      return inject(`${self}/widget.js`).catch(() => {
        delete window.CAP_CUSTOM_WASM_URL;
        delete window.CAP_CUSTOM_HASHWX_URL;
        return inject(cdn);
      });
    })
    .then(() => customElements.whenDefined("cap-widget"))
    .catch((err) => {
      loading = null;
      throw err;
    });
  return loading;
};
