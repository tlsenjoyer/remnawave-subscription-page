# Товарищ VPN subscription page

A compact green subscription dashboard and guided connection flow for Remnawave. Fork release **v2.2.1**; the embedded upstream compatibility version remains **8.0.0**. Existing subscription routes, payloads, panel configuration schema, forwarding, and configuration-session behavior are retained. A separate authenticated device API supports listing and deleting registered devices.

## Deployment

Public AMD64 and ARM64 image:

```text
ghcr.io/tlsenjoyer/remnawave-subscription-page:v2.2.1
```

1. Copy `.env.sample` to `.env`. Set `REMNAWAVE_PANEL_URL`, `REMNAWAVE_API_TOKEN`, and `SUPPORT_EMAIL=support@tovarish.net`.
2. In the Remnawave subscription-page editor, import **`config/tovarish-panel.json`**. It uses the existing schema and contains the seven-platform client matrix, editable download/import instructions, branding, and Russian/English translations. Back up your previous panel configuration first.
3. Grant the panel API token its existing subscription/config permissions plus **Users: get by username** (`users`, `by-username`) and **HWID user devices: list by user** (`hwid-user-devices`, `list-by-user`). Also grant **HWID user devices: delete a user HWID device** (`hwid-user-devices:delete`) for `POST /api/hwid/devices/delete`. If your panel version uses different permission labels, grant the equivalent endpoint permissions.
4. Keep your HTTPS reverse proxy, `X-Forwarded-For`, `X-Forwarded-Proto: https`, appropriate `TRUST_PROXY`, existing custom prefix, and external `remnawave-network` Docker network.
5. Deploy:

```sh
docker compose pull
docker compose up -d
```

`docker-compose.yml` is the production default and pulls the pinned GHCR image.

The panel configuration is loaded **at startup**. Restart the subscription container after changing it. Missing device permissions affect only the device modal; the subscription and connection guide remain usable.

## Panel content and guided layout

Branding title/logo, Telegram support URL, platform/client entries, translations, SVGs and instructions remain editable in the panel. Set the title to **Товарищ VPN**, logo to `https://s.812004.xyz/static/shield-icon.svg`, and support URL to `https://t.me/tovarishvpnbot`. Email is deployment configuration because the panel schema has no email field. It is public contact information, never a secret.

The new frontend uses one presentation: traffic, connection, devices, support. Legacy `cards`, `expanded`, and `collapsed` subscription values all render the compact traffic card; `hidden` still hides it. Installation-guide presentation selectors remain accepted but no longer select a visual layout. `showConnectionKeys` and `hideGetLinkButton` remain accepted for configuration compatibility. The guided interface omits raw connection keys; subscription copy and QR controls appear below the traffic reset caption on the main page.

For each platform, the first app marked `featured` is recommended and selected; if none is featured, the first app is selected. Each app uses ordered instruction blocks:

1. Installation and download buttons.
2. Subscription import instructions/buttons.
3. How to enable VPN. Additional blocks appear after import instructions.

Do not put all steps in one block. Existing button types and `{{SUBSCRIPTION_LINK}}`, `{{USERNAME}}`, and Happ cryptographic templates remain supported; usernames are never shown separately in the page. Subscription URLs placed in a deep-link query parameter are encoded by the new renderer. Path-style imports retain their original URL format.

| Platform | Recommended | Alternatives |
| --- | --- | --- |
| iPhone / iPad | incy | RabbitHole |
| Android | incy | Happ, Clash Meta |
| Windows | Koala Clash | Happ |
| macOS | Koala Clash | Happ |
| Linux | Koala Clash | Happ, Prizrak-Box |
| Android TV | Happ | — |
| Apple TV | Happ | — |

Regenerate the schema-validated panel file with `node scripts/generate-panel-config.mjs` after installing frontend dependencies. This file is an importable template; the deployed page continues to read the panel, not the checked-in template. English and Russian are enabled in the template. Additional panel locales need localized panel text; new frontend labels have translations and English fallback.

Official client sources used for download/import configuration:

