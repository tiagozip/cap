<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });

const langs = [
  { id: "node", x: -0.78, y: -56, lane: -14, d: "M11.998 24c-.321 0-.641-.084-.922-.247L8.14 22.016c-.438-.245-.224-.332-.08-.383c.585-.203.703-.25 1.328-.604c.065-.037.151-.023.218.017l2.256 1.339a.29.29 0 0 0 .272 0l8.795-5.076a.28.28 0 0 0 .134-.238V6.921a.28.28 0 0 0-.137-.242l-8.791-5.072a.28.28 0 0 0-.271 0L3.075 6.68a.28.28 0 0 0-.139.241v10.15a.27.27 0 0 0 .139.235l2.409 1.392c1.307.654 2.108-.116 2.108-.89V7.787c0-.142.114-.253.256-.253h1.115c.139 0 .255.112.255.253v10.021c0 1.745-.95 2.745-2.604 2.745c-.508 0-.909 0-2.026-.551L2.28 18.675a1.86 1.86 0 0 1-.922-1.604V6.921c0-.659.353-1.275.922-1.603L11.075.236a1.93 1.93 0 0 1 1.848 0l8.794 5.082c.57.329.924.944.924 1.603v10.15a1.86 1.86 0 0 1-.924 1.604l-8.794 5.078c-.28.163-.599.247-.925.247m7.101-10.007c0-1.9-1.284-2.406-3.987-2.763c-2.731-.361-3.009-.548-3.009-1.187c0-.528.235-1.233 2.258-1.233c1.807 0 2.473.389 2.747 1.607a.254.254 0 0 0 .247.199h1.141a.26.26 0 0 0 .186-.081a.26.26 0 0 0 .067-.196c-.177-2.098-1.571-3.076-4.388-3.076c-2.508 0-4.004 1.058-4.004 2.833c0 1.925 1.488 2.457 3.895 2.695c2.88.282 3.103.703 3.103 1.269c0 .983-.789 1.402-2.642 1.402c-2.327 0-2.839-.584-3.011-1.742a.255.255 0 0 0-.253-.215h-1.137a.25.25 0 0 0-.254.253c0 1.482.806 3.248 4.655 3.248c2.788.001 4.386-1.096 4.386-3.013" },
  { id: "rust", x: 0.42, y: -62, lane: -16, d: "m23.835 11.703l-1.008-.623l-.028-.294l.866-.807a.348.348 0 0 0-.116-.578l-1.106-.414a9 9 0 0 0-.087-.285l.69-.96a.346.346 0 0 0-.226-.544l-1.166-.19a9 9 0 0 0-.14-.261l.49-1.076a.34.34 0 0 0-.028-.336a.35.35 0 0 0-.3-.154l-1.185.041a7 7 0 0 0-.188-.227l.273-1.153a.347.347 0 0 0-.417-.417l-1.153.273l-.228-.188l.041-1.184a.344.344 0 0 0-.49-.328l-1.076.49l-.262-.14l-.19-1.167a.348.348 0 0 0-.545-.226l-.96.69a9 9 0 0 0-.285-.086L14.597.453a.348.348 0 0 0-.578-.116l-.807.867a9 9 0 0 0-.294-.028L12.295.168a.346.346 0 0 0-.59 0l-.623 1.008l-.294.028L9.98.337a.346.346 0 0 0-.578.116l-.414 1.106l-.285.086l-.959-.69a.348.348 0 0 0-.545.226l-.19 1.167a9 9 0 0 0-.262.14l-1.076-.49a.346.346 0 0 0-.49.328l.041 1.184a8 8 0 0 0-.228.187l-1.153-.272a.347.347 0 0 0-.417.417l.271 1.153l-.186.227l-1.184-.042a.346.346 0 0 0-.328.49l.49 1.077a9 9 0 0 0-.14.262l-1.166.19a.348.348 0 0 0-.226.544l.69.958l-.087.286l-1.106.414a.348.348 0 0 0-.116.578l.866.807a9 9 0 0 0-.028.294l-1.008.623a.344.344 0 0 0 0 .59l1.008.623q.012.147.028.294l-.866.807a.346.346 0 0 0 .116.578l1.106.415q.042.144.087.285l-.69.959a.345.345 0 0 0 .227.544l1.166.19q.069.132.14.262l-.49 1.076a.346.346 0 0 0 .328.49l1.183-.041q.093.115.187.227l-.27 1.154a.346.346 0 0 0 .416.417l1.153-.272q.113.096.228.187l-.041 1.184a.344.344 0 0 0 .49.327l1.076-.49q.13.073.262.14l.19 1.167a.348.348 0 0 0 .545.227l.959-.69a9 9 0 0 0 .285.086l.414 1.107a.345.345 0 0 0 .578.115l.808-.865l.294.03l.623 1.006a.347.347 0 0 0 .59 0l.623-1.007q.148-.013.294-.03l.807.866a.348.348 0 0 0 .578-.115l.414-1.107a9 9 0 0 0 .285-.087l.959.69a.345.345 0 0 0 .545-.226l.19-1.166l.262-.14l1.076.49a.347.347 0 0 0 .49-.328l-.041-1.184a7 7 0 0 0 .227-.187l1.153.272a.347.347 0 0 0 .417-.416l-.272-1.155q.095-.112.187-.227l1.184.041a.344.344 0 0 0 .328-.49l-.49-1.076q.072-.13.141-.262l1.166-.19a.348.348 0 0 0 .226-.544l-.69-.959l.087-.285l1.106-.414a.346.346 0 0 0 .116-.579l-.866-.807q.016-.147.028-.294l1.008-.624a.344.344 0 0 0 0-.589zm-6.742 8.355a.714.714 0 0 1 .299-1.396a.714.714 0 1 1-.3 1.396zm-.342-2.314a.65.65 0 0 0-.771.5l-.358 1.669a8.7 8.7 0 0 1-3.619.78a8.7 8.7 0 0 1-3.695-.815L7.95 18.21a.65.65 0 0 0-.772-.5l-1.473.317a9 9 0 0 1-.761-.898h7.167c.081 0 .136-.014.136-.088v-2.536c0-.074-.054-.088-.136-.088h-2.096v-1.608h2.268c.206 0 1.106.059 1.393 1.209c.09.353.288 1.504.424 1.873c.134.413.683 1.238 1.268 1.238h3.572a1 1 0 0 0 .13-.013a9 9 0 0 1-.813.952zm-9.914 2.28a.714.714 0 1 1-.3-1.396a.714.714 0 0 1 .3 1.396M4.117 8.997a.714.714 0 1 1-1.303.58a.714.714 0 0 1 1.304-.58m-.834 1.981l1.534-.682a.65.65 0 0 0 .33-.858l-.316-.715h1.244v5.602H3.567a8.8 8.8 0 0 1-.284-3.348zm6.734-.543V8.784h2.96c.153 0 1.08.177 1.08.87c0 .574-.712.78-1.296.78zm10.757 1.486q0 .329-.024.651h-.9c-.09 0-.127.059-.127.148v.413c0 .973-.548 1.184-1.03 1.238c-.457.052-.964-.191-1.027-.472c-.27-1.518-.72-1.843-1.43-2.403c.882-.56 1.799-1.386 1.799-2.492c0-1.193-.82-1.945-1.377-2.315c-.783-.516-1.65-.62-1.883-.62H5.468a8.77 8.77 0 0 1 4.907-2.77l1.098 1.152a.65.65 0 0 0 .918.02l1.227-1.173a8.78 8.78 0 0 1 6.004 4.276l-.84 1.898a.65.65 0 0 0 .33.859l1.618.718q.042.43.042.872zm-9.3-9.6a.713.713 0 1 1 .984 1.032a.714.714 0 0 1-.984-1.031m8.339 6.71a.71.71 0 0 1 .939-.362a.714.714 0 1 1-.94.364z" },
  { id: "python", x: -0.42, y: 60, lane: 20, d: "m14.25.18l.9.2l.73.26l.59.3l.45.32l.34.34l.25.34l.16.33l.1.3l.04.26l.02.2l-.01.13V8.5l-.05.63l-.13.55l-.21.46l-.26.38l-.3.31l-.33.25l-.35.19l-.35.14l-.33.1l-.3.07l-.26.04l-.21.02H8.77l-.69.05l-.59.14l-.5.22l-.41.27l-.33.32l-.27.35l-.2.36l-.15.37l-.1.35l-.07.32l-.04.27l-.02.21v3.06H3.17l-.21-.03l-.28-.07l-.32-.12l-.35-.18l-.36-.26l-.36-.36l-.35-.46l-.32-.59l-.28-.73l-.21-.88l-.14-1.05l-.05-1.23l.06-1.22l.16-1.04l.24-.87l.32-.71l.36-.57l.4-.44l.42-.33l.42-.24l.4-.16l.36-.1l.32-.05l.24-.01h.16l.06.01h8.16v-.83H6.18l-.01-2.75l-.02-.37l.05-.34l.11-.31l.17-.28l.25-.26l.31-.23l.38-.2l.44-.18l.51-.15l.58-.12l.64-.1l.71-.06l.77-.04l.84-.02l1.27.05zm-6.3 1.98l-.23.33l-.08.41l.08.41l.23.34l.33.22l.41.09l.41-.09l.33-.22l.23-.34l.08-.41l-.08-.41l-.23-.33l-.33-.22l-.41-.09l-.41.09zm13.09 3.95l.28.06l.32.12l.35.18l.36.27l.36.35l.35.47l.32.59l.28.73l.21.88l.14 1.04l.05 1.23l-.06 1.23l-.16 1.04l-.24.86l-.32.71l-.36.57l-.4.45l-.42.33l-.42.24l-.4.16l-.36.09l-.32.05l-.24.02l-.16-.01h-8.22v.82h5.84l.01 2.76l.02.36l-.05.34l-.11.31l-.17.29l-.25.25l-.31.24l-.38.2l-.44.17l-.51.15l-.58.13l-.64.09l-.71.07l-.77.04l-.84.01l-1.27-.04l-1.07-.14l-.9-.2l-.73-.25l-.59-.3l-.45-.33l-.34-.34l-.25-.34l-.16-.33l-.1-.3l-.04-.25l-.02-.2l.01-.13v-5.34l.05-.64l.13-.54l.21-.46l.26-.38l.3-.32l.33-.24l.35-.2l.35-.14l.33-.1l.3-.06l.26-.04l.21-.02l.13-.01h5.84l.69-.05l.59-.14l.5-.21l.41-.28l.33-.32l.27-.35l.2-.36l.15-.36l.1-.35l.07-.32l.04-.28l.02-.21V6.07h2.09l.14.01zm-6.47 14.25l-.23.33l-.08.41l.08.41l.23.33l.33.23l.41.08l.41-.08l.33-.23l.23-.33l.08-.41l-.08-.41l-.23-.33l-.33-.23l-.41-.08l-.41.08z" },
  { id: "php", x: 0.92, y: 2, lane: 2, d: "M7.01 10.207h-.944l-.515 2.648h.838q.834 0 1.242-.314q.408-.315.55-1.049q.137-.705-.124-.995q-.262-.29-1.047-.29M12 5.688C5.373 5.688 0 8.514 0 12s5.373 6.313 12 6.313S24 15.486 24 12s-5.373-6.312-12-6.312m-3.26 7.451c-.261.25-.575.438-.917.551q-.505.163-1.285.164H5.357l-.327 1.681H3.652l1.23-6.326h2.65q1.195 0 1.744.628q.549.627.33 1.752a2.8 2.8 0 0 1-.305.847q-.215.383-.561.703m4.024.715l.543-2.799q.094-.478-.068-.651q-.16-.174-.687-.174H11.46l-.704 3.625H9.388l1.23-6.327h1.367l-.327 1.682h1.218q1.15 0 1.586.401c.436.401.378.7.263 1.299l-.572 2.944zm7.597-2.265a2.8 2.8 0 0 1-.305.847q-.214.383-.561.703a2.44 2.44 0 0 1-.917.551q-.504.163-1.286.164h-1.18l-.327 1.682h-1.378l1.23-6.326h2.649q1.195 0 1.744.628q.55.626.331 1.751m-2.595-1.382h-.943l-.516 2.648h.838q.835 0 1.242-.314q.407-.315.551-1.049q.137-.705-.125-.995c-.262-.29-.524-.29-1.047-.29" },
  { id: "go", x: -0.98, y: 8, lane: 8, d: "M1.811 10.231c-.047 0-.058-.023-.035-.059l.246-.315c.023-.035.081-.058.128-.058h4.172c.046 0 .058.035.035.07l-.199.303c-.023.036-.082.07-.117.07zM.047 11.306c-.047 0-.059-.023-.035-.058l.245-.316c.023-.035.082-.058.129-.058h5.328c.047 0 .07.035.058.07l-.093.28c-.012.047-.058.07-.105.07zm2.828 1.075c-.047 0-.059-.035-.035-.07l.163-.292c.023-.035.07-.07.117-.07h2.337c.047 0 .07.035.07.082l-.023.28c0 .047-.047.082-.082.082zm12.129-2.36c-.736.187-1.239.327-1.963.514c-.176.046-.187.058-.34-.117c-.174-.199-.303-.327-.548-.444c-.737-.362-1.45-.257-2.115.175c-.795.514-1.204 1.274-1.192 2.22c.011.935.654 1.706 1.577 1.835c.795.105 1.46-.175 1.987-.77c.105-.13.198-.27.315-.434H10.47c-.245 0-.304-.152-.222-.35c.152-.362.432-.97.596-1.274a.32.32 0 0 1 .292-.187h4.253c-.023.316-.023.631-.07.947a5 5 0 0 1-.958 2.29c-.841 1.11-1.94 1.8-3.33 1.986c-1.145.152-2.209-.07-3.143-.77c-.865-.655-1.356-1.52-1.484-2.595c-.152-1.274.222-2.419.993-3.424c.83-1.086 1.928-1.776 3.272-2.02c1.098-.2 2.15-.07 3.096.571c.62.41 1.063.97 1.356 1.648c.07.105.023.164-.117.2m3.868 6.461c-1.064-.024-2.034-.328-2.852-1.029a3.67 3.67 0 0 1-1.262-2.255c-.21-1.32.152-2.489.947-3.529c.853-1.122 1.881-1.706 3.272-1.95c1.192-.21 2.314-.095 3.33.595c.923.63 1.496 1.484 1.648 2.605c.198 1.578-.257 2.863-1.344 3.962c-.771.783-1.718 1.273-2.805 1.495c-.315.06-.63.07-.934.106m2.78-4.72c-.011-.153-.011-.27-.034-.387c-.21-1.157-1.274-1.81-2.384-1.554c-1.087.245-1.788.935-2.045 2.033c-.21.912.234 1.835 1.075 2.21c.643.28 1.285.244 1.905-.07c.923-.48 1.425-1.228 1.484-2.233z" },
  { id: "ruby", x: 0.66, y: 58, lane: 16, d: "M20.156.083c3.033.525 3.893 2.598 3.829 4.77L24 4.822L22.635 22.71L4.89 23.926h.016C3.433 23.864.15 23.729 0 19.139l1.645-3l2.819 6.586l.503 1.172l2.805-9.144l-.03.007l.016-.03l9.255 2.956l-1.396-5.431l-.99-3.9l8.82-.569l-.615-.51L16.5 2.114L20.159.073zM5.13 5.073c3.561-3.533 8.157-5.621 9.922-3.84c1.762 1.777-.105 6.105-3.673 9.636c-3.563 3.532-8.103 5.734-9.864 3.957c-1.766-1.777.045-6.217 3.612-9.75z" },
];

