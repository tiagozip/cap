<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { demoMode } from "./demoMode";

const open = ref(false);

const onReply = () => {
  try {
    plausible("demo-reply", { props: { mode: demoMode.value } });
  } catch (_) {}
  open.value = true;
};

const close = () => {
  open.value = false;
};

const onStar = () => {
  try {
    plausible("star-cta", { props: { source: "demo-reply-modal" } });
  } catch (_) {}
};

const onKey = (e) => {
  if (e.key === "Escape") close();
};

onMounted(() => {
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
});
</script>

<template>
  <ClientOnly>
    <button
      v-if="demoMode === 'widget'"
      type="button"
      class="signin-button"
      @click="onReply"
    >
      Reply
    </button>
    <button
      v-else
      type="button"
      class="signin-button active"
      data-cap-floating="#demo-floating-widget"
      data-cap-floating-position="bottom"
      data-cap-floating-offset="12"
      @click="onReply"
    >
      Reply
    </button>

    <template #fallback>
      <button type="button" class="signin-button">Reply</button>
    </template>
  </ClientOnly>

  <Teleport to="body">
    <Transition name="reply-modal">
      <div
        v-if="open"
        class="reply-modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reply-modal-title"
        @click.self="close"
      >
        <div class="reply-modal">
          <button
            type="button"
            class="reply-modal__close"
            aria-label="Close"
            @click="close"
          >
            ×
          </button>
          <div class="reply-modal__icon" aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <h2 id="reply-modal-title" class="reply-modal__title">
            It worked!
          </h2>
          <p class="reply-modal__body">
            This was a demo, but Cap is real and<br> open source. If you like what
            you saw, a<br> star on GitHub goes a long way.
          </p>
          <div class="reply-modal__actions">
            <a
              class="reply-modal__primary"
              href="https://github.com/tiagozip/cap"
              target="_blank"
              rel="noopener"
              @click="onStar"
            >
              ★ Star on GitHub
            </a>
            <button
              type="button"
              class="reply-modal__secondary"
              @click="close"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.reply-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  backdrop-filter: blur(2px);
}

.reply-modal {
  position: relative;
  width: 100%;
  max-width: 400px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 14px;
  padding: 24px 24px 20px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.reply-modal__close {
  position: absolute;
  top: 8px;
  right: 10px;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--vp-c-text-2);
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  border-radius: 8px;
}

.reply-modal__close:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
}

.reply-modal__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--vp-c-brand-1) 18%, transparent);
  color: var(--vp-c-brand-1);
  margin-bottom: 10px;
}

.reply-modal__title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.reply-modal__body {
  margin: 0 0 18px;
  color: var(--vp-c-text-2);
  font-size: 14px;
  line-height: 1.5;
}

.reply-modal__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reply-modal__primary {
  display: inline-block;
  padding: 10px 16px;
  background: var(--vp-c-brand-1);
  color: #1b1b1f;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: filter 0.15s;
}

.reply-modal__primary:hover {
  filter: brightness(92%);
}

.reply-modal__secondary {
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: var(--vp-c-text-2);
  font-size: 13px;
  cursor: pointer;
  border-radius: 8px;
}

.reply-modal__secondary:hover {
  color: var(--vp-c-text-1);
}

.reply-modal-enter-active,
.reply-modal-leave-active {
  transition: opacity 0.18s ease;
}
.reply-modal-enter-active .reply-modal,
.reply-modal-leave-active .reply-modal {
  transition: transform 0.22s cubic-bezier(0.2, 0.9, 0.3, 1.2),
    opacity 0.18s ease;
}
.reply-modal-enter-from,
.reply-modal-leave-to {
  opacity: 0;
}
.reply-modal-enter-from .reply-modal,
.reply-modal-leave-to .reply-modal {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}
</style>
