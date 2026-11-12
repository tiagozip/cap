<script>
import {
  Group,
  Input,
  Row,
  Select,
  Slider,
  Switch,
} from "../../components/cap/index.js";

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
    <output class="w-12 shrink-0 text-sm tabular-nums">{Number(form[key]).toLocaleString()}</output>
  </div>
{/snippet}

<Group
  id="cfgPuzzle"
  title="Puzzle"
>
  <Row label="Puzzle type" for="cfgChallengeProtocol" help="HashWX suits most sites.">
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

  {#if form.protocol === "hashwx"}
    <Row
      label="Allow SHA-256 when WebAssembly is off"
      for="cfgSha256Fallback"
      help="Browsers that can't run WebAssembly, like Safari in Lockdown Mode, solve a SHA-256 puzzle instead. Any client can claim this, so bots can choose SHA-256 too, and GPUs solve SHA-256 faster than HashWX."
    >
      <Switch id="cfgSha256Fallback" bind:checked={form.sha256Fallback} />
    </Row>
  {/if}

  {#if form.protocol === "sha256-pow" || form.sha256Fallback}
    <Row label="Difficulty" for="cfgDifficulty" help="From 1 to 8. Each step makes a puzzle about 16 times harder.">
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
    <Row label="Puzzles per solve" for="cfgChallengeCount" help="From 1 to 500. More puzzles smooth out lucky solves.">
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
  {/if}

  {#if form.instrumentation}
    <Row label="Browser check obfuscation" help="Higher makes the browser check harder for bots to pick apart, and uses more CPU on every visit.">
      {@render slider("obfuscationLevel", 1, 10, 1, "Browser check obfuscation")}
    </Row>
  {/if}
</Group>
