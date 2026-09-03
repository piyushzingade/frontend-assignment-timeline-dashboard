# Timeline Dashboard Notes

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

The backend URL is read from `VITE_BACKEND_BASE_URL`. The default matches the assignment host and does not add an `/api` prefix.

## UI Stack

The assignment names MUI v6, but this implementation deliberately uses Base UI with Tailwind CSS as requested. Base UI provides accessible unstyled primitives for buttons, fields, inputs, and switches. Tailwind owns the visual styling, so the UI can still match the dense dashboard screenshots without bringing in MUI.

## Session And Token Management

The access token is stored in `localStorage` under `timeline-dashboard-token`. This keeps the user signed in across refreshes, which the assignment requires. The tradeoff is that local storage is reachable by injected JavaScript, so the app keeps the token handling centralized and avoids spreading auth logic through components.

On app load, the auth provider reads the token and validates it with `GET /auth/me` before showing the dashboard. All authenticated requests go through one API client that adds `Authorization: Bearer <token>` and unwraps the MES envelope. Any authenticated 401 clears the token and returns the app to login. Login 401s stay on the login screen as inline credential errors.

## Chart Performance

Timeline segments are normalized once into numeric millisecond positions. Individual produces are flattened and sorted once after the API response arrives. The chart uses a canvas layer for segment bands and produce markers so the heavy 10,000-20,000 marker case does not create thousands of DOM nodes.

When the individual-produce toggle is off, the chart uses hourly `produce_counts`. When it is on, the request sends `exact_produces: true`. The render path thins non-failing markers if needed, but it always keeps every `FAIL` marker. Colors, parsed timestamps, and marker geometry inputs are resolved before drawing rather than parsed per marker in JSX.

For hover, the chart precomputes plotted canvas points for the current domain and uses a binary-search window around the pointer's x-position instead of scanning every visible marker on every pointer move. Drag updates are also scheduled through `requestAnimationFrame`. Superseded dashboard requests are aborted with `AbortController`, which matters when an exact-produces request is replaced by another filter change.

## Time And Bucketing

The UI treats shift timings as IST (`Asia/Kolkata`). A selected date plus shift start/end creates the local shift window; if the end time is less than or equal to the start, the end is moved to the next day. That window is converted to UTC ISO strings for API calls.

All response timestamps are converted back to IST for labels, tooltips, and table headers. The hourly table is anchored to the shift start and splits segments across bucket boundaries, summing runtime, unknown unplanned production, stoppage, and unknown downtime separately. Produce counts are summed across part models per hour. Cycle-time values come from the separate hourly `/analytics-query` call and blank cells are rendered for `null`.

## Assumptions And Cuts

The asset tree is flattened into one selector, defaulting to the first machine/line-level node when available. The date input is limited to 22-25 June 2026 because the backend data is only available in that range. Out-of-scope assignment features were not built: auto-refresh, exports, classification dialogs, i18n, themes, and multi-machine dashboards.
