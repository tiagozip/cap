<script setup>
const groups = [
  {
    title: "Privacy & data protection",
    items: [
      {
        code: "GDPR",
        region: "European Union",
        flag: "eu",
        name: "General Data Protection Regulation",
        note: "No cookies or tracking for end users and no third-party calls. You stay the sole controller.",
      },
      {
        code: "CCPA / CPRA",
        region: "California, USA",
        flag: "us",
        name: "California Consumer Privacy Act",
        note: "Cap never sells or shares personal information and builds no consumer profiles.",
      },
      {
        code: "HIPAA",
        region: "United States",
        flag: "us",
        name: "Health Insurance Portability and Accountability Act",
        note: "No PHI is ever touched and everything runs on your own infrastructure.",
      },
      {
        code: "PIPEDA / CPPA",
        region: "Canada",
        flag: "ca",
        name: "Personal Information Protection and Electronic Documents Act",
        note: "No personal information is collected, disclosed, or sold to third parties.",
      },
      {
        code: "LGPD",
        region: "Brazil",
        flag: "br",
        name: "Lei Geral de Proteção de Dados",
        note: "Self-hosted with no profiling and no data sharing keeps processing minimal and fully under your control.",
      },
      {
        code: "DPDPA",
        region: "India",
        flag: "in",
        name: "Digital Personal Data Protection Act",
        note: "No personal data is stored or shared, and nothing leaves your servers.",
      },
      {
        code: "PIPL",
        region: "China",
        flag: "cn",
        name: "Personal Information Protection Law",
        note: "Self-host in-region and no data ever leaves your infrastructure.",
      },
      {
        code: "152-FZ",
        region: "Russia",
        flag: "ru",
        name: 'Federal Law No. 152-FZ "On Personal Data"',
        note: "Self-host on your own infrastructure, including in-region. No cookies, tracking, profiling, or third-party calls are required in the verification flow.",
      },
    ],
  },
  {
    title: "Accessibility",
    items: [
      {
        code: "WCAG 2.2 AA",
        region: "International",
        flag: "globe",
        name: "Web Content Accessibility Guidelines",
      },
      {
        code: "EAA / EN 301 549",
        region: "European Union",
        flag: "eu",
        name: "European Accessibility Act",
      },
      {
        code: "Section 508",
        region: "United States",
        flag: "us",
        name: "Rehabilitation Act, Section 508",
      },
      {
        code: "i18n",
        region: "Global",
        flag: "globe",
        name: "Localization & RTL support",
      },
    ],
  },
];
</script>

<template>
  <div class="cap-compliance">
    <section v-for="group in groups" :key="group.title" class="cc-group">
      <header class="cc-group-head">
        <h3>{{ group.title }}</h3>
      </header>

      <ul class="cc-grid">
        <li v-for="item in group.items" :key="item.code" class="cc-card">
          <div class="cc-card-top">
            <span class="cc-flag" aria-hidden="true">
              <svg
                v-if="item.flag === 'globe'"
                viewBox="0 0 32 32"
                width="28"
                height="28"
              >
                <rect x="1" y="1" width="30" height="30" rx="6" fill="#1f6feb" />
                <g
                  fill="none"
                  stroke="#fff"
                  stroke-width="1.6"
                  stroke-linecap="round"
                >
                  <circle cx="16" cy="16" r="10" />
                  <ellipse cx="16" cy="16" rx="4.2" ry="10" />
                  <path d="M6.4 13h19.2M6.4 19h19.2M16 6v20" />
                </g>
              </svg>
              <img
                v-else
                :src="`/assets/flags/${item.flag}.svg`"
                :alt="`${item.region} flag`"
                width="28"
                height="28"
                loading="lazy"
              />
            </span>
            <div class="cc-card-id">
              <span class="cc-code">{{ item.code }}</span>
              <span class="cc-region">{{ item.region }}</span>
            </div>
            <span class="cc-check" title="Compliant" aria-label="Compliant">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="m5 12 5 5L20 7"
                />
              </svg>
            </span>
          </div>
          <p class="cc-name">{{ item.name }}</p>
          <p class="cc-note">{{ item.note }}</p>
        </li>
      </ul>
    </section>
  </div>

  <small class="cc-disclaimer">This page describes how Cap is designed to support these regulations. It is not legal advice. Your overall compliance also depends on how you deploy Cap and the rest of your application.</small>
</template>

<style scoped>
.cap-compliance {
  margin: 28px 0 8px;
}

.cc-group + .cc-group {
  margin-top: 48px;
}

.cc-group-head h3 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  border: 0;
  padding: 0;
}

.cc-group-head p {
  margin: 0 0 20px;
  max-width: 760px;
  color: var(--vp-c-text-2);
  font-size: 14.5px;
  line-height: 1.6;
}

.cc-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.cc-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 18px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.cc-card-top {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cc-flag {
  flex-shrink: 0;
  display: inline-flex;
  width: 28px;
  height: 28px;
  border-radius: 7px;
  overflow: hidden;
}

.cc-flag img,
.cc-flag svg {
  display: block;
  width: 28px;
  height: 28px;
  border-radius: 7px;
}

.cc-card-id {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
  line-height: 1.3;
}

.cc-code {
  font-weight: 600;
  font-size: 15px;
  line-height: 1.25;
  color: var(--vp-c-text-1);
}

.cc-region {
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin-top: 1px;
}

.cc-check {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #1cb47e;
  background: rgba(28, 180, 126, 0.14);
}

.cc-name {
  margin: 14px 0 6px;
  font-size: 13px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  line-height: 1.3;
}

.cc-note {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: var(--vp-c-text-2);
}

.cc-disclaimer {
  margin-top: 3em;
  display: block;
  color: var(--vp-c-text-3);
  border-top: 1px solid var(--vp-c-bg-elv);
  padding-top: 1.5em;
}

@media (max-width: 640px) {
  .cc-grid {
    grid-template-columns: 1fr;
  }
}
</style>
