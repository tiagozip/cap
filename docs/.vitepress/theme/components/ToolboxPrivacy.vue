<script setup>
defineProps({ t: { type: Object, required: true }, lp: { type: String, default: "" } });
</script>

<template>
  <article class="cell tb-c-priv">
    <div class="tb-art pv-art" aria-hidden="true">
      <div class="tb-plate pv-plate"></div>
      <div class="pv-slot"><span>Set-Cookie</span> none</div>
      <div class="pv-disc">
        <svg class="pv-ring" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" pathLength="1" /></svg>
        <div class="pv-well">
          <svg class="pv-eye" viewBox="0 0 24 24">
            <path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" />
            <circle cx="12" cy="12" r="3" />
            <path class="pv-slash" d="M4 4l16 16" />
          </svg>
        </div>
      </div>
    </div>
    <div class="tb-copy">
      <h3>{{ t.cellPrivacyTitle }}</h3>
      <p>{{ t.cellPrivacyBody }}</p>
      <a class="text-link small" :href="`${lp}/guide/compliance.html`" data-cta="compliance" data-cta-location="home">{{ t.ftCompliance }}</a>
    </div>
  </article>
</template>

<style>
#homev2 .cell.tb-c-priv .pv-art::before {
  content: "";
  position: absolute;
  inset: -60px 10% auto;
  height: 240px;
  background: radial-gradient(ellipse 50% 60% at 50% 0%, #ffffff0c, transparent 70%);
  pointer-events: none;
}
#homev2 .cell.tb-c-priv .pv-plate {
  --c: 26px;
  top: 74px;
  left: 28px;
  right: 28px;
  bottom: 0;
  mask: linear-gradient(#000 55%, transparent);
}
#homev2 .cell.tb-c-priv .pv-slot {
  position: absolute;
  top: 132px;
  left: calc(50% - 98px);
  width: 196px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border-radius: 8px;
  background: #161622;
  box-shadow:
    inset 0 1px 2px #00000059,
    inset 0 0 0 1px #ffffff08,
    0 1px 0 #ffffff08;
  font: 11.5px/1 var(--font-code);
  color: #585b70;
  transition: color 400ms var(--tb-ease);
}
#homev2 .cell.tb-c-priv .pv-slot span {
  color: #6c7086;
}
#homev2 .cell.tb-c-priv .pv-disc {
  position: absolute;
  top: 28px;
  left: calc(50% - 46px);
  width: 92px;
  height: 92px;
  padding: 7px;
  border-radius: 50%;
  background: #11111b;
  box-shadow:
    0 0 0 1px #ffffff0a,
    0 2px 4px #00000040,
    0 8px 14px -6px #0000004d;
}
#homev2 .cell.tb-c-priv .pv-ring {
  position: absolute;
  inset: -1px;
  width: calc(100% + 2px);
  height: calc(100% + 2px);
  rotate: -90deg;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.2;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  transition: stroke-dashoffset 300ms ease-in;
}
#homev2 .cell.tb-c-priv .pv-well {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background:
    linear-gradient(to bottom right, #ffffff0f, transparent 65%),
    #232335;
  box-shadow:
    inset 0 1px 0 #ffffff14,
    inset 0 -1px 0 #00000040;
}
#homev2 .cell.tb-c-priv .pv-eye {
  width: 30px;
  height: 30px;
  fill: none;
  stroke: #7f849c;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition:
    stroke 400ms var(--tb-ease),
    filter 400ms var(--tb-ease);
}
#homev2 .cell.tb-c-priv .pv-slash {
  stroke: #9399b2;
  stroke-width: 1.8;
}
@media (hover: hover) {
  #homev2 .cell.tb-c-priv:hover .pv-ring {
    stroke-dashoffset: 0;
    transition: stroke-dashoffset 700ms var(--tb-ease);
  }
  #homev2 .cell.tb-c-priv:hover .pv-eye,
  #homev2 .cell.tb-c-priv:hover .pv-slash {
    stroke: var(--accent);
    filter: drop-shadow(0 0 6px #89b4fa80);
  }
  #homev2 .cell.tb-c-priv:hover .pv-slot {
    color: var(--success, #a6e3a1);
  }
}
@media (prefers-reduced-motion: reduce) {
  #homev2 .cell.tb-c-priv :is(.pv-ring, .pv-eye, .pv-slot) {
    transition: none;
  }
}
</style>
