# Frontend on the testing branch

`frontend/` here is `origin/frontend` at f874107 plus one line, to check it against the current backend (contract 0.5). The `frontend` branch is untouched.

## The one change (`src/main.ts`, Process button)

```
-    if (res.status === 202) setStatus("status.accepted");
+    if (res.status === 202 || res.status === 200) setStatus("status.accepted"); // 200: cached (contract 0.5)
```

A public server (`serve --jobs --public`) answers `POST sites` with 200 when the place is already processed; without this the status line says "could not take the request (200)".

## For the frontend lane (contract 0.5, branch `contract-0.5`, `docs/04`)

- `POST sites` on a public server: 200 `{id, status: "done", empty?, message?}` (cached; `empty` = no NISAR data there, worth its own message), 202 `{id, status, position}` (queued), 429 `{detail}` (over a limit; `detail` is a plain sentence, worth showing). New status strings need the three languages.
- `GET sites/<id>`: `status` and queue `position`, for a "processing" indicator.
- Each area has `friendly`: URL of `areas/<id>/friendly.json` (C8), graded plain-language cards per category for the friendly mode. Nothing reads it yet.
- The `mexico` area is the whole country (soil moisture at 2 km per 12-day cycle, change, fire detections). It loads like any area.
- Layer `polarization` can be `"none"` (fire detections).
