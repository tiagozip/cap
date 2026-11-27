<script>
import { onMount } from "svelte";
import Button from "../../components/cap/Button.svelte";
import NotchFilter from "../../components/cap/NotchFilter.svelte";
import { PasswordInput } from "../../components/ui/password-input/index.js";
import { Spinner } from "../../components/ui/spinner/index.js";
import { url } from "../../lib/api.js";
import LoginAbout from "./LoginAbout.svelte";
import LoginBackdrop from "./LoginBackdrop.svelte";

let key = $state("");
let error = $state("");
let busy = $state(false);
let input = $state(null);
let field = $state(null);

let proxyOnly = $state(false);
let checking = $state(true);
let slow = $state(false);
let custom = $state(false);
let ink = $state(null);
let photo = $state(false);
let leaving = $state(false);
let shownError = $state("");
let attempt = $state(0);
let caps = $state(false);

const capsCheck = (e) => {
  caps = e.getModifierState?.("CapsLock") ?? false;
};

const keep = (data) => {
  try {
    localStorage.setItem(
      "cap_auth",
      JSON.stringify({
        token: data.session_token,
        expires: data.expires,
        hash: data.hashed_token,
      }),
    );
  } catch {
    return false;
  }
  leaving = true;
  const motion = matchMedia("(prefers-reduced-motion: no-preference)").matches;
  setTimeout(() => location.reload(), motion ? 400 : 0);
  return true;
};

