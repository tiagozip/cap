<script>
import { onMount } from "svelte";
import { Button, Icon } from "../../components/cap/index.js";
import { app } from "../../lib/state.svelte.js";

const LABELS = ["I'm a human", "Verifying...", "You're a human"];

let step = $state(0);
let invalid = $state(false);
let sent = $state(false);
let server = $state("idle");
let flowing = $state(false);
let show = $state({ hand: false, bot: false, token: false });
let pressed = $state({ hand: false, bot: false });
let ripples = $state([]);
let typed = $state(0);
let focused = $state(false);

let scene = $state();
let box = $state();
let field = $state();
let submit = $state();
let host = $state();
let hand = $state();
let bot = $state();
let token = $state();

onMount(() => {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    step = 2;
    sent = true;
    server = "ok";
    typed = 9;
    return;
  }

  let alive = true;
  let visible = true;
  const watcher = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  });
  watcher.observe(scene);

  const OFFSET = new Map([
    [hand, { x: 4, y: 3 }],
    [bot, { x: 4, y: 3 }],
    [token, { x: 14, y: 10 }],
  ]);
  const at = new Map();
  const put = (el, p) => {
    at.set(el, p);
    const o = OFFSET.get(el);
    el.style.translate = `${p.x - o.x}px ${p.y - o.y}px`;
  };

  const ready = () =>
    new Promise((go) => {
      const check = () => {
        if (!alive) return;
        if (visible && !document.hidden) go();
        else setTimeout(check, 250);
      };
      check();
    });
  const wait = (ms) =>
    new Promise((go, stop) =>
      setTimeout(() => (alive ? ready().then(go) : stop()), ms),
    );

  const inOut = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
  const out = (t) => 1 - (1 - t) ** 3;
  const accel = (t) => t ** 3;
  const settle = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;
  const linear = (t) => t;
  const snap = (t) => Math.round(t * 6) / 6;

  const tween = (ms, frame, easing) =>
    new Promise((go, stop) => {
      const start = performance.now();
      const tick = (now) => {
        if (!alive) return stop();
        const t = Math.min(1, (now - start) / ms);
        frame(easing(t));
        if (t < 1) requestAnimationFrame(tick);
        else go();
      };
      requestAnimationFrame(tick);
    });

  const fly = (el, to, ms, easing = inOut, curve = 0) => {
    const from = at.get(el) ?? to;
    const c = {
      x: (from.x + to.x) / 2 - (to.y - from.y) * curve,
      y: (from.y + to.y) / 2 + (to.x - from.x) * curve,
    };
    return tween(
      ms,
      (k) => {
        const u = 1 - k;
        put(el, {
          x: u * u * from.x + 2 * u * k * c.x + k * k * to.x,
          y: u * u * from.y + 2 * u * k * c.y + k * k * to.y,
        });
      },
      easing,
    );
  };

  const where = (el, dx = 0.5, dy = 0.5) => {
    const s = scene.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return {
      x: r.left - s.left + r.width * dx,
      y: r.top - s.top + r.height * dy,
    };
  };

  let rid = 0;
  const ripple = (p, bad = false) => {
    const id = ++rid;
    ripples = [...ripples, { id, bad, ...p }];
    setTimeout(() => {
      ripples = ripples.filter((r) => r.id !== id);
    }, 700);
  };

  const press = async (who, p) => {
    pressed[who] = true;
    ripple(p, who === "bot");
    await wait(150);
    pressed[who] = false;
  };

  const run = async () => {
    const { width: w, height: h } = scene.getBoundingClientRect();

    const target = where(submit, 0.5, 0.5);
    put(bot, { x: w * 0.86, y: target.y - 96 });
    show.bot = true;
    await wait(240);
    await fly(bot, { x: w * 0.86, y: target.y }, 260, snap);
    await fly(bot, target, 300, linear);
    await press("bot", target);
    invalid = true;
    await wait(420);
    show.bot = false;
    await wait(260);
    invalid = false;
    await wait(600);

    put(hand, { x: w * 0.92, y: h + 30 });
    show.hand = true;
    const input = where(field, 0.22, 0.55);
    await fly(hand, input, 950, settle, 0.22);
    await wait(160);
    await press("hand", input);
    focused = true;
    await fly(hand, { x: input.x + 18, y: input.y + 16 }, 400, out);
    for (let i = 1; i <= 9; i++) {
      typed = i;
      await wait(55 + Math.random() * 70);
    }
    await wait(220);
    focused = false;
    const tick = where(box);
    await fly(hand, tick, 650, settle, -0.18);
    await wait(260);
    await press("hand", tick);
    step = 1;
    await fly(hand, { x: tick.x + 46, y: tick.y + 22 }, 700, out, -0.2);
    await wait(900);
    step = 2;
    await wait(550);

    const button = where(submit, 0.62, 0.55);
    await fly(hand, button, 720, settle, -0.14);
    await wait(180);
    await press("hand", button);
    sent = true;

    put(token, where(submit, 0.5, 1));
    show.token = true;
    await wait(220);
    flowing = true;
    const drop = where(host, 0.5, 0);
    await Promise.all([
      fly(token, drop, 820, inOut),
      fly(hand, { x: w + 40, y: button.y + 70 }, 900, accel, 0.1),
    ]);
    show.token = false;
    show.hand = false;
    flowing = false;
    server = "busy";
    await wait(650);
    server = "ok";
    await wait(2200);

    step = 0;
    typed = 0;
    sent = false;
    server = "idle";
    await wait(1100);
  };

  (async () => {
    await wait(700);
    while (alive) await run();
  })().catch(() => {});

  return () => {
    alive = false;
    watcher.disconnect();
  };
});
</script>

