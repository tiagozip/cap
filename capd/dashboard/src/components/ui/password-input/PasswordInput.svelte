<script>
import { flushSync } from "svelte";
import { cn } from "../../../lib/utils.js";
import InputGroup from "../input-group/InputGroup.svelte";
import InputGroupAddon from "../input-group/InputGroupAddon.svelte";
import InputGroupButton from "../input-group/InputGroupButton.svelte";
import InputGroupInput from "../input-group/InputGroupInput.svelte";
import PasswordEye from "./PasswordEye.svelte";

let {
  class: className,
  strength = false,
  value = $bindable(""),
  ref = $bindable(null),
  ...rest
} = $props();

let visible = $state(false);
let revealed = $state(false);
let hiding = null;

const easeOut = "cubic-bezier(0.23, 1, 0.32, 1)";
const reduced = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const score = $derived.by(() => {
  if (!value) return 0;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) =>
    pattern.test(value),
  ).length;
  if (value.length < 8 || classes < 2) return 1;
  if (value.length < 12 || classes < 3) return 2;
  return 3;
});

const toggle = () => {
  const input = ref;
  const next = !revealed;
  revealed = next;
  const pending = hiding;
  hiding = null;
  if (pending) {
    pending.reverse();
    return;
  }
  if (!input) {
    visible = next;
    return;
  }
  for (const animation of input.getAnimations()) animation.cancel();
  if (next) {
    visible = true;
    if (reduced()) return;
    const rtl = getComputedStyle(input).direction === "rtl";
    const mask = {
      maskImage: `linear-gradient(${rtl ? 260 : 100}deg, #000 35%, rgb(0 0 0 / 0.4) 65%)`,
      maskSize: "250% 100%",
    };
    input.animate(
      [
        { ...mask, maskPosition: rtl ? "10% 0%" : "90% 0%" },
        { ...mask, maskPosition: rtl ? "100% 0%" : "0% 0%" },
      ],
      { duration: 560, easing: "cubic-bezier(0.25, 0.15, 0.4, 1)" },
    );
    input.animate(
      [
        { opacity: 0.8, filter: "blur(2px)" },
        { opacity: 1, filter: "blur(0px)" },
      ],
      { duration: 280, easing: easeOut },
    );
    return;
  }
  if (reduced()) {
    visible = false;
    return;
  }
  const animation = input.animate(
    [
      { opacity: 1, filter: "blur(0px)" },
      { opacity: 0, filter: "blur(2px)" },
    ],
    { duration: 120, easing: "ease-out", fill: "forwards" },
  );
  hiding = animation;
  animation.finished.then(
    () => {
      if (hiding !== animation) return;
      hiding = null;
      flushSync(() => {
        visible = false;
      });
      input.animate(
        [
          { opacity: 0, filter: "blur(2px)" },
          { opacity: 1, filter: "blur(0px)" },
        ],
        { duration: 200, easing: easeOut },
      );
      animation.cancel();
    },
    () => {},
  );
};
</script>

{#snippet group()}
  <InputGroup class={strength ? undefined : className}>
    <InputGroupInput bind:ref bind:value type={visible ? "text" : "password"} {...rest} />
    <InputGroupAddon align="inline-end">
      <InputGroupButton size="icon-xs" aria-label={revealed ? "Hide password" : "Show password"} onclick={toggle}>
        <PasswordEye {revealed} />
      </InputGroupButton>
    </InputGroupAddon>
  </InputGroup>
{/snippet}

{#if strength}
  <div class={cn("grid gap-2", className)}>
    {@render group()}
    <div class="flex items-center gap-1">
      {#each [0, 1, 2] as segment (segment)}
        <div
          class={cn(
            "h-1 flex-1 rounded-full transition-colors duration-300 ease-out",
            segment < score ? ["", "bg-red-500", "bg-amber-500", "bg-emerald-500"][score] : "bg-input",
          )}
        ></div>
      {/each}
      <p aria-live="polite" class="sr-only">{["", "Weak", "Fair", "Strong"][score]}</p>
    </div>
  </div>
{:else}
  {@render group()}
{/if}
