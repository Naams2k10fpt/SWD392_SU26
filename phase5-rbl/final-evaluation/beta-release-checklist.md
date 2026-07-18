# Beta Release Checklist

- Confirm Phase 1 content import output exists in `generated/` and DB scripts can be reviewed.
- Confirm .NET auth issues JWT for Anonymous, Pro, and Super roles.
- Confirm Node real-time room supports join, raise hand, mic toggle, and latency ping.
- Confirm Java LMS transitions sub-level after 10 minutes using State pattern logic.
- Confirm .NET wallet can top up, send gift transaction, and store podcast metadata.
- Confirm Swagger is available for .NET APIs.
- Run stress scenario at 500 users, then 1000 users if local/cloud resources allow.
- Record known scaffold limitations: Agora token placeholder, payment-provider placeholder, missing idempotency/outbox hardening.
