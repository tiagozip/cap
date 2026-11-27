---
description: "capd's update check: the new versions and security notices it gets back, the anonymous usage numbers it sends, and how to turn it off."
---

# Update checks

Once a day by default, capd asks `updates.trycap.dev` whether a newer capd is out and whether a published security advisory affects the version you run. When one does, the dashboard shows a notice above **Instance settings**.

The request carries a small report of anonymous usage numbers.

## What capd sends

**Instance settings > About > Manage > See what's sent** shows the exact report your server sends. It looks like this:

```json
{
  "id": "bpkuc8lx",
  "version": "4.0.19",
  "runtime": "bun",
  "keys": 1,
  "solves": 1000,
  "memory": 128,
  "vars": "AQBB"
}
```

capd never sends IP addresses, hostnames, site keys, key names, secrets, settings values or anything about your visitors. The update server doesn't store the address the report came from.

## How often it checks

capd checks once a day unless you pick every 4 days, every week or every month under **Instance settings > About > Manage**. It also checks right after you update capd, so a new version always gets its security notices.

## Turning it off

Switch it off under **Instance settings > About > Manage**, or set this environment variable. Either way capd stops sending anything, and the dashboard stops showing update and security notices:

```bash
CAP_UPDATE_CHECK=0
```

capd logs one line at startup while the check is on, so you can confirm it from the logs.
