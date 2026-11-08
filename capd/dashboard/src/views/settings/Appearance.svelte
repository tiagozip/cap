<script>
import { Row, Segmented } from "../../components/cap/index.js";
import { setTheme, theme } from "../../lib/ui.svelte.js";
</script>

<Row label="Theme" help="Saved in this browser.">
  <Segmented
    class="self-start md:self-auto"
    label="Theme"
    bind:value={() => theme.value, (v) => setTheme(v)}
    options={[
      ["system", "System"],
      ["light", "Light"],
      ["dark", "Dark"],
    ]}
  />
</Row>
