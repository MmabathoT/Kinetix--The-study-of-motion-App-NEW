# Kinetix — web prototype (plain HTML/CSS/JS)

A simplified, Strava-style fitness-tracking-and-social prototype for
Reabetswe Technologies, built with no framework and no build step —
so it runs anywhere, including a locked-down work laptop.

## Why plain HTML/CSS/JS
No npm, no Node, no bundler, nothing that touches your machine's
execution policy. The browser runs this as-is.

## Running it
**Easiest:** double-click `index.html` and it opens in your browser.

**With live-reload while you edit (recommended in VS Code):**
1. Install the **Live Server** extension (by Ritwick Dey) from the Extensions panel.
2. Right-click `index.html` in the file explorer → "Open with Live Server."
3. It opens in your browser and refreshes automatically whenever you save.

No terminal commands required for either option.

## Packaging for Android and iOS
The app can be packaged with Capacitor while keeping the existing plain
HTML/CSS/JavaScript code.

### Android on Windows
Install Node.js (already installed if `npm --version` works), Android Studio,
and a JDK 17 or newer. In this folder run:

```powershell
npm install
npx cap add android
npm run copy:web
npx cap open android
```

Build the signed release in Android Studio, then upload the generated Android
App Bundle (`.aab`) to Google Play Console.

### iPhone and iPad
iOS apps must be built and signed with Xcode on macOS. Copy this folder to a Mac,
install Xcode and CocoaPods, then run:

```bash
npm install
npx cap add ios
npm run copy:web
npx cap open ios
```

In Xcode, select an Apple Developer team, configure the bundle identifier,
archive the app, and submit it to App Store Connect. A cloud Mac build service
is an alternative if you do not have access to a Mac.

### Optional VS Code extension
No special extension is required. The **Live Server** extension is useful for
browser development, while Android Studio and Xcode provide the native build
tools.

## What's included
- **Feed** — a social scroll of friends' activities with distance/time/pace and kudos/comments
- **Record** — pick a sport, start/pause/stop, a simulated live GPS route and timer
- **History** — your saved activities, newest first (session-only — refreshing clears it, since there's no backend yet)
- **Profile** — lifetime stats
- A **shareable card** generated after saving an activity

## What's simplified from the fuller version
This version drops segments/leaderboards and the multi-step onboarding to
keep the codebase easy to read and extend. The route map is a drawn SVG
line, not a real map — see `kinetix-backend-schema.md` (from earlier) for
how real GPS tracking and a database would plug in behind this UI.

## Files
- `index.html` — markup for all four screens plus the welcome and share overlay
- `style.css` — the purple/blue theme, phone-frame layout, responsive rules
- `script.js` — all app state and interactivity (tabs, recording, history, sharing)
