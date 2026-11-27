<script>
import {
  Checkbox,
  Group,
  Icon,
  Input,
  Row,
  Switch,
} from "../../components/cap/index.js";
import { app } from "../../lib/state.svelte.js";
import { matchOrigin } from "../../polish/key-settings/origin-test.js";
import { BROWSER_HEADERS } from "./form.js";
import OriginList from "./OriginList.svelte";
import { normalizeOrigin } from "./origins.js";

let { form = $bindable(), errors = {}, originBad = $bindable({}) } = $props();
const max = $derived(app.settings.ratelimit?.max ?? 30);
const seconds = $derived((app.settings.ratelimit?.duration ?? 5000) / 1000);
const rateError = $derived(errors.ratelimitMax ?? errors.ratelimitSeconds);
const bare = (v) => v.replace(/^https:\/\//, "");
let probe = $state("");
const probed = $derived(
  matchOrigin(form.origins.map(normalizeOrigin).filter(Boolean), probe),
);
</script>

<Group id="cfgAccess" title="Access">
  <Row
    label="Rate limit"
    help="Blank uses the server default of {max} every {seconds} seconds."
  >
    <div class="flex flex-col gap-1.5 md:items-end">
      <div class="flex items-center gap-2 text-sm whitespace-nowrap text-muted-foreground">
        <Input
          id="cfgRatelimitMax"
          type="number"
          inputmode="numeric"
          min="1"
          max="10000"
          class="max-w-20 tabular-nums"
          placeholder={String(max)}
          aria-label="Requests"
          invalid={!!errors.ratelimitMax}
          aria-describedby={rateError ? "cfgRate-error" : undefined}
          bind:value={form.ratelimitMax}
        />
        <span>requests every</span>
        <Input
          id="cfgRatelimitSeconds"
          type="number"
          inputmode="numeric"
          min="1"
          max="3600"
          class="max-w-20 tabular-nums"
          placeholder={String(seconds)}
          aria-label="Seconds"
          invalid={!!errors.ratelimitSeconds}
          aria-describedby={rateError ? "cfgRate-error" : undefined}
          bind:value={form.ratelimitSeconds}
        />
        <span>seconds</span>
      </div>
      {#if rateError}<p id="cfgRate-error" class="text-sm text-destructive">{rateError}</p>{/if}
    </div>
  </Row>

  <div>
    <Row label="Only allow these websites" for="cfgCorsEnabled">
      <Switch id="cfgCorsEnabled" bind:checked={form.corsOn} />
    </Row>
    {#if form.corsOn}
      <div class="-mt-2 flex w-full flex-col gap-1.5 pb-5 md:ms-auto md:max-w-sm">
        <OriginList
          id="cfgOrigin"
          bind:values={form.origins}
          bind:bad={originBad}
          describedby={errors.origins ? "cfgOrigin-error" : undefined}
        />
        {#if errors.origins}<p id="cfgOrigin-error" class="text-sm text-destructive">{errors.origins}</p>{/if}
        <div class="mt-2 flex flex-col gap-1.5">
          <Input
            id="cfgOriginTest"
            type="text"
            inputmode="url"
            size="sm"
            icon="search"
            autocomplete="off"
            spellcheck="false"
            placeholder="Test a page URL"
            aria-label="Test a page URL"
            aria-describedby={probed ? "cfgOriginTest-result" : undefined}
            bind:value={probe}
            onkeydown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
          />
          <p id="cfgOriginTest-result" class="grid min-h-5 text-sm" role="status">
            {#key probed ? `${probed.ok}:${probed.match}:${probed.invalid}` : ""}
              {#if probed}
                <span class="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5 {probed.ok ? '' : 'text-muted-foreground'}">
                  <Icon name={probed.ok ? "check" : "ban"} size={14} class="shrink-0 {probed.ok ? 'text-success' : probed.invalid ? '' : 'text-destructive'}" />
                  <span class="min-w-0 truncate">
                    {#if probed.invalid}
                      Enter a URL like shop.example.com/checkout
                    {:else if probed.ok}
                      Allowed by <span class="font-mono text-[0.8125rem]">{bare(probed.match)}</span>
                    {:else}
                      <span class="font-mono text-[0.8125rem]">{bare(probed.origin)}</span> can't use this key
                    {/if}
                  </span>
                </span>
              {/if}
            {/key}
          </p>
        </div>
      </div>
    {/if}
  </div>

  <Row label="Block curl, scripts and other non-browsers" for="cfgBlockNonBrowserUA">
    <Switch id="cfgBlockNonBrowserUA" bind:checked={form.blockNonBrowserUA} />
  </Row>

  <div>
    <Row
      label="Block requests missing browser headers"
      for="cfgRequiredHeadersEnabled"
    >
      <Switch
        id="cfgRequiredHeadersEnabled"
        bind:checked={form.headersOn}
        onchange={(on) => {
          if (on && !form.requiredHeaders.length) form.requiredHeaders = ["accept-language", "accept-encoding"];
        }}
      />
    </Row>
    {#if form.headersOn}
      <fieldset class="-mt-2 grid w-full gap-x-6 gap-y-2.5 pb-5 sm:grid-cols-2 md:ms-auto md:max-w-md">
        <legend class="sr-only">Required headers</legend>
        {#each BROWSER_HEADERS as h (h)}
          <label class="flex cursor-pointer items-center gap-2.5">
            <Checkbox
              label={h}
              bind:checked={
                () => form.requiredHeaders.includes(h),
                (on) =>
                  (form.requiredHeaders = on
                    ? [...form.requiredHeaders, h]
                    : form.requiredHeaders.filter((x) => x !== h))
              }
            />
            <span class="font-mono text-sm whitespace-nowrap">{h}</span>
          </label>
        {/each}
      </fieldset>
    {/if}
  </div>
</Group>
