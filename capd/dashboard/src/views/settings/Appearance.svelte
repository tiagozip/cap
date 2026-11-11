<script>
import { Row, Segmented, Select } from "../../components/cap/index.js";
import { LOCALES, locale, setLocale, t, tx } from "../../lib/i18n.svelte.js";
import { setTheme, theme } from "../../lib/ui.svelte.js";
</script>

<Row label={t("Theme")} help={t("Saved in this browser.")}>
  <Segmented
    class="self-start md:self-auto"
    label={t("Theme")}
    bind:value={() => theme.value, (v) => setTheme(v)}
    options={[
      ["system", tx("theme", "System")],
      ["light", t("Light")],
      ["dark", t("Dark")],
    ]}
  />
</Row>

<Row label={t("Language")} for="appearance-language" help={t("Saved in this browser.")}>
  <Select
    id="appearance-language"
    class="w-full md:w-48"
    options={LOCALES}
    bind:value={() => locale.value, (v) => setLocale(v)}
  />
</Row>