const art = ref(null);
const dot = ref(null);
const size = ref({ w: 760, h: 236 });
const active = ref(-1);
const lit = ref(false);

const geo = computed(() => {
  const { w, h } = size.value;
  const cx = w / 2;
  const cy = h / 2 - 6;
  const half = Math.min(w / 2 - 34, 330);
  const r = 10;
  return {
    cx,
    cy,
    tiles: langs.map((l) => {
      const tx = Math.round(cx + l.x * half);
      const ty = Math.round(cy + l.y);
      const lane = Math.round(cy + l.lane);
      const side = Math.sign(l.x);
      const ex = cx - side * 42;
      if (l.lane === l.y) return { ...l, tx, ty, path: `M${tx - side * 23} ${ty}H${ex}` };
      const dir = Math.sign(l.lane - l.y);
      return { ...l, tx, ty, path: `M${tx} ${ty + dir * 23}V${lane - dir * r}Q${tx} ${lane} ${tx - side * r} ${lane}H${ex}` };
    }),
  };
});

let ro;
let io;
let seen = false;
let hovering = false;
let timer = 0;
let anim;
let reduce = false;

const stop = () => {
  clearTimeout(timer);
  timer = 0;
  anim?.cancel();
  anim = undefined;
};

const step = () => {
  if (!hovering || !seen) return stop();
  active.value = (active.value + 1) % langs.length;
  const el = dot.value;
  if (!el?.animate) return;
  el.style.offsetPath = `path("${geo.value.tiles[active.value].path}")`;
  anim = el.animate(
    [
      { offsetDistance: "0%", opacity: 0 },
      { opacity: 1, offset: 0.18 },
      { opacity: 1, offset: 0.86 },
      { offsetDistance: "100%", opacity: 0 },
    ],
    { duration: 620, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
  );
  anim.finished.then(() => {
    if (hovering) lit.value = true;
  }, () => {});
  timer = setTimeout(step, 900);
};

const onEnter = () => {
  hovering = true;
  if (!matchMedia("(hover: hover)").matches) return;
  if (reduce) {
    lit.value = true;
    return;
  }
  if (!timer) step();
};

const onLeave = () => {
  hovering = false;
  stop();
  active.value = -1;
  lit.value = false;
};

onMounted(() => {
  reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  ro = new ResizeObserver(([e]) => {
    const { width, height } = e.contentRect;
    if (width && height) size.value = { w: width, h: height };
  });
  ro.observe(art.value);
  io = new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    if (!seen) onLeave();
  });
  io.observe(art.value);
});

