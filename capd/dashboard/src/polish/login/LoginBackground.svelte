<script>
import {
  Button,
  Icon,
  Row,
  Segmented,
  Spinner,
  toast,
} from "../../components/cap/index.js";
import { api, url } from "../../lib/api.js";
import { bytes } from "../../lib/format.js";
import { undoable } from "../../lib/ui.svelte.js";
import { fieldLines } from "./field.js";
import { inkForColor, inkOver } from "./ink.js";
import MiniLogin from "./MiniLogin.svelte";
import { prepareImage } from "./prepareImage.js";

const HEX = /^#[0-9a-f]{6}$/i;

const normalize = (value) => {
  const hex = value.trim().toLowerCase().replace(/^#?/, "#");
  return /^#[0-9a-f]{3}$/.test(hex)
    ? `#${[...hex.slice(1)].map((c) => c + c).join("")}`
    : hex;
};

let settings = $state({ mode: "default", color: null, image: null });
let selected = $state("default");
let colorDraft = $state("#16324f");
let localSrc = $state(null);
let uploading = $state(false);
let dragging = $state(false);
let picker = $state(null);
let touched = $state(false);
let dims = $state(null);
let colorInvalid = $state(false);
let imageInk = $state(null);
let focus = $state([50, 50]);
let aiming = $state(false);
let previewImage = null;
let focusTimer;
let removal = null;

const imageSrc = $derived(
  localSrc ??
    (settings.image
      ? url(`login-background?v=${encodeURIComponent(settings.image.etag)}`)
      : null),
);
const shown = $derived(
  selected === "image" && settings.image
    ? "image"
    : selected === "color" && HEX.test(normalize(colorDraft))
      ? "color"
      : selected === "image"
        ? "empty"
        : "default",
);

const previewInk = $derived(
  shown === "image"
    ? imageInk
    : shown === "color"
      ? inkForColor(normalize(colorDraft))
      : null,
);

const apply = (next) => {
  settings = {
    mode: next.mode,
    color: next.color ?? null,
    image: next.image ?? null,
  };
  selected = settings.mode;
  if (settings.color) colorDraft = settings.color;
  if (!aiming) focus = settings.image?.focus ?? [50, 50];
};

const clamp = (n) => Math.min(100, Math.max(0, Math.round(n)));

const pointAt = (e) => {
  const box = e.currentTarget.getBoundingClientRect();
  return [
    clamp(((e.clientX - box.left) / box.width) * 100),
    clamp(((e.clientY - box.top) / box.height) * 100),
  ];
};

const measure = (img) => {
  previewImage = img;
  dims = [img.naturalWidth, img.naturalHeight];
  imageInk = inkOver(img, 1440, 900, focus);
};

const saveFocus = async () => {
  clearTimeout(focusTimer);
  if (previewImage) imageInk = inkOver(previewImage, 1440, 900, focus);
  const saved = settings.image?.focus ?? [50, 50];
  if (saved[0] === focus[0] && saved[1] === focus[1]) return;
  const res = await api("PUT", "/settings/login-background", {
    mode: "image",
    focus: $state.snapshot(focus),
  });
  if (!res?.success) {
    toast.error(res?.error || "Couldn't save the focus point");
    focus = saved;
    return;
  }
  apply(res);
};

const nudge = (e) => {
  const step = e.shiftKey ? 10 : 2;
  const move = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }[e.key];
  if (!move) return;
  e.preventDefault();
  focus = [clamp(focus[0] + move[0]), clamp(focus[1] + move[1])];
  clearTimeout(focusTimer);
  focusTimer = setTimeout(saveFocus, 500);
};

api("GET", "/settings/login-background").then((res) => {
  if (res?.mode) apply(res);
});

const put = async (body) => {
  const res = await api("PUT", "/settings/login-background", body);
  if (!res?.success) {
    toast.error(res?.error || "Couldn't save the sign-in background");
    selected = settings.mode;
    return false;
  }
  apply(res);
  return true;
};

const changeMode = async (mode) => {
  touched = true;
  const before = { mode: settings.mode, color: settings.color };
  if (mode === "image" && !settings.image) return;
  const ok = await put(
    mode === "color" ? { mode, color: normalize(colorDraft) } : { mode },
  );
  if (!ok) return;
  toast.success("Sign-in background updated", {
    action: {
      label: "Undo",
      run: () =>
        put(
          before.mode === "color"
            ? { mode: "color", color: before.color }
            : { mode: before.mode },
        ),
    },
  });
};

const saveColor = async () => {
  const color = normalize(colorDraft);
  colorInvalid = !HEX.test(color);
  if (colorInvalid) return;
  colorDraft = color;
  if (color === settings.color) return;
  const before = settings.color;
  if (!(await put({ mode: "color", color }))) return;
  toast.success("Color saved", {
    action: {
      label: "Undo",
      run: () => before && put({ mode: "color", color: before }),
    },
  });
};

