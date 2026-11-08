<svg class="absolute size-0" aria-hidden="true">
  <filter id="notch-inner" x="0" y="0" width="1" height="1.5" color-interpolation-filters="sRGB">
    <feComponentTransfer in="SourceAlpha" result="hole">
      <feFuncA type="table" tableValues="1 0" />
    </feComponentTransfer>
    <feMorphology in="SourceAlpha" operator="erode" radius="1" result="inner" />
    <feGaussianBlur in="hole" stdDeviation="0.75" />
    <feOffset dy="-0.5" result="o1" />
    <feFlood style="flood-color: var(--notch-shade-1)" />
    <feComposite in2="o1" operator="in" result="s1" />
    <feGaussianBlur in="hole" stdDeviation="3" />
    <feOffset dy="-1.5" result="o2" />
    <feFlood style="flood-color: var(--notch-shade-2)" />
    <feComposite in2="o2" operator="in" result="s2" />
    <feGaussianBlur in="hole" stdDeviation="8" />
    <feOffset dy="-4" result="o3" />
    <feFlood style="flood-color: var(--notch-shade-3)" />
    <feComposite in2="o3" operator="in" result="s3" />
    <feMerge result="all">
      <feMergeNode in="s1" />
      <feMergeNode in="s2" />
      <feMergeNode in="s3" />
    </feMerge>
    <feComposite in="all" in2="inner" operator="in" result="shade" />
    <feMerge>
      <feMergeNode in="SourceGraphic" />
      <feMergeNode in="shade" />
    </feMerge>
  </filter>
</svg>
