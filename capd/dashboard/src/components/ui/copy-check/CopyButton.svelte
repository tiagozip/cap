<script>
import Button from "../button/Button.svelte";
import CopyCheck from "./CopyCheck.svelte";
import { createReceipt } from "./receipt.svelte.js";

let {
  text,
  label = "Copy",
  copiedLabel = "Copied",
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
  aria-label={children ? undefined : receipt.copied ? copiedLabel : label}
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
