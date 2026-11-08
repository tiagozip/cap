<script>
import { Skeleton } from "../../components/cap/index.js";

let { asn } = $props();

let src = $state(null);
let pending = $state(false);

$effect(() => {
  if (!asn) return;
  let cancelled = false;
  pending = true;
  src = null;
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onerror = () => {
    if (!cancelled) pending = false;
  };
  img.onload = () => {
    if (cancelled) return;
    pending = false;
    try {
      const s = Math.max(img.naturalWidth, img.naturalHeight, 1);
      const c = document.createElement("canvas");
      c.width = s;
      c.height = s;
      const cx = c.getContext("2d");
      cx.drawImage(
        img,
        (s - img.naturalWidth) / 2,
        (s - img.naturalHeight) / 2,
      );
      const data = cx.getImageData(0, 0, s, s);
      const px = data.data;
      const visited = new Uint8Array(s * s);
      const queue = [];
      const enqueue = (x, y) => {
        if (x < 0 || x >= s || y < 0 || y >= s) return;
        const i = y * s + x;
        if (visited[i]) return;
        const o = i * 4;
        if (px[o] < 240 || px[o + 1] < 240 || px[o + 2] < 240) return;
        visited[i] = 1;
        px[o + 3] = 0;
        queue.push(x, y);
      };
      for (let x = 0; x < s; x++) {
        enqueue(x, 0);
        enqueue(x, s - 1);
      }
      for (let y = 0; y < s; y++) {
        enqueue(0, y);
        enqueue(s - 1, y);
      }
      for (let q = 0; q < queue.length; q += 2) {
        const qx = queue[q];
        const qy = queue[q + 1];
        enqueue(qx - 1, qy);
        enqueue(qx + 1, qy);
        enqueue(qx, qy - 1);
        enqueue(qx, qy + 1);
      }
      const removed = visited.reduce((sum, v) => sum + v, 0);
      if (removed / (s * s) > 0.05) {
        const r = Math.max(1, Math.round(s / 18));
        const opaque = new Uint8Array(s * s);
        for (let i = 0; i < s * s; i++) opaque[i] = px[i * 4 + 3] > 0 ? 1 : 0;
        for (let y = 0; y < s; y++) {
          for (let x = 0; x < s; x++) {
            const i = y * s + x;
            if (opaque[i]) continue;
            let near = false;
            for (let dy = -r; dy <= r && !near; dy++) {
              for (let dx = -r; dx <= r && !near; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (
                  nx >= 0 &&
                  nx < s &&
                  ny >= 0 &&
                  ny < s &&
                  opaque[ny * s + nx]
                )
                  near = true;
              }
            }
            if (near) px.set([255, 255, 255, 255], i * 4);
          }
        }
      }
      cx.putImageData(data, 0, 0);
      src = c.toDataURL();
    } catch {
      src = img.src;
    }
  };
  img.src = `https://tiagozip.github.io/asn-data/logos/${asn}.png`;
  return () => {
    cancelled = true;
  };
});
</script>

<Skeleton class="size-[18px] shrink-0" loading={pending}>
  <span data-bone="block" class="flex size-[18px] items-center justify-center overflow-hidden rounded-[3px] text-muted-foreground" aria-hidden="true">
    {#if src}
      <img class="size-[18px] rounded-[3px] object-contain" {src} alt="" width="18" height="18" />
    {:else}
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" /><path d="M2 12h20" /><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10z" /></svg>
    {/if}
  </span>
</Skeleton>
