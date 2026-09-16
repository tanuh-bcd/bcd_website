# Research website and shared portal

The research website uses the public UI from `tanuh-bcd/bcd_portal` commit
`00d96c4d` (2026-09-16), adapted for Vite. Login, admin and clinician pages are
not included. Consent, question definitions, hospitals, dashboard statistics,
imaging statistics and the risk reference table come from the portal API.

Both sites use the same response database and dashboard totals. The research
backend is now a small public API bridge (`backend/portal-proxy.js`), not a
second implementation of the questionnaire/scoring service. The old Express
server is retained for reference/rollback and is not used by Docker or npm start.

## Local review

Use Node 22 and npm 10 or newer.

```bash
cd questionnaire-app
npm ci
PORTAL_API_ORIGIN=https://bc-portal-dev.tanuh.ai npm --prefix backend start
```

In another terminal:

```bash
cd questionnaire-app
npm run dev -- --host 127.0.0.1
```

Open the Vite URL. Consent and questions load from the active database version.
That version is pinned for the consent request, subsequent language changes and
session creation. An unavailable content service shows Retry instead of a static
questionnaire fallback. Submitting through this local live preview creates a real
record in the shared portal database.

For an isolated automated check, with no portal writes:

```bash
cd questionnaire-app
npm run build
npm --prefix backend test
npx playwright install chromium
npm run test:smoke
```

Browser tests intercept every API request. Fixtures contain only public question
definitions, consent and aggregate dashboard responses captured on 2026-09-16;
they contain no individual submissions. Tests cover consent gating, version-2
conditional/repeated questions, required fields, removal of hidden answers,
submission, PDF download, content failure, and desktop/mobile dashboard rendering.
Bridge tests cover version/query forwarding, multipart uploads, error propagation,
and rejection of non-public API routes.

## Deployment preparation

1. Configure `PORTAL_API_ORIGIN` in the deployment directory's `.env`. The example
   uses the portal dev site for comparison. Select the stable shared backend origin
   before production rollout; this repo does not deploy or migrate that backend.
2. The upstream must provide the current portal public APIs and versioned schema,
   including participant information, question keys and questionnaire versions.
3. Keep `VITE_API_URL` empty: the browser uses the research domain's `/api` routes.
   Existing Apache routing to port 3001 is retained, now pointing to the bridge.
4. Optionally set `VITE_QUESTIONNAIRE_VERSION` at build time to select a particular
   version. Otherwise the active database version is selected on page load.
5. Run the build and isolated smoke checks, then review consent and dashboard
   against the intended portal deployment before pushing to `main`.

`main` pushes trigger `.github/workflows/deploy.yml` and deploy to GCP. The rebuild
script checks Compose configuration before stopping containers. API origin is
required explicitly so a deployment cannot accidentally fall back to old scoring.
Production readiness still requires verifying the chosen upstream and an approved
end-to-end submission against a test database (the automated smoke test mocks writes).

The UI is a source snapshot, not a shared package. Database content changes appear
without rebuilding; future portal layout/renderer changes must be ported or moved
into a shared package to keep the two sites synchronized.
