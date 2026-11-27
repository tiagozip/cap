<script>
import { untrack } from "svelte";
import {
  Button,
  CodeBlock,
  CopyText,
  Group,
  Icon,
  PageHeader,
  Row,
  Segmented,
} from "../../components/cap/index.js";
import { CopyCheck } from "../../components/ui/index.js";
import * as session from "../../lib/api.js";
import { api, url } from "../../lib/api.js";
import { provideCommands, toast } from "../../lib/ui.svelte.js";
import { highlight } from "../integration/highlight.js";
import ApiKeys from "../settings/ApiKeys.svelte";
import ConnectedApps from "./ConnectedApps.svelte";
import ToolList from "./ToolList.svelte";

const mcpUrl = url("mcp");
const apiUrl = url("server").replace(/\/$/, "");

let client = $state("claude");
let runtime = $state(null);
let copied = $state(false);

api("GET", "/about").then((r) => {
  if (r?.runtime) runtime = r.runtime;
});

const CLIENTS = {
  claude: {
    filename: "Terminal",
    language: "bash",
    code: `claude mcp add --transport http capd ${mcpUrl}`,
  },
  codex: {
    filename: "Terminal",
    language: "bash",
    code: `codex mcp add capd --url ${mcpUrl}`,
  },
  gemini: {
    filename: "Terminal",
    language: "bash",
    code: `gemini mcp add -s user --transport http capd ${mcpUrl}`,
  },
  cursor: {
    filename: "~/.cursor/mcp.json",
    language: "json",
    code: JSON.stringify({ mcpServers: { capd: { url: mcpUrl } } }, null, 2),
  },
  vscode: {
    filename: ".vscode/mcp.json",
    language: "json",
    code: JSON.stringify(
      { servers: { capd: { type: "http", url: mcpUrl } } },
      null,
      2,
    ),
  },
};

const CLIENT_NAMES = {
  claude: "Claude Code",
  codex: "Codex",
  gemini: "Gemini CLI",
  cursor: "Cursor",
  vscode: "VS Code",
};
const setup = $derived(CLIENTS[client]);
const curl = `curl ${apiUrl}/keys -H "Authorization: Bot $CAP_API_KEY"`;

const copyText = async (text, done) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast("Couldn't copy", "error");
  }
};
$effect(() =>
  untrack(() =>
    provideCommands(() => [
      {
        id: "copy-mcp-url",
        label: "Copy MCP server URL",
        icon: "copy",
        run: () => copyText(mcpUrl, "MCP server URL copied"),
      },
      {
        id: "copy-mcp-setup",
        label: `Copy ${CLIENT_NAMES[client]} setup`,
        icon: "code",
        run: () => copyText(setup.code, "Setup copied"),
      },
      {
        id: "copy-api-url",
        label: "Copy API base URL",
        icon: "copy",
        run: () => copyText(apiUrl, "API base URL copied"),
      },
      {
        id: "copy-api-docs",
        label: "Copy API docs",
        icon: "book",
        run: copyDocs,
      },
    ]),
  ),
);

const copyDocs = async () => {
  try {
    const res = await fetch(url("server/api-docs"), {
      headers: { Authorization: session.authHeader?.() ?? "" },
    });
    if (!res.ok) throw new Error();
    await navigator.clipboard.writeText(await res.text());
    copied = true;
    setTimeout(() => {
      copied = false;
    }, 1600);
  } catch {
    toast("Couldn't copy the API docs", "error");
  }
};
</script>

<PageHeader title="API and MCP" />

<div class="flex max-w-3xl min-w-0 flex-col gap-6 px-4 pt-5 pb-12 md:px-5">
  <Group id="rest-title" title="API">
    <div class="py-3">
      <Row dense label="Base URL">
        <CopyText value={apiUrl} label="Copy API base URL" />
      </Row>
      <Row dense label="API docs">
        <Button onclick={copyDocs}>
          <CopyCheck {copied} size={14} />
          <span class="grid text-center" aria-hidden="true">
            <span class="col-start-1 row-start-1 transition-opacity duration-150 {copied ? 'opacity-0' : ''}">Copy API docs</span>
            <span class="col-start-1 row-start-1 transition-opacity duration-150 {copied ? '' : 'opacity-0'}">Copied</span>
          </span>
          <span class="sr-only" aria-live="polite">{copied ? "Copied" : "Copy API docs"}</span>
        </Button>
      </Row>
      {#if runtime && runtime !== "workers"}
        <Row dense label="API reference">
          <Button href={url("swagger")} target="_blank" rel="noopener">
            <Icon name="external" size={14} />
            Open API reference
          </Button>
        </Row>
      {/if}
      <div class="pt-3">
        <CodeBlock class="min-w-0" filename="Terminal" language="bash" download={false} lineNumbers={false} code={curl} html={highlight(curl)} />
      </div>
    </div>
    <ApiKeys />
  </Group>

  <Group id="mcp-title" title="MCP for agents">
    <Row label="Server URL">
      <CopyText value={mcpUrl} label="Copy MCP server URL" />
    </Row>
    <div class="flex flex-col gap-3 py-5">
      <div class="-mx-1 -my-1 overflow-x-auto px-1 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Segmented
          class="w-max"
          label="MCP client"
          bind:value={client}
          options={Object.entries(CLIENT_NAMES)}
        />
      </div>
      <CodeBlock class="min-w-0" filename={setup.filename} language={setup.language} download={false} code={setup.code} html={highlight(setup.code)} />
    </div>
    <ToolList />
    <div class="flex flex-col gap-1 pt-5">
      <p class="text-sm font-medium">Connected apps</p>
      <ConnectedApps />
    </div>
  </Group>
</div>
