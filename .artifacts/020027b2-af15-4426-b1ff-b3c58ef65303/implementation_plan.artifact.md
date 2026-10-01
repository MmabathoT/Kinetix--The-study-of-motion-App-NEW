# Play Store Preparation for Kinetix

This plan outlines the steps to prepare the **Kinetix** app for submission to the Google Play Store. Since this is a Capacitor-based project, we will focus on configuring the Android platform and generating a production-ready App Bundle.

## User Review Required

> [!IMPORTANT]
> **Google Play Developer Account**: You must have a registered Google Play Developer account ($25 one-time fee) to upload the app.
> **App Signing**: We will need to generate a Keystore file. This file is **CRITICAL**; if you lose it, you will never be able to update your app again. I will guide you through creating one, but you must store it safely.
> **Store Assets**: You will need to provide screenshots, a high-res icon (512x512), and a feature graphic (1024x500) directly in the Play Console.

## Proposed Changes

### 1. Branding & Assets

We will replace the default Capacitor icons with your custom branding.

#### [MODIFY] [Launcher Icons](file:///C:/Users/MmabathoTsatsimpe/OneDrive%20-%20NWPG/Mmabs%20Personal/Kinetix-The%20study%20of%20motion%20NEW/android/app/src/main/res/)
- Generate and replace mipmap icons using `Kinetix Logo running.png`.

#### [MODIFY] [Splash Screen](file:///C:/Users/MmabathoTsatsimpe/OneDrive%20-%20NWPG/Mmabs%20Personal/Kinetix-The%20study%20of%20motion%20NEW/android/app/src/main/res/drawable/ic_launcher_background.xml)
- Configure the splash screen to use your logo.

### 2. Android Configuration

#### [MODIFY] [build.gradle](file:///C:/Users/MmabathoTsatsimpe/OneDrive%20-%20NWPG/Mmabs%20Personal/Kinetix-The%20study%20of%20motion%20NEW/android/app/build.gradle)
- Update `versionCode` (e.g., `1`) and `versionName` (e.g., `"1.0.0"`).
- Set up the release signing configuration once the keystore is ready.

#### [MODIFY] [AndroidManifest.xml](file:///C:/Users/MmabathoTsatsimpe/OneDrive%20-%20NWPG/Mmabs%20Personal/Kinetix-The%20study%20of%20motion%20NEW/android/app/src/main/AndroidManifest.xml)
- Verify permissions (Internet is already there).
- Ensure the app is not debuggable in release mode.

### 3. Build & Signing

- Generate a release keystore using the `keytool` command.
- Build the Android App Bundle (AAB) using Gradle: `./gradlew bundleRelease`.

## Verification Plan

### Automated Tests
- Run `./gradlew lintRelease` to check for potential issues before submission.

### Manual Verification
- **Installation Test**: Install the generated APK on a physical device to ensure the web content loads correctly and icons look good.
- **Play Console Pre-launch Report**: Once uploaded, check the Play Console for any compatibility issues found during their automated testing.
