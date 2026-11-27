export const FRAMEWORKS = [
  ["html", "HTML"],
  ["react", "React"],
  ["vue", "Vue"],
  ["svelte", "Svelte"],
];

export const FRAMEWORK_KEY = "cap_embed_framework";

export const savedFramework = () => {
  try {
    const saved = localStorage.getItem(FRAMEWORK_KEY);
    return FRAMEWORKS.some(([id]) => id === saved) ? saved : "html";
  } catch {
    return "html";
  }
};

export const saveFramework = (id) => {
  try {
    localStorage.setItem(FRAMEWORK_KEY, id);
  } catch {}
};

export const installCommand = (files) => `npm i cap-widget@${files.widget}`;

export const frameworkComponent = (framework, endpoint, files, origin) => {
  const selfHosted = (indent) => {
    if (!files.selfHosted) return "";
    const base = `${origin}/assets`;
    return `\n\n${indent}window.CAP_CUSTOM_WASM_URL = "${base}/cap_wasm_bg.wasm";\n${indent}window.CAP_CUSTOM_HASHWX_URL = "${base}/hashwx.wasm";`;
  };
  return {
    react: {
      filename: "Form.jsx",
      language: "jsx",
      code: `import "cap-widget";${selfHosted("")}

export default function Form() {
  return (
    <cap-widget
      data-cap-api-endpoint="${endpoint}"
      onsolve={(e) => console.log(e.detail.token)}
    />
  );
}`,
    },
    vue: {
      filename: "Form.vue",
      language: "vue",
      code: `<script setup>
import "cap-widget";${selfHosted("")}
</${"script"}>

<template>
  <cap-widget
    data-cap-api-endpoint="${endpoint}"
    @solve="(e) => console.log(e.detail.token)"
  />
</template>`,
    },
    svelte: {
      filename: "Form.svelte",
      language: "svelte",
      code: `<script>
  import "cap-widget";${selfHosted("  ")}
</${"script"}>

<cap-widget
  data-cap-api-endpoint="${endpoint}"
  onsolve={(e) => console.log(e.detail.token)}
></cap-widget>`,
    },
  }[framework];
};
