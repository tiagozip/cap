<script>
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import { RangeCalendar } from "bits-ui";
import { untrack } from "svelte";
import Icon from "../Icon.svelte";

let { custom = null, onpick } = $props();

const tz = getLocalTimeZone();
const day = (t) => {
  const d = new Date(t);
  return new CalendarDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
};

let value = $state(
  untrack(() =>
    custom
      ? { start: day(custom.from), end: day(custom.to - 1) }
      : { start: undefined, end: undefined },
  ),
);

const nav =
  "grid size-8 place-items-center rounded-lg text-muted-foreground outline-hidden focus-visible:ring-2 focus-visible:ring-ring data-disabled:pointer-events-none data-disabled:opacity-40 [@media(hover:hover)]:hover:bg-accent [@media(hover:hover)]:hover:text-accent-foreground";
</script>

<RangeCalendar.Root
  bind:value
  maxValue={today(tz)}
  weekdayFormat="short"
  fixedWeeks
  class="w-[15.5rem] select-none"
  onValueChange={(v) => {
    if (!v.start || !v.end) return;
    onpick({
      from: v.start.toDate(tz).getTime(),
      to: v.end.add({ days: 1 }).toDate(tz).getTime(),
    });
  }}
>
  {#snippet children({ months, weekdays })}
    <RangeCalendar.Header class="flex items-center justify-between pb-1">
      <RangeCalendar.PrevButton class={nav} aria-label="Previous month">
        <Icon name="left" size={14} />
      </RangeCalendar.PrevButton>
      <RangeCalendar.Heading class="text-sm font-medium" />
      <RangeCalendar.NextButton class={nav} aria-label="Next month">
        <Icon name="right" size={14} />
      </RangeCalendar.NextButton>
    </RangeCalendar.Header>
    {#each months as month (month.value.toString())}
      <RangeCalendar.Grid class="w-full border-collapse">
        <RangeCalendar.GridHead>
          <RangeCalendar.GridRow class="grid grid-cols-7">
            {#each weekdays as weekday (weekday)}
              <RangeCalendar.HeadCell class="py-1 text-center text-xs font-normal text-muted-foreground">{weekday.slice(0, 2)}</RangeCalendar.HeadCell>
            {/each}
          </RangeCalendar.GridRow>
        </RangeCalendar.GridHead>
        <RangeCalendar.GridBody>
          {#each month.weeks as week, i (i)}
            <RangeCalendar.GridRow class="grid grid-cols-7">
              {#each week as date (date.toString())}
                <RangeCalendar.Cell
                  {date}
                  month={month.value}
                  class="rc-cell"
                >
                  <RangeCalendar.Day
                    class="rc-day"
                  />
                </RangeCalendar.Cell>
              {/each}
            </RangeCalendar.GridRow>
          {/each}
        </RangeCalendar.GridBody>
      </RangeCalendar.Grid>
    {/each}
  {/snippet}
</RangeCalendar.Root>

<style>
  :global {
    .rc-cell {
      position: relative;
      height: 2.25rem;
    }

    .rc-cell::before {
      content: "";
      position: absolute;
      inset-block: 0.125rem;
      inset-inline: 0;
      pointer-events: none;
    }

    .rc-cell:has(> [data-range-middle], > [data-highlighted]:not([data-selection-start], [data-selection-end]))::before {
      background: var(--color-accent);
    }

    .rc-cell:first-child:has(> [data-range-middle], > [data-highlighted])::before {
      inset-inline-start: 0.125rem;
      border-start-start-radius: 9999px;
      border-end-start-radius: 9999px;
    }

    .rc-cell:last-child:has(> [data-range-middle], > [data-highlighted])::before {
      inset-inline-end: 0.125rem;
      border-start-end-radius: 9999px;
      border-end-end-radius: 9999px;
    }

    .rc-cell:has(> [data-selection-start]):has(+ .rc-cell > :is([data-range-middle], [data-highlighted], [data-selection-end]))::before {
      inset-inline-start: 50%;
      background: var(--color-accent);
    }

    .rc-cell:has(> :is([data-range-middle], [data-highlighted], [data-selection-start])) + .rc-cell:has(> [data-selection-end]):not(:has(> [data-selection-start]))::before {
      inset-inline-end: 50%;
      background: var(--color-accent);
    }

    .rc-day {
      position: relative;
      display: grid;
      place-items: center;
      width: 2rem;
      height: 2rem;
      margin: 0.125rem auto;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-variant-numeric: tabular-nums;
      outline: none;
      transition-property: background-color, color;
      transition-duration: 120ms;
    }

    .rc-day:focus-visible {
      box-shadow: 0 0 0 2px var(--color-ring);
    }

    .rc-day[data-today] {
      font-weight: 600;
    }

    .rc-day[data-outside-month] {
      visibility: hidden;
    }

    .rc-day[data-disabled],
    .rc-day[data-unavailable] {
      pointer-events: none;
      opacity: 0.3;
    }

    .rc-cell:has(> [data-highlighted]:hover):not(:has(> [data-selection-start]))::before {
      inset-inline-end: 50%;
    }

    .rc-day:is([data-selection-start], [data-selection-end]),
    .rc-day[data-highlighted]:hover {
      background: var(--color-foreground);
      color: var(--color-background);
      font-weight: 500;
    }

    @media (hover: hover) {
      .rc-day:not([data-selection-start], [data-selection-end], [data-range-middle], [data-highlighted]):hover {
        background: var(--color-accent);
        color: var(--color-accent-foreground);
      }
    }
  }
</style>