const upload = async (file) => {
  if (!file || uploading) return;
  if (removal) toast.dismiss(removal);
  removal = null;
  uploading = true;
  touched = true;
  const prepared = await prepareImage(file);
  if (prepared.error) {
    uploading = false;
    toast.error(prepared.error);
    return;
  }
  const data = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(prepared.blob);
  });
  const res = data
    ? await api("PUT", "/settings/login-background/image", { data })
    : { error: "That file couldn't be read." };
  uploading = false;
  if (!res?.success) {
    toast.error(res?.error || "Couldn't upload the image");
    return;
  }
  if (localSrc) URL.revokeObjectURL(localSrc);
  localSrc = URL.createObjectURL(prepared.blob);
  apply(res);
  toast.success("Image uploaded");
};

const remove = () => {
  const before = $state.snapshot(settings);
  const src = localSrc;
  settings = {
    ...settings,
    image: null,
    mode: settings.mode === "image" ? "default" : settings.mode,
  };
  selected = settings.mode;
  localSrc = null;
  removal = undoable({
    message: "Image removed",
    commit: async () => {
      const res = await api(
        "DELETE",
        `/settings/login-background/image?etag=${encodeURIComponent(before.image?.etag ?? "")}`,
      );
      if (!res?.success) return res?.error || "Couldn't remove the image";
      if (src) URL.revokeObjectURL(src);
    },
    undo: () => {
      localSrc = src;
      apply(before);
    },
  });
};

$effect(() => {
  if (selected !== "image") return;
  const paste = (e) => {
    if (e.target.closest?.("input, textarea, [contenteditable]")) return;
    const file = [...(e.clipboardData?.files ?? [])].find((f) =>
      f.type.startsWith("image/"),
    );
    if (!file) return;
    e.preventDefault();
    upload(file);
  };
  addEventListener("paste", paste);
  return () => removeEventListener("paste", paste);
});

const drop = (e) => {
  e.preventDefault();
  dragging = false;
  upload(e.dataTransfer?.files?.[0]);
};
</script>

