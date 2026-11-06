# Show Up for Android

## Install the live app today

Open https://show-up-rhythm.vercel.app/ in Chrome on Android. In the three-dot menu, choose **Add to Home screen**, then **Install**. If offered, you can use **Install app** inside Show Up instead. Open **Show Up** from the Android launcher. Its web app shell works offline once cached.

## Package it as an APK

This project uses Android Browser Helper to launch the same site through a Trusted Web Activity. It keeps browser-backed storage and the browser's Google OAuth flow.

1. Open this directory in Android Studio with JDK 17 and Android SDK Platform 36. Sync with Gradle 8.13 or a compatible Gradle distribution.
2. Select **Build > Generate Signed Bundle / APK**. Pick **APK** for sideloading or **Android App Bundle** for a Play release. Use a signing key you control and keep it in a secure backup. Use package name `app.showup.rhythm` for this project.
3. Get the SHA-256 fingerprint for the certificate used on the installed build. For Play distribution with Play App Signing, use the Play app signing certificate, not the upload key. Use this file format at `https://show-up-rhythm.vercel.app/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.showup.rhythm",
      "sha256_cert_fingerprints": ["REPLACE_WITH_SIGNING_CERT_SHA256"]
    }
  }
]
```

Place it in `public/.well-known/assetlinks.json` and redeploy the site. The browser falls back to a Custom Tab until it can verify that fingerprint. Install the signed APK on an Android device, launch it, and check navigation and sign-in. See [Android's Trusted Web Activity guide](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2).

This archive contains the Android project sources. The current workspace has no Android SDK or Gradle distribution to produce and test a signed APK.
