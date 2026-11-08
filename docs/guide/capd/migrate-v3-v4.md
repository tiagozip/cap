---
search: false
head:
  - - meta
    - name: robots
      content: noindex, follow
description: "How to upgrade a self-hosted Cap server from v3 (standalone) to v4 (capd): what migrates on its own, and the secrets and compose changes you make by hand."
---

# Migrating from v3 to v4

**What changes:** v4 renames the server from `standalone` to `capd`, moves analytics into DuckDB or ClickHouse, and rehashes every stored token as SHA-256. You may lose some analytics data in the process due to changes in how events are recorded.

**What doesn't change:** The Docker image and your site keys and settings. Most of the move happens on the first start. This page is the handful of steps you do yourself.

***

1. **Back up Valkey.** Site keys, secrets, settings and sessions all live there, and the snapshot is also your way back to v3.

   ```bash
   docker compose exec valkey valkey-cli SAVE
   docker compose cp valkey:/data/dump.rdb ./valkey-backup-v3.rdb
   ```

2. **Give Cap a data volume.** Skip this if your compose file already mounts `/usr/src/app/data`. Without a volume, the event database is lost every time the container is recreated.

   ```yaml
   services:
     cap:
       volumes:
         - cap-data:/usr/src/app/data

   volumes:
     cap-data:
   ```

3. **Switch the image to v4.** Set the tag to `tiago2/cap:4`, in the compose file or as `CAP_IMAGE` in `.env`, then pull and recreate. A compose file on `:3` stays on v3 until you change it, and one on `:latest` gets v4 on its next pull.

   ```bash
   docker compose pull && docker compose up -d
   ```

4. **Log in again** with `ADMIN_KEY`. Every v3 dashboard session is signed out.

5. **Reset each site key's secret.** Until you do, `/siteverify` returns 403 for that key. Open the key's **Settings > Danger zone**, reset the secret and put the new one in your backend. The key list marks each one that still needs this with a "Reset secret" tag, and Cap logs their ids when it starts.

6. **Replace your API keys.** v3 API keys return 401. Create new ones under **Instance settings > API keys** and delete the old ones.

That's it. Analytics are written to DuckDB inside the container unless you set up ClickHouse, which [Analytics storage](./index.md#analytics-storage) explains.

## What carries over

Site keys, settings and rate limits work unchanged. The hourly solve, fail and rate-limit counts from v3 are copied into the new event store on the first start, so the chart over time keeps its history. The event log and the breakdowns by country, network and platform start empty, because v3 never stored them per request.

## Rolling back

Restore the Valkey snapshot and run the `tiago2/cap:3` image. Any secret you already reset on v4 can't be read by v3, so reset those keys again there. Secrets you didn't touch keep working.
