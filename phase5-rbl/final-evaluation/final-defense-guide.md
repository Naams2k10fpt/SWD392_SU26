# Final Defense Guide

## Architecture defense

Explain the system as four services/modules: Java content/LMS, .NET identity, Node real-time audio, and .NET wallet/monetization. Phase folders are cumulative so each later phase includes all previous work.

## Risk defense

- Agora/payment are MVP scaffolds, not production integrations.
- MariaDB persistence is used for demonstrable behavior; production still needs payment-provider verification, idempotency, audit log, and event outbox.
- Gift sync risk: wallet commit must happen before Socket.IO broadcast, with idempotency for retries.
- Auth-to-Node risk: .NET identity should issue anonymous/pro/super token consumed by Node middleware.

## Demo path

1. Show digitized source outputs from Phase 1.
2. Register/login in `.NET auth`.
3. Request real-time token scaffold and join Socket.IO room.
4. Run Java LMS dashboard and show sub-level transition.
5. Open wallet Swagger and perform top-up/gift/podcast metadata calls.
6. Run or explain k6 stress test for 500-1000 users.
