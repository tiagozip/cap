<script>
import { Row, Segmented } from "../../components/cap/index.js";
import { setTheme, theme } from "../../lib/ui.svelte.js";
import LoginBackground from "../../polish/login/LoginBackground.svelte";
</script>

<div class="flex flex-col divide-y divide-border">
  <Row label="Theme">
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
  <LoginBackground />
</div>
