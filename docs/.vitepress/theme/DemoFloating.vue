<style>
  .demo-button {
    background-color: var(--vp-c-brand-1);
    color: var(--vp-c-bg);
    padding: 5px 13px;
    border: none;
    border-radius: 8px;
    font-size: .85rem;
    cursor: pointer;
  }
  .demo-button:hover {
    opacity: .8;
  }
</style>
<template>
  <cap-widget id="floating" onsolve="alert(`Verification token: ${event.detail.token}`)"></cap-widget>

  <button data-cap-floating="#floating" data-cap-floating-offset="8" data-cap-floating-position="bottom" class="demo-button">Trigger Floating</button>
</template>