<div class="grid flex-1 place-items-center px-4 pt-6 pb-16">
  <div class="flex w-full max-w-[25rem] flex-col items-center gap-7">
    <div bind:this={scene} class="scene relative w-full overflow-hidden p-4" aria-hidden="true">
      <div class="window overflow-hidden rounded-[20px] bg-muted">
        <div class="flex h-9 items-center gap-1.5 px-3.5">
          <span class="size-2 rounded-full bg-foreground/15"></span>
          <span class="size-2 rounded-full bg-foreground/15"></span>
          <span class="size-2 rounded-full bg-foreground/15"></span>
          <span class="mx-auto h-5 w-36 rounded-md bg-foreground/8"></span>
          <span class="w-9"></span>
        </div>

        <div class="flex flex-col gap-3.5 rounded-t-[14px] bg-background px-6 pt-6 pb-7 ring-1 ring-border">
          <div class="flex flex-col gap-2">
            <span class="h-2 w-12 rounded-full bg-foreground/15"></span>
            <span bind:this={field} class="field flex h-8 items-center gap-0.5 rounded-lg bg-muted/60 px-2.5 ring-1" class:focused>
            {#each { length: typed } as _, i}
              <span class="char size-[5px] rounded-full bg-foreground/55" class:gap={i === 3}></span>
            {/each}
            <span class="caret h-3.5 w-px bg-foreground" class:on={focused}></span>
          </span>
          </div>

          <div class="widget relative flex h-[52px] w-full items-center gap-3.5 overflow-hidden rounded-[13px] bg-card px-3 ring-1" class:invalid class:ok={step === 2}>
            <span bind:this={box} class="grid size-[22px] shrink-0 place-items-center">
              {#if step === 0}
                <span class="size-[22px] rounded-md border border-foreground/30 bg-muted/40"></span>
              {:else if step === 1}
                <span class="spinner size-[22px] rounded-full border-2 border-foreground/15 border-t-foreground"></span>
              {:else}
                <svg class="pop size-[22px] text-success" viewBox="0 0 24 24"><path class="check" d="m5 12 5 5L20 7" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" /></svg>
              {/if}
            </span>
            <span class="relative flex h-[2em] min-w-0 flex-1 items-center overflow-hidden text-sm font-medium">
              {#each LABELS as label, i}
                <span class="label absolute whitespace-nowrap" class:active={i === step} class:exit={i < step}>{label}</span>
              {/each}
            </span>
            <span class="absolute end-1.5 bottom-1.5 text-[11px] leading-none underline underline-offset-[0.18em] opacity-70">Cap</span>
          </div>

          <span bind:this={submit} class="submit relative grid h-8 place-items-center overflow-hidden rounded-lg text-[13px] font-medium" class:ready={step === 2} class:sent class:nope={invalid}>
            <span class="swap" class:gone={sent}>Sign up</span>
            <span class="swap absolute flex items-center gap-1.5" class:gone={!sent}><Icon name="check" size={13} />Signed up</span>
          </span>
        </div>
      </div>

      <svg class="mx-auto block h-11 w-px overflow-visible" viewBox="0 0 1 44" preserveAspectRatio="none">
        <line class="wire" class:flowing x1="0.5" y1="0" x2="0.5" y2="44" />
      </svg>

      <div bind:this={host} class="host mx-auto flex h-11 w-fit items-center gap-2.5 rounded-xl bg-card ps-3 pe-3.5 ring-1" class:ok={server === "ok"}>
        <Icon name="server" size={16} class="text-muted-foreground" />
        <span class="text-[13px] font-medium">Your server</span>
        <span class="grid size-4 place-items-center">
          {#if server === "busy"}
            <span class="spinner size-3.5 rounded-full border-[1.5px] border-foreground/15 border-t-foreground"></span>
          {:else if server === "ok"}
            <span class="pop grid size-4 place-items-center rounded-full bg-success text-background"><Icon name="check" size={10} /></span>
          {:else}
            <span class="size-1.5 rounded-full bg-foreground/25"></span>
          {/if}
        </span>
      </div>

      {#each ripples as r (r.id)}
        <span class="ripple pointer-events-none absolute top-0 left-0 size-7 rounded-full border {r.bad ? 'border-destructive' : 'border-foreground/40'}" style:translate="{r.x - 14}px {r.y - 14}px"></span>
      {/each}

      <span bind:this={token} class="token pointer-events-none absolute top-0 left-0 grid h-5 w-7 place-items-center rounded-md bg-foreground text-background" class:shown={show.token}>
        <Icon name="key" size={12} />
      </span>

      <span bind:this={bot} class="actor pointer-events-none absolute top-0 left-0" class:shown={show.bot}>
        <svg class="bot size-5 text-destructive" class:pressed={pressed.bot} viewBox="0 0 20 20">
          <path d="M4 2.5v13.2l3.4-3.1 2.3 5.1 2.3-1-2.3-5h4.6z" fill="currentColor" stroke="var(--background)" stroke-width="1.25" stroke-linejoin="round" />
        </svg>
      </span>

      <span bind:this={hand} class="actor pointer-events-none absolute top-0 left-0" class:shown={show.hand}>
        <svg class="hand size-5 text-foreground" class:pressed={pressed.hand} viewBox="0 0 20 20">
          <path d="M4 2.5v13.2l3.4-3.1 2.3 5.1 2.3-1-2.3-5h4.6z" fill="currentColor" stroke="var(--background)" stroke-width="1.25" stroke-linejoin="round" />
        </svg>
      </span>
    </div>

    <div class="flex flex-col items-center gap-6">
      <div class="intro flex flex-col items-center gap-1.5 text-center">
        <h2 class="text-lg font-semibold text-balance">Protect your first form</h2>
        <p class="max-w-xs text-sm text-pretty text-muted-foreground">Create a site key, add the widget to your form, then check each token on your server.</p>
      </div>

      <div class="intro later flex flex-wrap justify-center gap-2">
        <Button variant="primary" onclick={() => (app.createKeyOpen = true)}>
          <Icon name="plus" size={14} />
          Create site key
        </Button>
        <Button href="https://trycap.dev/guide/capd/" target="_blank" rel="noopener">
          Read the guide
          <Icon name="external" size={14} />
        </Button>
      </div>
    </div>
  </div>
</div>

<style>
  .widget,
  .host {
    --tw-ring-color: var(--border);
  }

  .field {
    --tw-ring-color: var(--border);
  }

  .field.focused {
    --tw-ring-color: color-mix(in oklab, var(--foreground) 35%, transparent);
  }

  .char.gap {
    margin-inline-end: 4px;
  }

  .caret {
    opacity: 0;
  }

  .caret.on {
    opacity: 1;
  }

  .window {
    box-shadow:
      0 0 0 1px var(--border),
      0 1px 2px rgb(0 0 0 / 0.04),
      0 4px 10px -4px rgb(0 0 0 / 0.08),
      0 10px 16px -8px rgb(0 0 0 / 0.1);
  }

  .widget.invalid {
    --tw-ring-color: var(--destructive);
  }

  .widget.ok {
    --tw-ring-color: color-mix(in oklab, var(--success) 45%, transparent);
  }

  .host.ok {
    --tw-ring-color: color-mix(in oklab, var(--success) 55%, transparent);
  }

  .label {
    opacity: 0;
    translate: 0 100%;
    filter: blur(2px);
  }

  .label.active {
    opacity: 1;
    translate: 0 0;
    filter: none;
  }

  .label.exit {
    translate: 0 -100%;
  }

  .submit {
    background-color: color-mix(in oklab, var(--foreground) 8%, transparent);
    color: var(--muted-foreground);
  }

  .submit.ready {
    background-color: var(--primary);
    color: var(--primary-foreground);
  }

  .swap.gone {
    opacity: 0;
    translate: 0 6px;
    filter: blur(2px);
  }

  .wire {
    stroke: color-mix(in oklab, var(--foreground) 22%, transparent);
    stroke-width: 1.5;
    stroke-dasharray: 3 4;
    vector-effect: non-scaling-stroke;
  }

  .actor,
  .token {
    opacity: 0;
    will-change: translate;
  }

  .actor.shown,
  .token.shown {
    opacity: 1;
  }

  @media (prefers-reduced-motion: no-preference) {
    .scene,
    .intro {
      animation: rise 700ms var(--ease-out) both;
    }

    .intro {
      animation-delay: 90ms;
    }

    .intro.later {
      animation-delay: 160ms;
    }

    .widget,
    .host,
    .field {
      transition: box-shadow 250ms ease;
    }

    .widget.invalid {
      animation: shake 500ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
    }

    .label {
      transition:
        translate 500ms cubic-bezier(0.25, 1, 0.5, 1),
        opacity 500ms ease,
        filter 500ms ease;
    }

    .spinner {
      animation: spin 700ms linear infinite;
    }

    .char {
      animation: pop 160ms ease-out both;
    }

    .caret.on {
      animation: caret 1s steps(1) infinite;
    }

    .pop {
      animation: pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
    }

    .check {
      stroke-dasharray: 23.22;
      animation: draw 420ms 80ms ease-out both;
    }

    .submit {
      transition:
        background-color 300ms ease 120ms,
        color 300ms ease 120ms;
    }

    .submit.sent {
      animation: press 240ms ease-out;
    }

    .submit.nope {
      animation: nope 360ms ease-out;
    }

    .swap {
      transition:
        opacity 260ms ease,
        translate 260ms cubic-bezier(0.25, 1, 0.5, 1),
        filter 260ms ease;
    }

    .wire.flowing {
      stroke: color-mix(in oklab, var(--foreground) 45%, transparent);
      animation: flow 500ms linear infinite;
    }

    .actor {
      transition:
        opacity 220ms ease,
        filter 220ms ease;
    }

    .actor:not(.shown) {
      filter: blur(2px);
    }

    .token {
      transition:
        opacity 180ms ease,
        scale 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
      scale: 0.4;
    }

    .token.shown {
      scale: 1;
    }

    .hand,
    .bot {
      transition: scale 140ms ease-out;
      transform-origin: 20% 15%;
    }

    .hand.pressed,
    .bot.pressed {
      scale: 0.82;
    }

    .ripple {
      animation: ripple 600ms cubic-bezier(0.25, 1, 0.5, 1) forwards;
    }

    .host.ok {
      animation: glow 700ms ease-out;
    }
  }

  @keyframes rise {
    from {
      opacity: 0;
      translate: 0 12px;
    }
  }

  @keyframes shake {
    10%,
    90% {
      translate: -1px 0;
    }
    20%,
    80% {
      translate: 2px 0;
    }
    30%,
    50%,
    70% {
      translate: -4px 0;
    }
    40%,
    60% {
      translate: 4px 0;
    }
  }

  @keyframes caret {
    50% {
      opacity: 0;
    }
  }

  @keyframes spin {
    to {
      rotate: 360deg;
    }
  }

  @keyframes pop {
    from {
      scale: 0.3;
      opacity: 0;
    }
  }

  @keyframes draw {
    from {
      stroke-dashoffset: 23.22;
    }
    to {
      stroke-dashoffset: 0;
    }
  }

  @keyframes press {
    50% {
      scale: 0.96;
    }
  }

  @keyframes nope {
    40% {
      scale: 0.97;
    }
  }

  @keyframes flow {
    to {
      stroke-dashoffset: -7;
    }
  }

  @keyframes ripple {
    from {
      scale: 0.3;
      opacity: 1;
    }
    to {
      scale: 1.5;
      opacity: 0;
    }
  }

  @keyframes glow {
    from {
      scale: 1.04;
    }
  }
</style>
