<script>
let { component: Arrow, class: className, ...rest } = $props();

const pick = (style, key) =>
  style?.match(new RegExp(`(?:^|;)\\s*${key}:\\s*([^;]+)`))?.[1]?.trim();
</script>

<Arrow {...rest}>
  {#snippet child({ props })}
    {@const side = props["data-side"]}
    {@const left = pick(props.style, "left")}
    {@const top = pick(props.style, "top")}
    <div
      {...props}
      class={className}
      style={`position:absolute;${(side === "top" || side === "bottom") && left ? `left:${left};` : ""}${(side === "left" || side === "right") && top ? `top:${top};` : ""}`}
    ></div>
  {/snippet}
</Arrow>
