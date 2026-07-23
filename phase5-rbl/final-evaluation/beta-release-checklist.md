# Beta Release Checklist

- Confirm Phase 1 content import output exists in `generated/` and DB scripts can be reviewed.
- Confirm .NET auth issues JWT for Anonymous, Pro, and Super roles.
- Confirm room password, join/retry after F5, leave confirmation, raise hand, mic,
  speaking indicator and latency ping.
- Confirm chat is bounded and PRO/SUPER documents stay in the collapsible file panel.
- Confirm only PRO/SUPER can record/upload audio and manage podcasts.
- Confirm Java LMS transitions sub-level after 10 minutes using State pattern logic.
- Confirm Super Chat only targets PRO/SUPER in-room; gift history only returns the
  current user's sent/received transactions.
- Confirm Wallet Swagger is available at `http://localhost:5041/swagger`.
- Run stress scenario at 500 users, then 1000 users if local/cloud resources allow.
- Record known scaffold limitations: Agora token placeholder, payment-provider placeholder, missing idempotency/outbox hardening.
