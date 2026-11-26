# Around You — launch-day load test

This folder has one test (`launch-burst.js`) that simulates a wave of Locals
opening the app right after a push alert — the moment your backend gets hit
hardest. It stresses the **read** side (the dashboard's "nearby" calls) against
your live Fly + Supabase stack.

**It is safe:** read-only (no writes, no emails, no invoices), and it creates
exactly **one** throwaway test Local (cell `0990000001`) that you delete
afterwards. Run it **at night** so real users aren't affected.

---

## 1. No install needed

`k6.exe` is already in this folder, so there's nothing to install. (If Windows
SmartScreen warns the first time you run it, choose **More info -> Run anyway** —
it's the official k6 program from Grafana.)

## 2. Run the test

First confirm your backend URL — it's the `NEXT_PUBLIC_BACKEND_URL` value in
your Vercel project settings (most likely `https://around-you-backend.fly.dev`).

In **PowerShell**, from this folder:

```powershell
cd D:\1au\loadtest
$env:BASE_URL="https://around-you-backend.fly.dev"; $env:PEAK="300"; $env:POSTAL="7390"; .\k6.exe run launch-burst.js
```

- `PEAK` is the number of Locals opening at the same time. Start at `300`.
  For a harder test later, raise it (e.g. `$env:PEAK="600"`).
- `POSTAL` is the ward to search from — use one of your Saint Helena Bay codes.

The test ramps up over 30s, holds the peak for 90s, then winds down — about
2.5 minutes total.

## 3. Delete the test account afterwards

In the Admin Dashboard, the test sign-in is a Local with cell `0990000001`.
It has no effect on anything, but delete it so it doesn't count toward your
500-Locals lucky draw.

---

## 4. How to read the result

At the end k6 prints a summary. Look at these lines:

- **`http_req_failed`** — the share of calls that errored. Green/under 1% is
  healthy. If this climbs, the backend is dropping requests under load.
- **`http_req_duration` p(95)** — 95% of individual calls finished faster than
  this. Under ~2s is comfortable.
- **`app_load_full_ms` p(95)** — how long a *whole* dashboard load took. This is
  what a real user feels. Under ~3s is good.
- **`iterations`** — how many full app-opens were simulated.

k6 marks the run **passed** or **failed** against the thresholds built into the
script (under 1% errors, p95 under 2s). A pass at `PEAK=300` means the current
setup comfortably handles a Saint Helena Bay launch.

## 5. If it struggles — what we'd change (in order)

1. **Run 2 Fly machines** on launch/draw day (cheap, doubles capacity). The app
   already auto-starts extra machines; running a second one from the start
   removes the cold-start lag.
2. **Raise the DB connection pool** (currently 8 per machine) — only worth doing
   if your Supabase plan allows more pooled connections; otherwise it backfires.
3. **Cache the "nearby" lists for ~30–60s** — the partner data barely changes, so
   serving a short-lived cached copy would cut database load dramatically under a
   burst. This is a code change; tell me if the numbers call for it.

Send me the summary k6 prints and I'll tell you exactly which of these (if any)
is worth doing.