{#snippet backdrop(vw, vh)}
  {#if shown === "image" && imageSrc}
    {#key imageSrc}
      <img class="layer absolute inset-0 size-full object-cover" style:object-position="{focus[0]}% {focus[1]}%" src={imageSrc} alt="" draggable="false" onload={(e) => vw === 1440 && measure(e.currentTarget)} />
    {/key}
    <div class="scrim absolute inset-0"></div>
  {:else if shown === "color"}
    <div class="layer absolute inset-0" style:background-color={normalize(colorDraft)}></div>
  {:else if shown === "default"}
    <svg class="layer field absolute inset-0 size-full" viewBox="0 0 1600 960" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      {#each fieldLines as d, i}
        <path class:strong={i % 5 === 2} {d} />
      {/each}
    </svg>
  {/if}
  {#if shown !== "empty"}
    <MiniLogin {vw} {vh} ink={previewInk} />
  {/if}
{/snippet}

<Row label="Sign-in background" help="Also shows behind the page where you approve MCP agents." wide>
  <Segmented
    class="self-start"
    label="Sign-in background"
    bind:value={selected}
    onchange={changeMode}
    options={[
      ["default", "Default"],
      ["color", "Color"],
      ["image", "Image"],
    ]}
  />

  <div class="flex flex-col gap-3">
    <div class="flex w-full max-w-[34rem] items-start gap-3">
      <div
        role="presentation"
        class:touched
        class:dragging
        class:focusable={shown === "image"}
        class:aiming
        class="preview relative aspect-[16/10] min-w-0 flex-[1.6_1_0] overflow-hidden rounded-lg bg-sidebar outline outline-1 -outline-offset-1 outline-foreground/10 [container-type:inline-size]"
        ondragover={(e) => {
          if (!e.dataTransfer?.types.includes("Files")) return;
          e.preventDefault();
          dragging = true;
        }}
        ondragleave={() => (dragging = false)}
        ondrop={drop}
        onpointerdown={(e) => {
          if (shown !== "image" || e.button !== 0) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          aiming = true;
          focus = pointAt(e);
        }}
        onpointermove={(e) => aiming && (focus = pointAt(e))}
        onpointerup={() => {
          if (!aiming) return;
          aiming = false;
          saveFocus();
        }}
        onpointercancel={() => (aiming = false)}
      >
        {@render backdrop(1440, 900)}
        {#if shown === "empty"}
          <button
            type="button"
            class="absolute inset-0 grid place-items-center rounded-[inherit] text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset [@media(hover:hover)]:hover:text-foreground"
            onclick={() => picker?.click()}
          >
            <span class="flex flex-col items-center gap-1.5">
              {#if uploading}
                <Spinner class="size-4" label="Uploading" />
              {:else}
                <Icon name="plus" size={16} />
              {/if}
              Drop, paste or browse an image
            </span>
          </button>
        {:else if shown === "image"}
          <button
            type="button"
            class="focus-dot absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none"
            class:aiming
            style:left="{focus[0]}%"
            style:top="{focus[1]}%"
            aria-label="Focus point, {focus[0]}% across and {focus[1]}% down"
            aria-describedby="login-bg-focus-help"
            onkeydown={nudge}
          ></button>
        {/if}
      </div>
      <div class="preview relative aspect-[390/844] min-w-0 flex-[0.462_1_0] overflow-hidden rounded-lg bg-sidebar outline outline-1 -outline-offset-1 outline-foreground/10 [container-type:inline-size]" class:touched aria-hidden="true">
        {#if shown !== "empty"}
          {@render backdrop(390, 844)}
        {/if}
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-2">
      {#if selected === "color"}
        <div class="flex items-center gap-2">
          <label class="swatch relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-lg outline outline-1 -outline-offset-1 outline-foreground/15 focus-within:ring-2 focus-within:ring-ring/50" style:background-color={HEX.test(normalize(colorDraft)) ? normalize(colorDraft) : "transparent"}>
            <span class="sr-only">Pick a color</span>
            <input class="absolute inset-0 size-full cursor-pointer opacity-0" type="color" bind:value={colorDraft} onchange={saveColor} />
          </label>
          <input
            class="h-9 w-28 rounded-lg border border-input bg-transparent px-3 text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30"
            aria-label="Hex color"
            spellcheck="false"
            autocomplete="off"
            maxlength="7"
            bind:value={colorDraft}
            aria-invalid={colorInvalid ? "true" : undefined}
            aria-describedby={colorInvalid ? "login-bg-color-error" : undefined}
            oninput={() => (colorInvalid = false)}
            onchange={saveColor}
            onkeydown={(e) => e.key === "Enter" && saveColor()}
          />
        </div>
        {#if colorInvalid}
          <p id="login-bg-color-error" class="text-sm text-destructive">Use a hex color like #1d3b5a.</p>
        {/if}
      {:else if selected === "image"}
        <div class="flex flex-wrap items-center gap-2">
          <Button onclick={() => picker?.click()} aria-busy={uploading || undefined}>
            {#if uploading}<Spinner class="size-3.5" label="Uploading" />{/if}
            {settings.image ? "Replace image" : "Upload image"}
          </Button>
          {#if settings.image}
            <Button variant="danger-ghost" onclick={remove}>Remove</Button>
          {/if}
        </div>
        <div class="flex flex-col gap-0.5 text-sm text-pretty text-muted-foreground">
          {#if settings.image}
            <p>Drag the preview to choose what stays in view.<span id="login-bg-focus-help" class="sr-only"> On the focus point, arrow keys move it.</span></p>
            {#if dims}
              <p class="tabular-nums">{dims[0]} × {dims[1]}, {bytes(settings.image.size)}{dims[0] < 1600 ? ". May look soft on large screens." : ""}</p>
            {/if}
          {:else}
            <p>Photos are resized and stripped of metadata before upload.</p>
          {/if}
        </div>
      {/if}
      <input
        bind:this={picker}
        class="hidden"
        type="file"
        accept="image/*"
        onchange={(e) => {
          upload(e.currentTarget.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  </div>
</Row>

<style>
  .scrim {
    background: radial-gradient(
      ellipse 60% 70% at 50% 46%,
      color-mix(in oklab, var(--sidebar) 60%, transparent),
      color-mix(in oklab, var(--sidebar) 16%, transparent)
    );
  }

  .field {
    mask-image: radial-gradient(ellipse 75% 70% at 50% 50%, #000 25%, transparent 100%);
  }

  .field path {
    stroke: color-mix(in oklab, var(--foreground) 9%, transparent);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .field path.strong {
    stroke: color-mix(in oklab, var(--foreground) 15%, transparent);
  }

  .preview.focusable {
    cursor: crosshair;
    touch-action: none;
  }

  .focus-dot {
    background: rgb(255 255 255 / 0.25);
    box-shadow:
      0 0 0 2px #fff,
      0 0 0 3px rgb(0 0 0 / 0.35),
      0 1px 4px rgb(0 0 0 / 0.4);
  }

  .focus-dot:focus-visible {
    box-shadow:
      0 0 0 2px #fff,
      0 0 0 5px var(--ring);
  }

  .preview.aiming :global(.mini) {
    opacity: 0.2;
  }

  .preview.dragging {
    outline-color: var(--ring);
  }

  @media (prefers-reduced-motion: no-preference) {
    .touched .layer {
      animation: layer-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }

    .preview {
      transition: outline-color 150ms ease-out;
    }

    .focus-dot {
      transition: scale 160ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .preview :global(.mini) {
      transition: opacity 200ms ease-out;
    }

    .focus-dot.aiming {
      scale: 1.25;
    }
  }

  @keyframes layer-in {
    from {
      opacity: 0;
    }
  }
</style>
