<script>
import { t } from "../../../lib/i18n.svelte.js";
import Button from "../button/Button.svelte";
import CopyCheck from "./CopyCheck.svelte";
import { createReceipt } from "./receipt.svelte.js";

let {
  text,
  label,
  copiedLabel,
  variant = "ghost",
  size = "icon-sm",
  onCopy,
  children,
  ...rest
} = $props();

const receipt = createReceipt();
</script>

<Button
  {variant}
  {size}
  aria-label={children ? undefined : receipt.copied ? (copiedLabel ?? t("Copied")) : (label ?? t("Copy"))}
  onclick={async () => {
    const value = typeof text === "function" ? await text() : text;
    if (value == null) return;
    try {
      await navigator.clipboard.writeText(value);
      receipt.mark();
      onCopy?.(value);
    } catch {}
  }}
  {...rest}
>
  <CopyCheck copied={receipt.copied} />
  {@render children?.(receipt.copied)}
</Button>
