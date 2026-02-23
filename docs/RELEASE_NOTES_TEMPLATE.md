# Release Notes Template

## Version
- App version: `1.0.0`
- Build number: `ios.buildNumber` / `android.versionCode`
- Release date: `YYYY-MM-DD`

## Highlights
- Premium UI polish across core flows
- Improved quick workout completion flow with in-app finish sheet
- Non-blocking toasts + undo actions for deletes
- Better sync status and app stability handling

## Fixes
- Correct reps parsing in training frequency
- Improved ID generation and navigation consistency
- Better typed persistence for ongoing quick workouts
- Reduced blocking alerts in critical paths

## Known Issues
- Add any known non-blocking bugs here

## Upgrade Notes
- Run:
  - `npm install`
  - `npm run preflight`
- Rebuild dev client after dependency updates:
  - `npx expo run:ios`

