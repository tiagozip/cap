<script>
import { onMount } from "svelte";
import { Button, Icon, Spinner } from "../../components/cap/index.js";
import NotchFilter from "../../components/cap/NotchFilter.svelte";
import { PasswordInput } from "../../components/ui/index.js";
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
  location.reload();
  return true;
};

onMount(async () => {
  try {
    const res = await fetch(url("auth/proxy"), { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.session_token && keep(data)) return;
    proxyOnly = data?.mode === "require";
  } catch {}
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

  error = "";
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

<main class="login-page relative isolate grid min-h-dvh grid-rows-[2fr_auto_3fr] justify-items-center bg-sidebar px-4 py-10">
  <LoginBackdrop />
  <div class="login-enter row-span-3 grid w-full max-w-[23rem] grid-rows-subgrid">
    <div class="row-start-2 overflow-hidden rounded-xl border border-border bg-background">
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
        <div class="flex min-h-[13.5rem] items-center justify-center px-5 py-5">
          <Spinner class="size-5" label="Checking sign-in" />
        </div>
      {:else if proxyOnly}
        <div class="flex flex-col gap-4 px-5 pt-5 pb-5">
          <span class="grid size-10 place-items-center rounded-[10px] bg-sidebar text-muted-foreground ring-1 ring-border">
            <Icon name="shield" size={20} />
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

        <div class="flex flex-col gap-1.5">
          <label for="admin-key" class="text-sm font-medium">Admin key</label>
          <div bind:this={field}>
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
          {#if error}
            <p id="admin-key-error" class="text-sm text-pretty text-destructive" role="alert">{error}</p>
          {/if}
        </div>

        <Button type="submit" variant="primary" class="w-full" aria-busy={busy || undefined}>
          {#if busy}<Spinner class="size-4" label="Signing in" />{/if}
          {busy ? "Signing in" : "Sign in"}
        </Button>
      </form>
      {/if}
    </div>

    <div class="row-start-3 h-0">
      <div class="flex flex-col gap-4 pt-4 pb-10">
        <LoginAbout />

        <nav class="flex items-center justify-between gap-3 px-1 text-[13px] text-muted-foreground" aria-label="Links">
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

  @media (prefers-reduced-motion: no-preference) {
    .login-enter {
      animation: login-enter 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
    }
  }

  @keyframes login-enter {
    from {
      opacity: 0;
      transform: translateY(6px);
      filter: blur(2px);
    }
  }
</style>
