<script setup>
defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });
</script>

<template>
  <article class="cell tb-c-size">
    <div class="tb-art sz-art" aria-hidden="true">
      <div class="tb-shelf sz-shelf"></div>
      <div class="tb-plate sz-plate"></div>
      <div class="sz-key">
        <span class="sz-num">20</span><span class="sz-unit">kB</span>
        <svg class="sz-check" viewBox="0 0 16 16"><path pathLength="1" d="M4 8.4l2.6 2.6L12 5.6" /></svg>
      </div>
      <div class="sz-track">
        <span class="sz-ghost"></span>
        <span class="sz-fill"></span>
        <span class="sz-mark sz-cap"><b>Cap</b></span>
        <span class="sz-mark sz-rc"><b>reCAPTCHA</b>500 kB</span>
      </div>
    </div>
    <div class="tb-copy">
      <h3>{{ t.cellSizeTitle }}</h3>
      <p>{{ t.cellSizeBody }}</p>
    </div>
  </article>
</template>

<style>
#homev2 .cell.tb-c-size .sz-art::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 112px;
  background:
    radial-gradient(ellipse 40% 90% at 50% 0%, #ffffff0b, transparent 70%),
    repeating-linear-gradient(-45deg, #ffffff0d 0 1px, transparent 1px 7px);
  mask: linear-gradient(transparent, #000 70%);
  pointer-events: none;
}
#homev2 .cell.tb-c-size .sz-shelf {
  top: 112px;
}
#homev2 .cell.tb-c-size .sz-plate {
  --c: 18px;
  top: 16px;
  left: calc(50% - 74px);
  width: 148px;
  height: 97px;
}
#homev2 .cell.tb-c-size .sz-key {
  position: absolute;
  top: 44px;
  left: calc(50% - 46px);
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 3px;
  width: 92px;
  height: 92px;
  padding-top: 30px;
  border-radius: 18px;
  background:
    linear-gradient(to bottom right, #ffffff10, transparent 60%),
    #26263a;
  box-shadow:
    inset 0 1px 0 #ffffff14,
    inset 0 0 0 1px #ffffff0d,
    inset 0 -3px 0 #0000002e,
    0 0 0 4px #11111b8c,
    0 2px 4px #00000040,
    0 8px 14px -6px #0000004d;
  font-family: Inter, var(--font-sans);
}
#homev2 .cell.tb-c-size .sz-num {
  font-family: "Departure Mono", var(--font-code);
  font-size: 26px;
  letter-spacing: -0.02em;
  color: var(--text);
  font-variant-numeric: tabular-nums;
}
#homev2 .cell.tb-c-size .sz-unit {
  font-size: 13px;
  color: #7f849c;
}
#homev2 .cell.tb-c-size .sz-check {
  position: absolute;
  top: 9px;
  right: 9px;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--success, #a6e3a1);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 200ms ease-in;
}
#homev2 .cell.tb-c-size .sz-track {
  position: absolute;
  top: 158px;
  left: 28px;
  right: -2px;
  height: 8px;
  border-radius: 4px 0 0 4px;
  background: #151521;
  box-shadow:
    inset 0 1px 2px #00000066,
    0 1px 0 #ffffff08;
}
#homev2 .cell.tb-c-size .sz-fill,
#homev2 .cell.tb-c-size .sz-ghost {
  position: absolute;
  inset: 1px auto 1px 1px;
  border-radius: 3px;
  transform-origin: left;
}
#homev2 .cell.tb-c-size .sz-fill {
  width: 10px;
  background: var(--success, #a6e3a1);
}
#homev2 .cell.tb-c-size .sz-ghost {
  width: 250px;
  background: repeating-linear-gradient(90deg, #45475a 0 6px, #3a3a50 6px 8px);
  opacity: 0.55;
}
#homev2 .cell.tb-c-size .sz-mark {
  position: absolute;
  top: 18px;
  display: flex;
  gap: 6px;
  font: 11px/1 Inter, var(--font-sans);
  color: #585b70;
  white-space: nowrap;
}
#homev2 .cell.tb-c-size .sz-mark b {
  font-weight: 500;
  color: #7f849c;
}
#homev2 .cell.tb-c-size .sz-mark::after {
  content: "";
  position: absolute;
  top: -18px;
  width: 1px;
  height: 14px;
}
#homev2 .cell.tb-c-size .sz-cap {
  left: 0;
}
#homev2 .cell.tb-c-size .sz-cap b {
  color: var(--text);
}
#homev2 .cell.tb-c-size .sz-rc {
  left: 250px;
  translate: -100% 0;
}
#homev2 .cell.tb-c-size .sz-rc::after {
  right: 0;
  background: #45475a;
}
@media (hover: hover) and (prefers-reduced-motion: no-preference) {
  #homev2 .cell.tb-c-size:hover .sz-ghost {
    animation: sz-load 2400ms cubic-bezier(0.3, 0.1, 0.3, 1) both;
  }
  #homev2 .cell.tb-c-size:hover .sz-fill {
    animation: sz-snap 160ms ease-out both;
  }
  #homev2 .cell.tb-c-size:hover .sz-check {
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 320ms var(--tb-ease) 160ms;
  }
}
@keyframes sz-load {
  from {
    transform: scaleX(0.02);
  }
  to {
    transform: none;
  }
}
@keyframes sz-snap {
  from {
    transform: scaleX(0);
  }
  to {
    transform: none;
  }
}
</style>
