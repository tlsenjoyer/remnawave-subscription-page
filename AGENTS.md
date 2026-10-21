# Subscription page design guidelines

## Direction and references

Build a calm, practical subscription utility. Connection setup is the primary task.
Use the typography, measured spacing, compact buttons, thin rules, and slim meters
from [Onward Summit](https://github.com/Kedhareswer/21stdev-my-components/tree/main/components/onward-summit-template).
Use the supplied interactive Perlin waves as a subtle full-page background.
Keep the existing Mantine components, CSS modules, and `src/shared/ui` structure;
these references do not require installing shadcn, Tailwind, or animation libraries.

## Color and appearance

- `frontend/src/global.css` owns the user's HSL tokens. Consume them with
  `hsl(var(--token))`; keep Mantine colors synchronized with those tokens.
- Light: near-white background (0 0% 98%), white cards, cool charcoal text
  (200 10% 15%), primary green (150 100% 25%).
- Dark: cool charcoal background (200 10% 10%), cards (200 10% 14%), near-white
  text (0 0% 95%), primary green (150 100% 30%).
- Follow device appearance initially. The header switch stores a user override.
- Reserve green for primary actions, active selections, and healthy status.
  Use semantic warning/error colors for subscription states and traffic limits.
- For small text in dark mode, lighten primary green; darken filled green buttons
  enough to keep white labels at a minimum 4.5:1 contrast against the fill.
- Content surfaces are opaque. Avoid colored page washes, decorative gradients,
  glows, glass effects, and arbitrary hardcoded surface colors.

## Typography, spacing, and geometry

- Reuse Inter and the existing language/font fallbacks. Do not add font requests.
- Headlines: weight 500–600, tracking around -0.04em, line height 1.05–1.15.
  Main headline: 36px mobile, 40–48px desktop; setup step headings: 28–36px.
- Body: 16px with 1.5–1.6 line height. Supporting labels: 12–14px.
  Use tabular numerals for traffic and step numbers.
- Use a 4px spacing rhythm: 8/12px within controls, 16/24px between groups,
  24/32px panel padding, 48/64px between major desktop areas.
- Keep the main container around 1040px and the setup reading width around
  760px. Use 16–20px side gutters on mobile. Allow long translations to wrap.
- Base corner radius: 8px; buttons/inputs: 6px; progress tracks: 3px.
  Prefer 1px neutral borders and minimal shadows to separate content.
- Buttons use weight 500, compact labels, and clear focus states. Primary
  actions are at least 44px high. Mobile actions must fit without clipping.
- Traffic tracks are 6px high. Preserve meaningful values, unlimited states,
  thresholds, labels, and accessible progress semantics.

## Layout and motion

- Give connection setup the strongest hierarchy. On desktop, pair it with
  subscription usage; stack connection first on mobile. Keep devices and
  support quieter, and the connection action within the initial mobile viewport.
- Carry the same design through installation, import, QR,
  completion, support, and device dialogs. Preserve all platforms and languages.
- Wave lines use low-opacity theme green around solid content, never interfere
  with interaction or scrolling, and remain decorative (`aria-hidden`).
- Animate canvas state outside React rendering; cap pixel density and frame rate,
  pause when the document is hidden, and clean up observers/listeners/frames.
- Respect `prefers-reduced-motion`: draw static waves and remove transitions.
  Do not autoplay text or animate the primary controls.

## Verification and functional boundaries

- Keep subscription URL copy and the QR popup on the main summary, below the
  reset caption. The QR button fills the content width. Show status once beside
  the plan, with muted expiry underneath. There is no details accordion or
  reserved space. Desktop cards stretch to the same height with aligned top and
  bottom edges, with the connection and QR buttons aligned vertically at the
  bottom and 32px vertical padding. Mobile cards follow their content height;
  place the connection button 28–32px below the introduction on mobile.
- Keep the wizard at one 760px reading width. Every step uses the same solid
  panel, 32px desktop / 24px mobile vertical padding, left-aligned heading, border,
  and radius. Let height follow content; never narrow the final step.
- Keep step indicators first, Back and continuation in shared navigation below
  the panel, and one quiet support link beneath navigation on every step.
  Animate only inner content with a short fade and 5px movement; respect reduced motion.
- Use “Установите приложение” for step one. Separate device selection from the
  compact app header. Change apps with an overlaid menu, preserving selection.
  Make the main download specific to the platform and keep alternate download routes.
- Carry the selected platform/app into subscription import and name the app in
  the completion instructions. Preserve panel-authored instructions and button icons.
  Keep import primary and continuation outlined. The wizard has no raw-key accordion
  or QR control; manual link copy is available only in the import fallback disclosure.
- Preserve subscription URL construction, client links, clipboard/QR actions,
  platform recommendations, device fetching, warnings, and support contacts.
- Preserve keyboard access, focus restoration, RTL layout, contrast, and touch
  scrolling. Setup completion must not claim that the VPN is connected.
- Inspect actual Playwright screenshots at desktop and mobile widths in both
  themes, including the setup wizard. Run type checks and existing flow tests.
- Keep fixture-based verification distinct from real panel/client integration.
- Preserve unrelated uncommitted work. No new dependencies for this redesign.
