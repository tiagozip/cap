<script>
import Icon from "../Icon.svelte";

const { id, size = 16, class: className = "" } = $props();
const uid = $props.id();

const svgs = import.meta.glob("../../assets/agents/*.svg", {
  eager: true,
  query: "?raw",
  import: "default",
});
const pngs = import.meta.glob("../../assets/agents/*.png", {
  eager: true,
  import: "default",
});
const BRANDS = {
  "claude-in-chrome": "claude",
  "claude-agent": "claude",
  "chatgpt-agent": "openai",
  "chatgpt-user": "openai",
  "google-agent": "google",
  "google-antigravity": "antigravity",
  "perplexity-comet": "perplexity",
  "grok-bot": "grok",
  "2captcha-solver": "2captcha",
  "gemini-in-chrome": "gemini",
  "brave-leo": "brave",
  "nova-act": "nova",
  "cloudflare-browser-run": "cloudflare",
  "aws-agentcore": "aws",
  "agent-browser": "vercel",
  hyperagent: "hyperbrowser",
};
const MONO = new Set(["agentql", "agi-agent", "maxai"]);
const ROUND = new Set(["browserflow", "genspark"]);
const TILES = new Set([
  "anchor-browser",
  "browser-use",
  "browserbase",
  "dassi",
  "harpa",
  "hyperbrowser",
  "kernel",
  "magnitude",
  "rtrvr",
  "skyvern",
  "stagehand",
  "twin",
  ...ROUND,
]);

const name = $derived(BRANDS[id] ?? id);
const svg = $derived(
  svgs[`../../assets/agents/${name}.svg`]?.replace(
    /(id="|url\(#)([^")]+)/g,
    `$1$2-${uid}`,
  ),
);
const png = $derived(pngs[`../../assets/agents/${name}.png`]);
</script>

{#if svg}
  <span class="inline-flex shrink-0 [&>svg]:size-full {className}" style:width="{size}px" style:height="{size}px" aria-hidden="true">{@html svg}</span>
{:else if png}
  <img src={png} alt="" width={size} height={size} class={["shrink-0", ROUND.has(name) ? "rounded-full" : "rounded-[4px]", MONO.has(name) && "dark:invert", TILES.has(name) && "outline -outline-offset-1 outline-black/8 dark:outline-white/12", className]} />
{:else}
  <Icon name="bot" {size} class="shrink-0 text-muted-foreground {className}" />
{/if}