onBeforeUnmount(() => {
  ro?.disconnect();
  io?.disconnect();
  hovering = false;
  stop();
});
</script>

<template>
  <article class="cell tb-c-api" @pointerenter="onEnter" @pointerleave="onLeave">
    <div ref="art" class="tb-art tba-art" :data-lit="lit" aria-hidden="true">
      <div class="tb-shelf tba-shelf" :style="{ top: `${geo.cy}px` }"></div>
      <div class="tb-plate tba-plate" :style="{ left: `${geo.cx - 82}px`, top: `${geo.cy - 66}px` }"></div>
      <div class="tba-light" :style="{ left: `${geo.cx}px` }"></div>
      <svg class="tba-lines" :width="size.w" :height="size.h" :style="{ '--cx': `${geo.cx}px`, '--cy': `${geo.cy}px` }">
        <path v-for="(l, i) in geo.tiles" :key="l.id" :d="l.path" :class="{ 'tba-on': i === active }" />
      </svg>
      <span ref="dot" class="tba-dot"></span>
      <span
        v-for="(l, i) in geo.tiles"
        :key="l.id"
        class="tba-tile"
        :class="{ 'tba-on': i === active }"
        :style="{ transform: `translate(${l.tx - 23}px, ${l.ty - 23}px)` }"
      >
        <svg viewBox="0 0 24 24" width="21" height="21"><path fill="currentColor" :d="l.d" /></svg>
      </span>
      <span class="tba-key" :style="{ transform: `translate(${geo.cx - 38}px, ${geo.cy - 38}px)` }">
        <img class="tba-cap" src="/logo.png" alt="" width="40" height="40" />
        <span class="tba-tick">
          <svg viewBox="0 0 16 16" width="10" height="10"><path d="M4 8.4l2.6 2.4L12 5.4" /></svg>
        </span>
      </span>
    </div>
    <div class="tb-copy">
      <h3>{{ t.cellApiTitle }}</h3>
      <p>{{ t.cellApiBody }}</p>
    </div>
  </article>
