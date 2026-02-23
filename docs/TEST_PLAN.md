# Test Plan (Pre-TestFlight)

## Scope
This plan covers critical user journeys, data safety, and launch blockers.

## Devices
- iPhone with small screen (e.g. iPhone SE size)
- iPhone with modern large screen (e.g. iPhone 15/16 size)

## Functional Cases
- Start quick workout -> log sets -> finish -> save template/home actions
- Plan future workout -> appears in calendar -> start from planned item
- Create routine -> save -> start routine from templates/history
- Edit workout detail -> save -> verify persistence after app restart
- Delete workout/template/photo -> Undo from toast works
- AI coach screen loads and fallback works when backend is unavailable

## Data Integrity
- Close app mid quick workout -> resume flow restores state
- Offline mode: create/edit data without crash
- Reopen app: no lost local data

## UX & Quality
- No blocking success alerts in normal happy-path flows
- Buttons/spacing/typography consistent across tabs
- Error messages appear as toasts where expected

## Permissions
- Photo permission denied -> app handles gracefully
- Photo permission granted -> select and save works

## Regression Checklist
- Home, Add, Calendar, Stats, Profile all open without runtime errors
- Lint/typecheck/tests are green before build

## Exit Criteria
- 0 critical crashes
- 0 data-loss bugs
- 0 blocker bugs in core flows
- At least 3 external testers complete core flow

