# SIMA Launch Mini Checklist

## Quick Go/No-Go

- [x] Chat: не зацикля на `Thinking...`, стабилен е на mobile.
- [x] Marketplace: филтри + търсене (вкл. BG alias-и) работят коректно.
- [x] My Watchlist / My Cabinet: save, alerts и преходи работят.
- [x] Pricing: плановете са ясни, има концепция и ползи.
- [x] Forms: `Contact` и `Register` изпращат успешно.
- [ ] Vercel: Preview и Production deploy са зелени.
- [x] Env/Security: ключовете са само в environment settings.
- [x] BG/EN: локализацията е консистентна.
- [ ] Smoke test: desktop + mobile ключови сценарии минават.
- [ ] Final gate: ако всичко горе е готово -> PR merge + soft launch.

---

Owner:
Date: 2026-04-30
Decision: `IN PROGRESS`

## Build Verification (today)

- [x] `npm run typecheck`
- [x] `npm run build`
- [x] Handler smoke test: `handleContactPost` / `handleRegisterInterestPost`
- [x] Handler smoke test: `handleChatPost` връща контролиран error path при upstream quota/network проблем.
- [x] Git env check: `.env` е ignore-нат, `.env.example` е наличен в repo.
- [ ] Manual UI smoke test (desktop + mobile) предстои.
