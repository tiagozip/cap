<script>
import { cn } from "../../../lib/utils.js";
import CopyCheck from "../copy-check/CopyCheck.svelte";
import { createReceipt } from "../copy-check/receipt.svelte.js";
import Icon from "../icon/Icon.svelte";
import Tooltip from "../tooltip/Tooltip.svelte";
import TooltipContent from "../tooltip/TooltipContent.svelte";
import TooltipTrigger from "../tooltip/TooltipTrigger.svelte";

let {
  code = "",
  html,
  filename,
  language = "ts",
  lineNumbers = true,
  copyText,
  download = true,
  actions,
  class: className,
  ...rest
} = $props();

const action =
  "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-ring outline-none hover:bg-foreground/5 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50";
const copied = createReceipt();
const downloaded = createReceipt();
const source = $derived(code.replace(/\n$/, ""));
const lineCount = $derived(
  (html ?? source).replace(/\n$/, "").split("\n").length,
);

const copy = async () => {
  const text = typeof copyText === "function" ? await copyText() : copyText;
  if (text === null) return;
  try {
    await navigator.clipboard.writeText(text ?? code);
  } catch {
    return;
  }
  copied.mark();
};

const save = () => {
  const text = typeof copyText === "string" ? copyText : code;
  const blob = new Blob([text.endsWith("\n") ? text : `${text}\n`], {
    type: "text/plain;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const base = filename?.split("/").at(-1)?.trim();
  link.download =
    typeof download === "string"
      ? download
      : base && /\.[^.\s]+$/.test(base)
        ? base
        : `${base || "code"}.${language}`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
  downloaded.mark();
};
</script>

<figure data-slot="code-block" class={cn("overflow-hidden rounded-xl border bg-card text-card-foreground", className)} {...rest}>
  <figcaption class="flex items-center gap-2 border-b px-3 py-1.5">
    <Icon name={language === "sh" || language === "bash" ? "terminal" : "code"} size={15} stroke={1.8} class="shrink-0 text-muted-foreground" />
    <span dir="auto" class="truncate font-mono text-xs text-foreground">{filename}</span>
    <div class="ms-auto flex shrink-0 items-center gap-0.5">
      {@render actions?.(action)}
      {#if download !== false}
        <Tooltip>
          <TooltipTrigger class={action} aria-label={filename ? `Download ${filename}` : "Download this code"} onclick={save}>
            <Icon name="download" data-slot="download-icon" size={16} stroke={1.8} />
          </TooltipTrigger>
          <TooltipContent>{downloaded.copied ? "Downloaded" : "Download"}</TooltipContent>
        </Tooltip>
      {/if}
      <Tooltip>
        <TooltipTrigger class={action} aria-label={filename ? `Copy ${filename}` : "Copy this code"} onclick={copy}>
          <CopyCheck copied={copied.copied} size={16} />
        </TooltipTrigger>
        <TooltipContent>{copied.copied ? "Copied" : "Copy"}</TooltipContent>
      </Tooltip>
    </div>
  </figcaption>
  <div dir="ltr" class="flex">
    {#if lineNumbers}
      <div
        aria-hidden="true"
        class="box-content min-w-[2ch] shrink-0 border-r py-2.5 pr-2 pl-2.5 text-right font-code text-[13px] leading-6 text-muted-foreground/70 select-none"
      >
        {#each Array.from({ length: lineCount }, (_, index) => index + 1) as line (line)}
          <div>{line}</div>
        {/each}
      </div>
    {/if}
    <pre class="min-w-0 flex-1 overflow-x-auto py-2.5 pr-4 pl-2.5 font-code text-[13px] leading-6"><code class="block w-max font-code"
        >{#if html}{@html html}{:else}{source}{/if}</code
      ></pre>
  </div>
</figure>
