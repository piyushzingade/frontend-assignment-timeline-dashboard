# Timeline Dashboard Notes

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

The backend URL is read from `VITE_API_BASE_URL`. The default matches the assignment host and does not add an `/api` prefix.

## Architecture

The application uses React 18, TypeScript, Vite, MUI v6, and Tailwind utility classes for layout polish. API concerns live in a centralized client, auth state lives in an auth provider, and timeline/time aggregation logic is kept in pure utilities so the chart and table can share the same normalized data.

## Session And Token Management

The access token is stored in `sessionStorage` under `timeline-dashboard-token`. This keeps the user signed in across refreshes while scoping the token to the browser tab session. The tradeoff is that session storage is still reachable by injected JavaScript, so it should not be described as XSS-safe.

On app load, the auth provider reads the token and validates it with `GET /auth/me` before showing the dashboard. All authenticated requests go through one API client that adds `Authorization: Bearer <token>` and unwraps the MES envelope. Any authenticated 401 clears the token and returns the app to login. Login 401s stay on the login screen as inline credential errors. Logout calls `/auth/logout` and clears the local session even if the backend request fails.

## Data Fetching

Filter metadata requests for assets and shifts run in parallel. Machine intervals and cycle-time requests also run in parallel once the selected entity scope and shift window are valid. Superseded dashboard requests are aborted with `AbortController`, and a request id prevents older responses from overwriting newer filter selections. There is no polling; the refresh button reruns the current request.

## Chart Performance

Timeline segments are normalized once into numeric millisecond positions. Individual produces are flattened and sorted once after the API response arrives. The chart uses a canvas layer for segment bands and produce markers so the heavy 10,000-20,000 marker case does not create thousands of DOM nodes.

When the individual-produce toggle is off, the chart uses hourly `produce_counts`. When it is on, the request sends `exact_produces: true`. The render path thins non-failing markers if needed, but it always keeps every `FAIL` marker. Colors, parsed timestamps, and marker geometry inputs are resolved before drawing rather than parsed per marker in JSX.

For hover, the chart precomputes plotted canvas points for the current domain and uses a binary-search window around the pointer's x-position instead of scanning every visible marker on every pointer move. Drag updates are also scheduled through `requestAnimationFrame`. Superseded dashboard requests are aborted with `AbortController`, which matters when an exact-produces request is replaced by another filter change.

## Production History Chart

Status bands fill the full plot height and the cumulative line is clipped to the plot frame with a fixed vertical inset (`LINE_PAD_TOP`/`LINE_PAD_BOTTOM`), so the line and its dots always stay inside the colored bands and never paint over the border.

The Y-axis is a data-driven nice axis with three ticks (0, step, 2 × step), so a max of 460 renders as 0 - 250 - 500. Points, tick marks, and labels share one `yToCanvas` mapping. X ticks use a span-based step (15m/30m/1h/2h, capped at ~7 ticks) from the domain start through the domain end, with edge labels clamped inward.

Zoom is Shift + drag (plain drag is reserved for hover); double-click resets the domain. A blue NOW line and badge render when the current time falls inside the domain. Cumulative mode shows per-point value labels with a white halo (toggleable via Point labels, off in individual mode where dots are dense). A Part Models row lists distinct part models from the markers, and the Last-observed-produce and unknown-segments (count + minutes) badges live inside the card below the hint pills.

## Filters And Labels

All labeled fields use a shared `FieldLabel` rendered above the input (login Username/Password; filter Asset level/Asset/Machine/Date/Shift) instead of MUI's border-notch labels. The Show-individual-produces toggle lives only inside the Production History card and syncs back to the page state.

Asset Level and Machine (optional) are client-side only: the backend exposes no level or machine endpoints, so levels are the distinct `assetlevel_id` values from `/core/assets/tree` (All Levels + Level `<id>`) and machines are the direct children of the selected asset. Picking a machine queries that child node as the entity scope; changing the level or asset resets the machine.

## Time And Bucketing

The UI treats shift timings as IST (`Asia/Kolkata`). A selected date plus shift start/end creates the local shift window; if the end time is less than or equal to the start, the end is moved to the next day. That window is converted to UTC ISO strings for API calls.

All response timestamps are converted back to IST for labels, tooltips, and table headers. The hourly table is anchored to the shift start and splits segments across bucket boundaries, summing runtime, unknown unplanned production, stoppage, and unknown downtime separately. Produce counts are summed across part models per hour. Cycle-time values come from the separate hourly `/analytics-query` call and blank cells are rendered for `null`.

## Assumptions And Cuts

The asset tree is flattened into one selector, defaulting to the first machine/line-level node when available. The date input is limited to 22-25 June 2026 because the backend data is only available in that range. Out-of-scope assignment features were not built: auto-refresh, exports, classification dialogs, i18n, themes, and multi-machine dashboards.
