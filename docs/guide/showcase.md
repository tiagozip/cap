<script setup>
import showcase from '../.vitepress/theme/data/showcase'
</script>

# Who's Using Cap

Organizations and projects that trust Cap for their CAPTCHA needs.

<div class="users-grid">

<div v-for="entry in showcase" :key="entry.name" class="user-card">
  <a :href="entry.url" target="_blank" rel="noopener noreferrer" class="user-logo-wrap">
    <img
      :src="entry.logo"
      :alt="entry.name"
      class="user-logo"
      loading="lazy"
    />
  </a>
  <a :href="entry.url" target="_blank" rel="noopener noreferrer" class="user-name">{{ entry.name }}</a>
</div>

</div>

---

## Add Your Organization

Using Cap in production? We'd love to feature your logo here.

1. Add your logo as an SVG file to [`docs/public/logos/`](https://github.com/tiagozip/cap/tree/main/docs/public/logos) following the [logo guidelines](https://github.com/tiagozip/cap/blob/main/docs/public/logos/README.md)
   - Use a **horizontal/landscape** logo when possible
   - Keep the viewBox proportional — the logo will be displayed at a consistent height
   - Optimize the SVG (remove unnecessary metadata, minify paths)
2. Add your entry to [`docs/.vitepress/theme/data/showcase.ts`](https://github.com/tiagozip/cap/blob/main/docs/.vitepress/theme/data/showcase.ts)
3. Open a pull request

We'll review and merge it. Thank you for supporting Cap!

<style>
.users-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px;
  margin: 32px 0 48px;
}

.user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 28px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s ease, background 0.2s ease;
}

.user-card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-alt);
}

.user-logo-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 48px;
}

.user-logo {
  max-height: 48px;
  max-width: 160px;
  object-fit: contain;
  filter: grayscale(100%) brightness(0.9);
  transition: filter 0.25s ease;
}

.user-card:hover .user-logo {
  filter: grayscale(0%) brightness(1);
}

.user-name {
  font-size: 13px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  transition: color 0.2s ease;
}

.user-name:hover {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
}
</style>
