<script>
import {
  Group,
  Input,
  Row,
  Select,
  Slider,
  Switch,
} from "../../components/cap/index.js";
import { app } from "../../lib/state.svelte.js";
import SolveCost from "../../polish/key-settings/SolveCost.svelte";

let { form = $bindable(), errors = {}, baseline } = $props();
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
    <output class="w-20 shrink-0 text-right text-sm tabular-nums">{Number(form[key]).toLocaleString()}</output>
  </div>
{/snippet}

<Group
  id="cfgPuzzle"
  title="Puzzle"
>
  <Row label="Puzzle type" for="cfgChallengeProtocol">
    <Select
      id="cfgChallengeProtocol"
      class="w-full md:w-64"
      options={[
        ["hashwx", "HashWX (recommended)"],
        ["sha256-pow", "SHA-256"],
      ]}
      bind:value={form.protocol}
    />
  </Row>

  <SolveCost siteKey={app.key.siteKey} {form} baseline={baseline ?? form} />

  {#if form.protocol === "hashwx"}
    <div>
    <Row
      label="Allow SHA-256 when WebAssembly is off"
      for="cfgSha256Fallback"
      help="For browsers without WebAssembly, such as Safari in Lockdown Mode. Bots can fake this."
    >
      <Switch id="cfgSha256Fallback" bind:checked={form.sha256Fallback} />
    </Row>
    </div>
  {/if}

  {#if form.protocol === "sha256-pow" || form.sha256Fallback}
    <div>
    <Row label="Difficulty" for="cfgDifficulty" help="Each step is about 16 times harder.">
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
        {#if errors.difficulty}<p id="cfgDifficulty-error" class="text-sm text-destructive">{errors.difficulty}</p>{/if}
      </div>
    </Row>
    </div>
    <div>
    <Row label="Puzzles per solve" for="cfgChallengeCount" help="More puzzles even out lucky solves.">
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
        {#if errors.challengeCount}<p id="cfgChallengeCount-error" class="text-sm text-destructive">{errors.challengeCount}</p>{/if}
      </div>
    </Row>
    </div>
  {/if}

  {#if form.instrumentation}
    <div>
    <Row label="Browser check obfuscation" help="Harder for bots to reverse, but costs more CPU on every visit.">
      {@render slider("obfuscationLevel", 1, 10, 1, "Browser check obfuscation")}
    </Row>
    </div>
  {/if}
</Group>
