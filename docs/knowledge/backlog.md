# Feature backlog

Requests captured as they come up, before they are designed. Each links to where it was raised or decided.

## Frictionless ingest on phones (requested 2026-10-09; built 2026-10-09)

Getting images into Warholizer should take one gesture on a phone, as on a desktop:

1. **Paste.** Copy an image anywhere and paste it in. Desktop paste works today (Composer listens for paste). Phones need a visible **Paste** button, because there is no keyboard shortcut: the Async Clipboard API (`navigator.clipboard.read()`) reads images after the person taps it.
2. **Share to Warholizer.** Warholizer appears in the system share sheet as a target. This is a PWA feature: a web app manifest with a `share_target` that accepts image files (`POST`, `multipart/form-data`), handled by a service worker that stores the files and opens Composer with them. To verify: Android Chrome supports installed PWAs as share targets; iOS Safari has not supported Web Share Target, so iPhone may need another path (for example a Shortcut, or the paste and pick paths).
3. **Pick several from the photo library.** Selecting 3 or 4 photos at once must keep working: `<input type="file" accept="image/*" multiple>` (the "+" in Composer's input strip) opens the phone's photo picker with multi-select.

Status: built. Composer has a **Paste** button where the Async Clipboard API exists; `public/manifest.json` declares a `share_target` posting `photos` to `/composer/share`, which `public/sw.js` stores in the Cache API and hands to Composer (`?shared=n`); shared photos replace the samples. Install the app (Add to Home screen) for it to appear in the share sheet. iPhone: Safari does not offer web apps as share targets; use Paste or the photo picker.

Related: the cloud images library (ADR 0001; wireframe B3, Camera / Upload / Paste). Ingested images should land in the library once cloud storage exists, and in the current composition's input either way.
