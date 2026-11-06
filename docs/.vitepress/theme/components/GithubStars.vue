<script setup>
import { useData } from "vitepress";
import { computed, onMounted, ref } from "vue";
import { homeV2Strings } from "./homeV2.strings.js";

const { localeIndex } = useData();
const label = computed(() => (homeV2Strings[localeIndex.value] ?? homeV2Strings.en).navGithubStars ?? homeV2Strings.en.navGithubStars);
const stars = ref("6.2k");

onMounted(async () => {
  try {
    const cached = sessionStorage.getItem("cap-gh-stars");
    if (cached) {
      stars.value = cached;
      return;
    }
    const res = await fetch("https://api.github.com/repos/tiagozip/cap", {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const n = (await res.json()).stargazers_count;
    if (typeof n !== "number") return;
    stars.value = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
    sessionStorage.setItem("cap-gh-stars", stars.value);
  } catch {}
});
</script>

<template>
  <a class="gh-stars" href="https://github.com/tiagozip/cap" target="_blank" rel="noopener">
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path
        d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.69-3.87-1.54-3.87-1.54-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.02 1.75 2.68 1.24 3.34.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.68 0-1.25.45-2.28 1.18-3.08-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.15 1.18.91-.25 1.89-.38 2.86-.38.97 0 1.95.13 2.86.38 2.19-1.49 3.15-1.18 3.15-1.18.62 1.58.23 2.75.11 3.04.73.8 1.18 1.83 1.18 3.08 0 4.41-2.69 5.38-5.25 5.67.41.35.78 1.05.78 2.11 0 1.52-.01 2.75-.01 3.12 0 .31.21.67.8.56C20.71 21.38 24 17.08 24 12c0-6.27-5.23-11.5-11.5-11.5z"
      />
    </svg>
    <span class="gh-stars-sr">GitHub, </span>
    <span>{{ stars }} {{ label }}</span>
  </a>
</template>
