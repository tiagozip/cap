<script>
import {
  Checkbox,
  Group,
  Input,
  Row,
  Switch,
} from "../../components/cap/index.js";
import { t } from "../../lib/i18n.svelte.js";
import { app } from "../../lib/state.svelte.js";
import { BROWSER_HEADERS } from "./form.js";
import OriginList from "./OriginList.svelte";

let { form = $bindable(), errors = {}, originBad = $bindable({}) } = $props();
const max = $derived(app.settings.ratelimit?.max ?? 30);
const seconds = $derived((app.settings.ratelimit?.duration ?? 5000) / 1000);
const rateError = $derived(errors.ratelimitMax ?? errors.ratelimitSeconds);
</script>

<Group id="cfgAccess" title={t("Access")}>
  <Row
    label={t("Rate limit")}
    help={t("How many challenges one visitor can ask for. Leave it blank to use the server default of {max} every {seconds} seconds.", { max, seconds })}
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
          aria-label={t("Requests")}
          invalid={!!errors.ratelimitMax}
          aria-describedby={rateError ? "cfgRate-error" : undefined}
          bind:value={form.ratelimitMax}
        />
        <span>{t("requests every")}</span>
        <Input
          id="cfgRatelimitSeconds"
          type="number"
          inputmode="numeric"
          min="1"
          max="3600"
          class="max-w-20 tabular-nums"
          placeholder={String(seconds)}
          aria-label={t("Seconds")}
          invalid={!!errors.ratelimitSeconds}
          aria-describedby={rateError ? "cfgRate-error" : undefined}
          bind:value={form.ratelimitSeconds}
        />
        <span>{t("seconds")}</span>
      </div>
      {#if rateError}<p id="cfgRate-error" class="text-sm text-destructive">{t(rateError)}</p>{/if}
    </div>
  </Row>

  <Row label={t("Only allow these websites")} for="cfgCorsEnabled" help={t("Other websites can't load challenges with this key.")}>
    <Switch id="cfgCorsEnabled" bind:checked={form.corsOn} />
    {#snippet below()}
      {#if form.corsOn}
        <div class="flex w-full flex-col gap-1.5 md:max-w-sm">
          <OriginList
            id="cfgOrigin"
            bind:values={form.origins}
            bind:bad={originBad}
            describedby={errors.origins ? "cfgOrigin-error" : undefined}
          />
          {#if errors.origins}<p id="cfgOrigin-error" class="text-sm text-destructive">{t(errors.origins)}</p>{/if}
        </div>
      {/if}
    {/snippet}
  </Row>

  <Row label={t("Block clients that aren't browsers")} for="cfgBlockNonBrowserUA" help={t("Turns away tools like curl and python-requests.")}>
    <Switch id="cfgBlockNonBrowserUA" bind:checked={form.blockNonBrowserUA} />
  </Row>

  <Row
    label={t("Require headers every browser sends")}
    for="cfgRequiredHeadersEnabled"
    help={t("Requests missing any checked header are blocked.")}
  >
    <Switch
      id="cfgRequiredHeadersEnabled"
      bind:checked={form.headersOn}
      onchange={(on) => {
        if (on && !form.requiredHeaders.length) form.requiredHeaders = ["accept-language", "accept-encoding"];
      }}
    />
    {#snippet below()}
      {#if form.headersOn}
        <fieldset class="grid w-full gap-x-6 gap-y-2.5 sm:grid-cols-2 md:max-w-sm">
          <legend class="sr-only">{t("Required headers")}</legend>
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
              <span class="font-mono text-sm">{h}</span>
            </label>
          {/each}
        </fieldset>
      {/if}
    {/snippet}
  </Row>
</Group>
