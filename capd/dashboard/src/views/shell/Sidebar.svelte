<script>
import {
  Icon,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
} from "../../components/cap/index.js";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "../../components/ui/index.js";
import { signOut } from "../../lib/api.js";
import { compact } from "../../lib/format.js";
import { app, navigate } from "../../lib/state.svelte.js";
import { KEY_TABS, keyTab } from "../keyTabs.js";

const ICONS = {
  activity: "dashboard",
  events: "activity",
  protection: "shield",
  configuration: "settings",
};

const sidebar = useSidebar();
const onKey = $derived(app.route.view === "key");
const current = $derived(
  app.keys.find((k) => k.siteKey === app.key?.siteKey) ?? app.keys[0],
);
const tab = $derived(onKey ? keyTab(app.route.tab) : null);

const go = (e, route) => {
  e?.preventDefault();
  navigate(route);
  sidebar.openMobile = false;
};
</script>

<SidebarHeader class="gap-3 p-0">
  <div class="flex h-9 items-center gap-2 px-2">
    <img src="./public/logo-small.webp" alt="" width="22" height="22" />
    <span class="text-[15px] font-semibold">Cap</span>
  </div>

  {#if app.keys.length}
    <Menu align="start" width="w-(--bits-dropdown-menu-anchor-width)">
      {#snippet trigger(props)}
        <SidebarMenuButton {...props} class="h-10 cursor-pointer gap-2.5 rounded-lg bg-sidebar-accent/60 px-2.5 text-[14px] ring-1 ring-border hover:bg-sidebar-accent data-[state=open]:bg-sidebar-accent">
          <Icon name="key" size={18} class="shrink-0 text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate font-medium">{current?.name}</span>
          <Icon name="selector" size={14} class="shrink-0 text-faint-foreground" />
        </SidebarMenuButton>
      {/snippet}
      <MenuLabel>Site keys</MenuLabel>
      {#each app.keys as k (k.siteKey)}
        <MenuItem
          icon={k.siteKey === current?.siteKey ? "check" : null}
          inset
          onselect={() => go(null, { view: "key", siteKey: k.siteKey, tab: tab ?? "activity" })}
        >
          {@const dir = k.difference?.direction}
          {@const pct = Math.round(Math.abs(Number(k.difference?.value) || 0))}
          <span class="flex min-w-0 flex-col py-px">
            <span class="truncate">{k.name}</span>
            <span class="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
              {#if k.solvesLast24h && dir && pct}
                <span class={dir === "up" ? "text-success" : "text-destructive"}><span class="sr-only">{dir === "up" ? "Up" : "Down"} </span>{dir === "up" ? "+" : "\u2212"}{pct}%</span>
              {/if}
              <span class="truncate">{k.solvesLast24h ? `${compact(k.solvesLast24h)} solves in 24h` : "No solves in 24h"}</span>
            </span>
          </span>
        </MenuItem>
      {/each}
      <MenuSeparator />
      <MenuItem icon="plus" onselect={() => (app.createKeyOpen = true)}>Create site key</MenuItem>
    </Menu>
  {/if}
</SidebarHeader>

<SidebarContent class="gap-5 p-0 pt-3">
  {#if current}
    <SidebarGroup class="p-0">
      <SidebarGroupLabel class="h-7 px-2 text-xs text-faint-foreground">Key</SidebarGroupLabel>
      <SidebarMenu class="gap-px">
        {#each KEY_TABS as t (t.id)}
          <SidebarMenuItem>
            <SidebarMenuButton
              href="#/keys/{current.siteKey}/{t.id}"
              isActive={onKey && tab === t.id}
              class="h-9 cursor-pointer gap-2.5 rounded-md px-2 text-[14px] text-muted-foreground hover:bg-nav-hover hover:text-foreground active:bg-nav-active data-active:bg-nav-active data-active:font-normal data-active:text-foreground [&_svg]:text-faint-foreground data-active:[&_svg]:text-foreground"
              onclick={(e) => go(e, { view: "key", siteKey: current.siteKey, tab: t.id })}
            >
              <Icon name={ICONS[t.id]} size={18} />
              <span>{t.label}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        {/each}
      </SidebarMenu>
    </SidebarGroup>
  {:else}
    <SidebarGroup class="p-0">
      <SidebarMenu class="gap-px">
        <SidebarMenuItem>
          <SidebarMenuButton class="h-9 cursor-pointer gap-2.5 rounded-md px-2 text-[14px] text-muted-foreground hover:bg-nav-hover hover:text-foreground active:bg-nav-active data-active:bg-nav-active data-active:font-normal data-active:text-foreground [&_svg]:text-faint-foreground data-active:[&_svg]:text-foreground" onclick={() => (app.createKeyOpen = true)}>
            <Icon name="plus" size={18} />
            <span>Create your first key</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  {/if}

  <SidebarGroup class="mt-auto p-0">
    <SidebarMenu class="gap-px">
      <SidebarMenuItem>
        <SidebarMenuButton
          href="#/settings"
          isActive={app.route.view === "settings"}
          class="h-9 cursor-pointer gap-2.5 rounded-md px-2 text-[14px] text-muted-foreground hover:bg-nav-hover hover:text-foreground active:bg-nav-active data-active:bg-nav-active data-active:font-normal data-active:text-foreground [&_svg]:text-faint-foreground data-active:[&_svg]:text-foreground"
          onclick={(e) => go(e, { view: "settings" })}
        >
          <Icon name="server" size={18} />
          <span>Instance settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton class="h-9 cursor-pointer gap-2.5 rounded-md px-2 text-[14px] text-muted-foreground hover:bg-nav-hover hover:text-foreground active:bg-nav-active data-active:bg-nav-active data-active:font-normal data-active:text-foreground [&_svg]:text-faint-foreground data-active:[&_svg]:text-foreground" href="https://trycap.dev/guide/capd/" target="_blank" rel="noopener">
          <Icon name="book" size={18} />
          <span class="flex-1">Docs</span>
          <Icon name="external" size={13} />
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton class="h-9 cursor-pointer gap-2.5 rounded-md px-2 text-[14px] text-muted-foreground hover:bg-nav-hover hover:text-foreground active:bg-nav-active data-active:bg-nav-active data-active:font-normal data-active:text-foreground [&_svg]:text-faint-foreground data-active:[&_svg]:text-foreground" onclick={() => signOut({ revoke: true })}>
          <Icon name="logout" size={18} />
          <span>Sign out</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarGroup>
</SidebarContent>