- [incy downloads](https://github.com/INCY-DEV/incy-platforms) and [deep links](https://github.com/INCY-DEV/incy-docs/blob/main/ru/dev-docs/deep-links.en.md).
- [Koala Clash](https://github.com/coolcoala/koala-clash), including its registered `koala-clash` scheme and import handler.
- [Happ](https://github.com/Happ-proxy/happ-android) and [desktop releases](https://github.com/Happ-proxy/happ-desktop/releases).
- [Clash Meta for Android](https://github.com/MetaCubeX/ClashMetaForAndroid), including its documented `clashmeta://install-config` scheme.
- [Prizrak-Box installation](https://docs.prizrak.app/install/) and [deep-link documentation](https://github.com/legiz-ru/Prizrak-Box/blob/v3/doc/README.en.md).
- [RabbitHole App Store listing](https://apps.apple.com/app/rabbithole-vpn-client/id6683309629), which documents URL/clipboard/QR import. RabbitHole deliberately uses manual URL import here; an undocumented deep link is not assumed.

Downloads for desktop clients open official release/package selection pages, avoiding guesses about processor architecture. The incy Android APK fallback is explicitly versioned; update it in the panel as required. TV setup can be performed from a phone with instructions completed on the TV. Native app installation and real VPN connectivity must be checked on actual supported devices; browser completion does not verify a connection.

## Traffic and connection behavior

Bandwidth translations are **LTE трафик** / **LTE traffic**. Raw-byte math, localized quota amounts, the green/amber/red thresholds at 80% and 100%, unlimited usage, actual overage amounts, reset schedules, exact-byte tooltip and explicit subscription states are preserved. The plan header shows status once and a muted expiry caption, including indefinite expiry. Username data remains internal for existing link templates.

The fullscreen wizard offers installation, import/enablement, and completion. Back preserves selection. Reopening starts at installation while remembering the selected app/platform for this page session. Inactive users may set up an app with a clear warning. Subscription copy and a QR popup live on the main page. All three wizard steps share a 760px panel, heading alignment, navigation footer, and quiet support link. The app menu overlays the content without shifting it. The import step keeps the app import action primary; the final step names the chosen app without claiming to verify connectivity. The support footer stays at the bottom of short steps and follows longer content without covering controls. Panel-authored instructions, button labels, and button icons are preserved. Edit each download button’s localized text in the panel to set its label. Inner step content uses a short fade and slight movement, disabled for reduced motion. The traffic card ends after its full-width QR control, with no details accordion or reserved space. There is no IP test, automatic connection verdict, payment or renewal feature. Registered devices can be deleted directly from the device list without a confirmation dialog.

## Device API

`GET /api/devices`, or `/<CUSTOM_SUB_PREFIX>/api/devices`, returns:

```json
{
  "total": 1,
  "limit": 5,
  "devices": [{
    "id": "<opaque device identifier>",
    "platform": "Android",
    "osVersion": "16",
    "deviceModel": "Phone",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-10-01T00:00:00.000Z"
  }]
}
```

A valid subscription page issues a separate 30-minute `device_session` signed cookie, restricted to the device route, `HttpOnly`, `SameSite=Lax`, and `Secure` in production. It has its own JWT audience and subscription subject; the existing shared configuration session cannot authorize it. The server re-resolves the subscription owner and checks the current short UUID on every request. The request must include `X-Subscription-Id` matching the signed subject, preventing a different subscription tab from displaying the wrong devices. The browser cannot supply a user ID for deletion; the server always resolves the owner from the signed subscription session. Invalid/expired device authorization returns 401; unavailable panel data/permissions return 503. Responses are `Cache-Control: no-store`. Hardware IDs, panel credentials, user agents and IP addresses are not returned. `DELETE /api/devices` (with the same optional prefix) accepts JSON `{ "id": "<opaque device identifier>" }` and the same session/header. The server checks that the device belongs to the subscription, then calls the panel with its real HWID and verified owner ID. It returns the updated list and count; unknown devices return 404 and malformed bodies return 400. The frontend disables delete actions while a request is pending and retains the list on failure.

A null or zero allowance is displayed as no device limit. Registered devices are not labeled online; update dates are not presented as last connection times.

## Development and verification

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

For live local development, fill in the root `.env` with your panel URL and API token, install dependencies in both applications, then run `npm run start:live` from `frontend`. This builds and starts the backend on port 3010 and Vite on `127.0.0.1:3334`. Open the real subscription path on that local origin (including `CUSTOM_SUB_PREFIX`, if configured). Subscription hydration, configuration and device requests use the backend; credentials stay server-side. Frontend edits update through Vite. Restart after panel configuration or backend changes. Set `LOCAL_BACKEND_PORT` if port 3010 is occupied.
Preview synthetic data with `node tests/dev-server.mjs` from `frontend`, then open `http://127.0.0.1:3334/demo`. No panel credentials or real user data are required. The fixture server is excluded from production.

```sh
cd backend
npm ci
npm run typecheck
npm run lint
npm test
NODE_ENV=production npm run build
```

Production container validation from the repository root:

```sh
docker build -t green-subpage:test .
node scripts/compatibility-smoke.mjs --docker green-subpage:test
```

BuildKit automatically supplies `BUILDPLATFORM`; legacy builders default the frontend compiler to AMD64. On a legacy ARM64 builder, pass `--build-arg BUILDPLATFORM=linux/arm64`. The frontend is built once on the build host for both image architectures. Runtime architecture and backend dependencies remain target-specific. Docker builds both applications from clean sources; secrets and local dependencies are excluded.

The production mock-panel smoke verifies unchanged hydration/config responses, subscription forwarding, credentials, proxy/prefix behavior and health; it also checks separate device authorization, owner isolation, expired cookies, missing permissions, revoked links, empty lists, limits, and private metadata exclusion. Browser tests exercise all seven platforms, alternatives, back/reopen, support, copy/QR, visibility, and responsive/RTL/reduced-motion behavior.

## Local container builds

Build and run from local sources with the separate development Compose file:

```sh
docker compose -f docker-compose-dev.yml up -d --build
```

This builds for the local Docker host architecture and uses the existing `.env`. It runs on the same port as production; stop the existing container before switching. It does not publish to GHCR or run the CI checks. Repeated builds reuse Docker's local layer cache.

To publish locally, first commit the release sources and set `RELEASE_VERSION` to a new, unused version. Install Docker Buildx and configure a builder that supports both target platforms (Docker Desktop normally provides emulation; Linux may need additional setup). Authenticate with a GitHub personal access token (classic) with `write:packages` and access to this package; enter it at Docker's password prompt:

```sh
docker login ghcr.io -u tlsenjoyer
# One-time setup for a dedicated builder:
docker buildx create --name subpage-release --driver docker-container
```

Build and push the same two architectures and tags as GitHub Actions:

```sh
release_version="$(cat RELEASE_VERSION)"
docker buildx build --builder subpage-release \
  --platform linux/amd64,linux/arm64 \
  --build-arg RELEASE_VERSION="v${release_version}" \
  --build-arg VCS_REF="$(git rev-parse HEAD)" \
  -t "ghcr.io/tlsenjoyer/remnawave-subscription-page:v${release_version}" \
  -t ghcr.io/tlsenjoyer/remnawave-subscription-page:latest \
  --push .
```

Local builds can be faster with a warm cache and a powerful machine. Building just the server's architecture is usually faster than building both, especially when the other architecture requires emulation. If you change `--platform` to only `linux/amd64` or `linux/arm64`, both published tags will support only that architecture. Run the verification commands above before publishing locally. Tag pushes still trigger the existing Actions publisher; do not run both publishers for the same version. Update the production Compose image tag to deploy the new release.

References: [Docker multi-platform builds](https://docs.docker.com/build/building/multi-platform/), [GHCR authentication](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry).

## Release and rollback

PRs and main run validation. Stable `vX.Y.Z` tags publish AMD64/ARM64 manifests to GHCR using `GITHUB_TOKEN`; the tag must match `RELEASE_VERSION`. v2.2.1 and `latest` use the same release image. The upstream embedded compatibility version remains independent. Verify the public manifest and an anonymous pull after publication.

Keep the v1.0.0 image and your old panel configuration for rollback. Restore both, then recreate/restart the container. No database migration is introduced. Health and startup logs confirm readiness; device failures remain visible in the modal with retry and support.

## Upstream and license

Derived from [remnawave/subscription-page](https://github.com/remnawave/subscription-page), baseline `2a125d180240bb4f373871daf1100f9bb0e2ae3f` (v8.0.0). Upstream attribution and [AGPL-3.0-only license](LICENCE) are retained. Fork source: [tlsenjoyer/remnawave-subscription-page](https://github.com/tlsenjoyer/remnawave-subscription-page).
