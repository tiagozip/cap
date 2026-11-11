<script>
import {
  Group,
  Input,
  Row,
  Select,
  Slider,
} from "../../components/cap/index.js";
import { numFmt, t } from "../../lib/i18n.svelte.js";

let { form = $bindable(), errors = {} } = $props();
</script>

{#snippet slider(key, min, max, step, label)}
  <div class="flex w-full max-w-72 items-center gap-3">
    <Slider
      {min}
      {max}
      {step}
      size="sm"
      thumbLabel={label}
      bind:value={() => Number(form[key]), (v) => (form[key] = v)}
    />
    <output class="w-12 shrink-0 text-sm tabular-nums">{numFmt(Number(form[key]))}</output>
  </div>
{/snippet}

<Group
  id="cfgPuzzle"
  title={t("Puzzle")}
>
  <Row label={t("Puzzle type")} for="cfgChallengeProtocol" help={t("HashWX suits most sites.")}>
    <Select
      id="cfgChallengeProtocol"
      class="w-full md:w-64"
      options={[
        ["hashwx", t("HashWX (recommended)")],
        ["sha256-pow", "SHA-256"],
      ]}
      bind:value={form.protocol}
    />
  </Row>

  {#if form.protocol === "sha256-pow"}
    <Row label={t("Difficulty")} for="cfgDifficulty" help={t("From 1 to 8. Each step makes a puzzle about 16 times harder.")}>
      <div class="flex flex-col gap-1.5 md:items-end">
        <Input
          type="number"
          id="cfgDifficulty"
          inputmode="numeric"
          min="1"
          max="8"
          class="max-w-24 tabular-nums"
          invalid={!!errors.difficulty}
          aria-describedby={errors.difficulty ? "cfgDifficulty-error" : undefined}
          bind:value={form.difficulty}
        />
        {#if errors.difficulty}<p id="cfgDifficulty-error" class="text-sm text-destructive">{t(errors.difficulty)}</p>{/if}
      </div>
    </Row>
    <Row label={t("Puzzles per solve")} for="cfgChallengeCount" help={t("From 1 to 500. More puzzles smooth out lucky solves.")}>
      <div class="flex flex-col gap-1.5 md:items-end">
        <Input
          type="number"
          id="cfgChallengeCount"
          inputmode="numeric"
          min="1"
          max="500"
          class="max-w-24 tabular-nums"
          invalid={!!errors.challengeCount}
          aria-describedby={errors.challengeCount ? "cfgChallengeCount-error" : undefined}
          bind:value={form.challengeCount}
        />
        {#if errors.challengeCount}<p id="cfgChallengeCount-error" class="text-sm text-destructive">{t(errors.challengeCount)}</p>{/if}
      </div>
    </Row>
  {/if}

  {#if form.instrumentation}
    <Row label={t("Browser check obfuscation")} help={t("Higher makes the browser check harder for bots to pick apart, and uses more CPU on every visit.")}>
      {@render slider("obfuscationLevel", 1, 10, 1, t("Browser check obfuscation"))}
    </Row>
  {/if}
</Group>
