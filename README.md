# Kinetix — web and Android app

A fitness-tracking prototype for Reabetswe Technologies, built with plain
HTML/CSS/JS and a small Node.js service for optional live location sharing.

## Run locally
Install Node.js, then run:

```powershell
npm install
npm run copy:web
npm start
```

Open `http://localhost:3000`. The Node service hosts the app, creates live-share
sessions, and relays GPS updates over WebSockets.

## Live location sharing
On Record, enable **Share**, start recording, and allow location access. Use
**Share link** to send the private viewer link. The recipient does not need a
Kinetix account. Stop sharing from Record or stop the activity to end the link.

Location is sent only after the user opts in. Live sessions are kept in memory,
not written to disk, and expire after two hours. Restarting the service ends all
active links. The viewer uses OpenStreetMap tiles and shows the route only while
the link is valid. Keep the app open while sharing; background location service
is not included yet.

For sharing between phones, deploy `server.js` behind a public HTTPS reverse
proxy and set `KINETIX_PUBLIC_URL` to the public service origin. Set
`KINETIX_ALLOWED_ORIGIN` to the app origin when TLS terminates at the proxy,
including same-origin deployments. If the proxy overwrites `X-Forwarded-For`,
set `KINETIX_TRUST_PROXY=true` so per-IP limits use the real client address; only
enable this behind a trusted proxy. The proxy must forward WebSocket upgrades as
well as HTTP requests. In Android, enter the HTTPS service origin under
**Settings > App > Live location server**. Do not use `localhost` on another
phone. The service allows 100 active sessions globally and three per client IP.

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
- **Record** — pick a sport, track an activity, and optionally share live GPS location
- **History** — local activities grouped by sport and month
- **Profile** — lifetime stats
- A **shareable card** generated after saving an activity

## What's simplified from the fuller version
This version drops segments and leaderboards. Live sessions are ephemeral and
the route viewer is separate from local activity history. Live GPS sharing
requires an internet connection and public HTTPS deployment.

## Files
- `index.html` — markup for all four screens plus the welcome and share overlay
- `style.css` — the purple/blue theme, phone-frame layout, responsive rules
- `script.js` — all app state and interactivity (tabs, recording, history, sharing)
