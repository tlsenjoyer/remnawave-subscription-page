# Green Remnawave Subscription Page

A dark green frontend for [Remnawave](https://github.com/remnawave/subscription-page), with a subtle square grid and traffic-first subscription summaries. The panel API, configuration schema, subscription links, authentication and proxy behavior remain compatible with the cloned upstream v8.0.0 baseline.

Fork release: **v1.0.0**. Upstream package versions remain 8.0.0 because the backend embeds that compatibility version. The fork version is tracked independently in `RELEASE_VERSION`, Git tags and OCI image metadata.

## Deploy

The image supports `linux/amd64` and `linux/arm64`:

```text
ghcr.io/tlsenjoyer/remnawave-subscription-page:v1.0.0
```

Copy `.env.sample` to `.env`, set `REMNAWAVE_PANEL_URL` and `REMNAWAVE_API_TOKEN`, and attach the service to the same Docker network as your panel. `docker-compose-prod.yml` retains the upstream `remnawave-network` external network and loopback-only port 3010.

```sh
docker compose -f docker-compose-prod.yml pull
docker compose -f docker-compose-prod.yml up -d
```

Keep the existing HTTPS reverse proxy in front of the service, forwarding `X-Forwarded-For` and `X-Forwarded-Proto: https`. Configure `TRUST_PROXY` to match your deployment. Existing environment variables, custom subscription prefixes, Marzban compatibility and panel configuration selection remain available. The internal `/internal/health` endpoint is deliberately restricted to loopback and is used by Docker's health check.

To build locally from a clean checkout:

```sh
docker compose build
```

Both the frontend and backend are built inside Docker; no local `dist` folder is required. Panel URLs and tokens are runtime configuration and must never be baked into an image.

## Configure content in the panel

Use the existing subscription-page editor in Remnawave. Branding, logo, support link, instructions, application/platform options, SVG icons, explicit icon colors, translations, visibility switches and layout choices still come from the panel.

Set the existing **Bandwidth** translation field to:

| Language | Value |
| --- | --- |
| Russian | LTE трафик |
| English | LTE traffic |

Other languages can use your preferred heading in the same field. Status, expiry and existing labels use their panel translations. New interface labels (reset captions, expand/collapse hints, unlimited usage, limited/disabled states and exact byte details) have built-in translations for all 20 supported locales, with English fallback; they do not add fields to the API.

The backend loads panel configurations **at startup**, just as upstream does. After changing page configuration in the panel, restart this service and reload the page:

```sh
docker compose -f docker-compose-prod.yml restart
```

## Traffic summary

All visible subscription-information layouts show traffic rather than username. Username data remains available internally for existing `{{USERNAME}}` link templates.

- The bar uses raw byte counters, stays green below 80%, amber from 80%, and red at or above 100%. Over-limit totals are shown without truncation; only the bar is capped.
- Quota sizes use powers of 1024, matching Remnawave's quota convention, with localized MB/GB labels and decimal separators. Zero is `0 MB` / `0 МБ`; nonzero values have one decimal.
- Hover, focus or tap the amount to see the exact byte counters. Unlimited subscriptions show `used / ∞`, an unlimited label and an empty neutral track.
- The reset caption follows the API's daily, weekly, monthly or no-reset strategy. Both monthly strategies say “Resets monthly” / “Сброс ежемесячно”; there is no invented reset countdown.
- Active, expired, limited and disabled states are always explicitly labeled, independently of traffic usage. Unavailable states also change the card's outline/surface.
- The collapsed variant opens with a pointer, Enter or Space and reveals only status and expiry date. Expanded and cards variants show those details immediately; hidden remains hidden. Indefinite expiry retains upstream handling.

## Development and checks

Use Node.js 24 and the committed lockfiles:

```sh
cd frontend
npm ci
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run start:build
```

For a local preview with synthetic data (no panel or credentials), run `node tests/dev-server.mjs` from `frontend` and open `http://127.0.0.1:3334/demo`. This fixture server is not included in the production image. To develop against real panel responses, retain upstream's `PANEL_DATA` and app-config loading conventions.

```sh
cd backend
npm ci
npm run typecheck
npm run lint
NODE_ENV=production npm run build
```

From the repository root, run production compatibility checks against a schema-validated mock panel:

```sh
docker build -t green-subpage:test .
node scripts/compatibility-smoke.mjs --docker green-subpage:test
```

The smoke test uses a temporary container with host networking on Linux. It verifies the browser hydration payload, panel config response, assets/session checks, custom prefix routing, raw subscription bytes and headers, credential handling, HTTPS proxy requirement, and Docker health check. Browser tests cover layout selection, localization, thresholds, expansion, supported application interactions and responsive/RTL screenshots. No real user data or panel API token is required.

## Release

Pull requests and `main` run checks. Only stable `vX.Y.Z` tags publish containers; development images are not published.

1. Update `RELEASE_VERSION` and the pinned image in deployment examples for a new release. Leave upstream compatibility package versions unchanged unless deliberately adopting a new upstream baseline.
2. Commit and push the validated changes, then push a matching tag, starting with `v1.0.0`.
3. GitHub Actions repeats the checks, builds AMD64 and ARM64 images, and publishes the version tag plus `latest` to GHCR using its built-in `GITHUB_TOKEN` (`contents: read`, `packages: write`). Docker Hub, Telegram and personal deployment tokens are not used.
4. On the first publication, open the package settings on GitHub and set visibility to **Public**. Verify an anonymous pull and inspect the manifest for both architectures.

Deploy using a version tag or recorded image digest. Before upgrading, retain the previous digest; rollback by restoring that image in Compose and recreating the service. Application readiness is reported by Docker's health check and startup logs.

## Upstream and license

Derived from [remnawave/subscription-page](https://github.com/remnawave/subscription-page), baseline commit `2a125d180240bb4f373871daf1100f9bb0e2ae3f` (upstream v8.0.0). Upstream authorship and the existing [AGPL-3.0-only license](LICENCE) are retained. Source for this fork is available at [tlsenjoyer/remnawave-subscription-page](https://github.com/tlsenjoyer/remnawave-subscription-page).