onMount(async () => {
  const wait = setTimeout(() => {
    slow = true;
  }, 400);
  try {
    const res = await fetch(url("auth/proxy"), { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.session_token && keep(data)) return;
    proxyOnly = data?.mode === "require";
  } catch {}
  clearTimeout(wait);
  checking = false;
  queueMicrotask(() => input?.focus());
});

$effect(() => {
  const root = document.documentElement;
  root.dataset.login = "";
  return () => delete root.dataset.login;
});

const fail = (message, clear = false) => {
  busy = false;
  error = message;
  shownError = message;
  attempt++;
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    field?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(3px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(1px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 320, easing: "cubic-bezier(0.36, 0.07, 0.19, 0.97)" },
    );
  if (clear) key = "";
  input?.focus();
};

const submit = async (e) => {
  e.preventDefault();
  if (busy) return;
  if (!key) return fail("Enter your admin key to sign in.");

  busy = true;

  let res;
  let data;
  try {
    res = await fetch(url("auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_key: key }),
    });
    data = await res.json().catch(() => ({}));
  } catch {
    return fail(
      "Couldn't reach the server. Check your connection and try again.",
    );
  }

  if (res.status === 429)
    return fail(
      "You've tried too many times. Wait a few seconds, then try again.",
    );

  if (!data?.success || !data.session_token)
    return fail("That admin key isn't right. Check it and try again.", true);

  if (!keep(data))
    fail(
      "Your browser blocked storage for this site, so you can't stay signed in. Allow site data, then try again.",
    );
};
</script>

<NotchFilter />

<main data-custom={custom ? "" : undefined} class="login-page relative isolate grid min-h-dvh justify-items-center bg-sidebar px-4 py-10">
  <LoginBackdrop bind:custom bind:ink bind:photo />
  <div class:leaving class="login-enter row-span-3 grid w-full max-w-[23rem] grid-rows-subgrid">
    <div class="login-card row-start-2 overflow-hidden rounded-xl border border-border bg-background">
      <div class="notch-shadow flex h-11 items-stretch">
        <a class="relative flex items-center gap-2 rounded-tl-[11px] bg-sidebar ps-4 pe-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset" href="https://trycap.dev" target="_blank" rel="noopener" referrerpolicy="origin" aria-label="Cap website">
          <img src="./public/logo-small.webp" alt="" width="22" height="22" class="size-[22px]" />
          <span class="text-[15px] font-medium">Cap</span>
          <span class="absolute start-0 end-0 bottom-0 h-px bg-border"></span>
        </a>
        <svg class="h-11 w-7 shrink-0" viewBox="0 0 28 44" aria-hidden="true"><path fill="var(--sidebar)" d="M0 0H28C21.5 0 18.6 3 17.6 8.4L14 35.6C13 41 10 44 4 44H0Z" /><path fill="none" stroke="var(--border)" d="M28 -1C21.8-1 19.1 3 18.1 8.5L14.5 35.5C13.5 40.8 10.3 43.5 4 43.5H0" /></svg>
        <div class="flex-1"></div>
      </div>

      {#if checking}
        <div class="flex min-h-[13.875rem] items-center justify-center px-5 py-5">
          {#if slow}<span class="spinner-in"><Spinner class="size-5" label="Checking sign-in" /></span>{/if}
        </div>
      {:else if proxyOnly}
        <div class="flex flex-col gap-4 px-5 pt-5 pb-5">
          <span class="grid size-10 place-items-center rounded-[10px] bg-sidebar text-muted-foreground ring-1 ring-border">
            <svg class="size-5" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M208,40H48A16,16,0,0,0,32,56v56c0,52.72,25.52,84.67,46.93,102.19,23.06,18.86,46,25.26,47,25.53a8,8,0,0,0,4.2,0c1-.27,23.91-6.67,47-25.53C198.48,196.67,224,164.72,224,112V56A16,16,0,0,0,208,40Zm0,72c0,37.07-13.66,67.16-40.6,89.42A129.3,129.3,0,0,1,128,223.62a128.25,128.25,0,0,1-38.92-21.81C61.82,179.51,48,149.3,48,112l0-56,160,0ZM82.34,141.66a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32l-56,56a8,8,0,0,1-11.32,0Z" /></svg>
          </span>
          <div class="flex flex-col gap-1.5">
            <h1 class="text-base font-semibold text-balance">Sign in through your proxy</h1>
            <p class="text-sm leading-relaxed text-pretty text-muted-foreground">This server only lets people in through its sign-in proxy. Open the dashboard from your proxy's address and you'll be signed in on your own.</p>
          </div>
        </div>
      {:else}
      <form class="flex flex-col gap-5 px-5 pt-5 pb-5" novalidate onsubmit={submit}>
        <div class="flex flex-col gap-1">
          <h1 class="text-base font-semibold text-balance">Sign in</h1>
          <p class="text-sm text-pretty text-muted-foreground">Use your server's admin key to continue.</p>
        </div>

        <div class="flex flex-col">
          <label for="admin-key" class="pb-1.5 text-sm font-medium">Admin key</label>
          <div bind:this={field} role="presentation" onkeydown={capsCheck} onkeyup={capsCheck} onfocusout={() => (caps = false)}>
              <PasswordInput
                id="admin-key"
                name="password"
                autocomplete="current-password"
                autocapitalize="off"
                spellcheck="false"
                class="h-9"
                bind:ref={input}
                bind:value={key}
                oninput={() => (error = "")}
                aria-invalid={error ? "true" : undefined}
                aria-describedby={error ? "admin-key-error" : undefined}
              />
          </div>
          <div class="error-slot grid" data-open={caps && !error ? "" : undefined}>
            <div class="min-h-0 overflow-hidden">
              <p class="flex items-center gap-1.5 pt-1.5 text-sm text-muted-foreground" aria-live="polite">
                {#if caps && !error}<svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M12 3.5L4 11.5H8.5V16H15.5V11.5H20Z" /><path d="M8.5 20H15.5" /></svg>Caps Lock is on{/if}
              </p>
            </div>
          </div>
          <div class="error-slot grid" data-open={error ? "" : undefined}>
            <div class="min-h-0 overflow-hidden">
              {#key attempt}
                <p id="admin-key-error" class="pt-1.5 text-sm text-pretty text-destructive" role={error ? "alert" : undefined} aria-hidden={error ? undefined : "true"}>{shownError}</p>
              {/key}
            </div>
          </div>
        </div>

        <Button type="submit" variant="primary" class="w-full" aria-busy={busy || undefined}>
          {#if leaving}
            <svg class="signed-in size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5L10 17.5L19 7" pathLength="1" /></svg>
            Signed in
          {:else if busy}
            <Spinner class="size-4" label="Signing in" />
            Signing in
          {:else}
            Sign in
          {/if}
        </Button>
      </form>
      {/if}
    </div>

    <div class="row-start-3 h-0">
      <div class="flex flex-col gap-4 pt-4 pb-10">
        <LoginAbout />

        <nav data-ink={photo ? ink : undefined} class="flex items-center justify-between gap-3 px-1 text-[13px] {ink === 'light' ? 'text-white/75 [&_a]:[@media(hover:hover)]:hover:text-white' : ink === 'dark' ? 'text-black/65 [&_a]:[@media(hover:hover)]:hover:text-black' : 'text-muted-foreground'}" aria-label="Links">
          <a class="rounded-sm underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-foreground" href="https://trycap.dev/guide/capd/" target="_blank" rel="noopener">Docs</a>
          <a class="rounded-sm underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:hover:text-foreground" href="https://github.com/tiagozip/cap/issues/new/choose" target="_blank" rel="noopener">Report an issue</a>
        </nav>
      </div>
    </div>
  </div>
</main>

<style>
  :global(html[data-login]) {
    background: var(--sidebar);
  }

  .login-page {
    grid-template-rows: max(0px, calc((100dvh - 21.5rem) * 0.4)) auto 1fr;
  }

  .login-page[data-custom] .login-card {
    box-shadow:
      0 1px 2px rgb(0 0 0 / 0.06),
      0 6px 16px -4px rgb(0 0 0 / 0.12),
      0 24px 56px -12px rgb(0 0 0 / 0.22);
  }

  nav[data-ink="light"] {
    text-shadow: 0 1px 2px rgb(0 0 0 / 0.4);
  }

  nav[data-ink="dark"] {
    text-shadow: 0 0 8px rgb(255 255 255 / 0.6);
  }

  .error-slot {
    grid-template-rows: 0fr;
  }

  .error-slot[data-open] {
    grid-template-rows: 1fr;
  }

  .error-slot:not([data-open]) p {
    opacity: 0;
  }

  @media (prefers-reduced-motion: no-preference) {
    .spinner-in {
      animation: spinner-in 240ms ease-out both;
    }

    .signed-in path {
      stroke-dasharray: 1;
      animation: draw-check 180ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }


    .error-slot {
      transition: grid-template-rows 220ms cubic-bezier(0.22, 1, 0.36, 1);
    }

    .error-slot p {
      transition: opacity 160ms ease-out;
    }

    .login-enter.leaving {
      animation: login-leave 220ms 160ms cubic-bezier(0.4, 0, 1, 1) both;
    }
  }

  @keyframes draw-check {
    from {
      stroke-dashoffset: 1;
    }
  }

  @keyframes spinner-in {
    from {
      opacity: 0;
    }
  }

  @keyframes login-leave {
    to {
      opacity: 0;
      transform: scale(0.985);
      filter: blur(4px);
    }
  }

</style>
