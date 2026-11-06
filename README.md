# Show Up

A personal web app for habits, placement prep, recurring plans, Delhi outings and weekly reflection. Run locally with `python3 -m http.server 8080 --directory public` and visit http://localhost:8080. The app stores entries on the device immediately. The included Vercel config serves `public/`. The service worker caches the core pages after the first successful visit.

## Google sign-in and automatic sync

The [live app](https://show-up-rhythm.vercel.app/) uses its own Supabase project. A fresh checkout starts in device-only mode. Set up your own project to enable Google sign-in and sync.

1. Create a dedicated Supabase project. Run `supabase/setup.sql` in its SQL editor. Keep `show_up_private` out of the Data API's exposed schemas.
2. Create a Web application OAuth client in your own Google Cloud project. In the authorized redirect URIs, add `https://PROJECT_REF.supabase.co/auth/v1/callback` from your Supabase Google provider settings. Set up the Google consent screen and add test users if Google leaves it in Testing.
3. Enable Google in Supabase Authentication > Sign In / Providers and enter the OAuth client ID and secret there. Keep the Google client secret in Supabase.
4. In Supabase Authentication > URL Configuration, set the site URL and allow the exact production app URL, including its trailing slash. Add `http://localhost:8080/` for local development if needed.
5. Put the Supabase project URL and **publishable** key in `public/config.js`. Redeploy. Verify on two browser profiles with Google accounts that a habit log syncs across your devices and that another account cannot read it. Create an invite in Plans and use a signed-out profile to test an RSVP.

Follow the [Supabase Google sign-in guide](https://supabase.com/docs/guides/auth/social-login/auth-google) for the current Google console steps. Cloud sync is optional at runtime. The site shows a device-only status until configured.

## Android

Install the live app from Chrome on Android through **Add to Home screen > Install**. The [Android project](android/README.md) includes a separate Android Studio wrapper for packaging as an APK.

## Privacy and portability

Each account has its own private cloud rows. Local changes are queued until they sync. If two devices edit the same item, the newer edit by device timestamp wins. Deletions also sync. Google sign-in identifies the account. Supabase stores the synced records. Backups can be downloaded as JSON, kept in Google Drive, and imported again. Treat backups as private.

An RSVP link shares only that plan's title, location, time, note and replies for the selected date. Anyone with the link can view and respond. The host can disable the link. A calendar export can repeat weekly and includes a 30-minute event alarm. Actual reminders depend on the calendar app. Focus timers run in the app.

## Research notes

- [Lally et al.](https://doi.org/10.1002/ejsp.674) measured changes in automaticity during repeated behavior in a stable context. The finding about one missed opportunity informed the absence of streak resets.
- The [NCI overview of implementation intentions](https://cancercontrol.cancer.gov/brp/research/constructs/implementation-intentions) explains how a cue can be linked to a specific action.
- [Reddit discussion on broken streaks](https://www.reddit.com/r/getdisciplined/comments/1s0um3d/) and [a report of switching to paper tracking](https://www.reddit.com/r/Habits/comments/1rz00yu/) informed the weekly view and quick logging. These are user reports.
