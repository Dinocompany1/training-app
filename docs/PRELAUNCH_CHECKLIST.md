# Prelaunch Checklist (Before TestFlight)

## 1) Build and Run
- [ ] `npm install`
- [ ] `npm run lint`
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npx expo run:ios` works on simulator
- [ ] Manual smoke test on physical iPhone

## 2) Core Flows QA
- [ ] Starta snabbpass -> avsluta -> spara
- [ ] Planera framtida pass -> syns i kalender
- [ ] Skapa rutin -> använd rutin i pass
- [ ] Redigera pass -> spara -> data kvar efter app restart
- [ ] Ta bort pass/rutin/bild -> ångra fungerar via toast
- [ ] AI coach svarar och fallback fungerar när backend är offline

## 3) Offline and Recovery
- [ ] Stäng av internet -> appen fungerar lokalt
- [ ] Starta pass, stäng appen, återuppta pass fungerar
- [ ] Export/backup fungerar utan crash

## 4) Permissions and Platform
- [ ] Foto-behörighet prompt visas korrekt
- [ ] Ingen blockerande alert-loop i normalt flöde
- [ ] UI fungerar på liten och stor iPhone-skärm

## 5) App Store Compliance
- [ ] Privacy Policy URL klar och publik
- [ ] Terms of Use URL klar och publik
- [ ] App Privacy-formulär ifyllt i App Store Connect
- [ ] App screenshots + app icon + metadata klara
- [ ] Support URL och kontaktmail klara

## 6) Release Config
- [ ] `.env` har rätt värden för release
- [ ] Inga hemliga server-nycklar i klienten
- [ ] EAS production build fungerar (`eas build -p ios --profile production`)
- [ ] TestFlight build installerad och testad

## 7) Beta Gate (Go/No-Go)
- [ ] 0 kritiska crashar
- [ ] 0 blockerande buggar i core flows
- [ ] Alla copy/texter granskade
- [ ] Minst 3 externa testare har kört appen