</template>

<style>
#homev2 .cell.tb-c-api .tba-art {
  mask-image: linear-gradient(to right, transparent, #000 10%, #000 90%, transparent);
}
#homev2 .tb-c-api .tba-light {
  position: absolute;
  top: -150px;
  width: 520px;
  height: 340px;
  margin-left: -260px;
  background: radial-gradient(closest-side, #ffffff0d, #ffffff05 55%, transparent);
  pointer-events: none;
}
#homev2 .tb-c-api .tba-lines {
  position: absolute;
  inset: 0;
  overflow: visible;
  fill: none;
  mask-image: radial-gradient(380px 180px at var(--cx) var(--cy), #000 30%, #0008 72%, transparent);
}
#homev2 .tb-c-api .tba-lines path {
  stroke: #ffffff17;
  stroke-width: 1;
  transition: stroke 300ms ease-out;
}
#homev2 .tb-c-api .tba-lines path.tba-on {
  stroke: #89b4fa59;
  transition-duration: 160ms;
}
#homev2 .cell.tb-c-api .tba-plate {
  --c: 22px;
  width: 164px;
  height: 67px;
}
#homev2 .tb-c-api .tba-tile,
#homev2 .tb-c-api .tba-key {
  position: absolute;
  top: 0;
  left: 0;
  display: grid;
  place-items: center;
  color: #9399b2;
}
#homev2 .tb-c-api .tba-tile {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: linear-gradient(to bottom right, #ffffff0d, transparent 65%), #222233;
  box-shadow:
    inset 0 1px 0 #ffffff0d,
    inset 0 0 0 1px #ffffff0f,
    0 0 0 3px #11111b80,
    0 2px 4px #00000040,
    0 8px 16px -6px #00000066;
  transition: color 400ms ease-out;
}
#homev2 .tb-c-api .tba-tile.tba-on {
  color: #bac2de;
  transition-duration: 160ms;
}
#homev2 .tb-c-api .tba-key {
  width: 76px;
  height: 76px;
  border-radius: 18px;
  color: #7f849c;
  background: linear-gradient(to bottom right, #ffffff12, transparent 65%), #262638;
  box-shadow:
    inset 0 1px 0 #ffffff12,
    inset 0 0 0 1px #ffffff0f,
    0 0 0 4px #11111b80,
    0 1px 2px #00000052,
    0 6px 12px -4px #00000052,
    0 20px 36px -12px #0000008c;
}
#homev2 .tb-c-api .tba-key::before {
  content: "";
  position: absolute;
  inset: 6px;
  border-radius: 10px;
  background: linear-gradient(to bottom, #ffffff08, transparent);
  box-shadow: inset 0 0 0 1px #ffffff0a;
}
#homev2 .tb-c-api .tba-cap {
  position: relative;
  width: 40px;
  height: 40px;
  filter: grayscale(1) brightness(0.75) contrast(0.9);
  transition: filter 300ms ease-out;
}
#homev2 .tb-c-api .tba-seam {
  fill: none;
  stroke: #262638;
  stroke-width: 1;
  stroke-linecap: round;
}
#homev2 .tb-c-api .tba-tick {
  position: absolute;
  top: -7px;
  right: -7px;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #1a1a29;
  box-shadow:
    inset 0 0 0 1px #89b4fa66,
    0 0 0 3px #11111b80;
  opacity: 0;
  transform: scale(0.6);
  filter: blur(2px);
  transition:
    opacity 240ms ease-out,
    transform 240ms ease-out,
    filter 240ms ease-out;
}
#homev2 .tb-c-api .tba-tick path {
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
#homev2 .tb-c-api .tba-dot {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 6px 1px #89b4fa80;
  opacity: 0;
  offset-rotate: 0deg;
  pointer-events: none;
}
#homev2 .tb-c-api [data-lit="true"] .tba-cap {
  filter: drop-shadow(0 0 8px #89b4fa66);
  transition-duration: 520ms;
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}
#homev2 .tb-c-api [data-lit="true"] .tba-seam {
  stroke: #3a4a6a;
}
#homev2 .tb-c-api [data-lit="true"] .tba-tick {
  opacity: 1;
  transform: none;
  filter: blur(0);
  transition-duration: 480ms;
  transition-timing-function: cubic-bezier(0.23, 1, 0.32, 1);
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .tb-c-api :is(.tba-cap, .tba-tick, .tba-tile, .tba-lines path) {
    transition: none;
  }
}
</style>
