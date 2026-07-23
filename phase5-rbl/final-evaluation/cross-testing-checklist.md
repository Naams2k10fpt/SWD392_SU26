# Cross-testing Checklist

- Another group reads `RBL_SWD392.docx` scope and confirms phase mapping.
- Another group runs auth register/login and tests invalid duplicate email.
- Another group joins two Socket.IO clients to one room and verifies room state broadcast.
- Another group verifies wrong room password is rejected and F5 retries the saved room.
- Another group verifies chat length/scrolling and PRO/SUPER-only document/recording actions.
- Another group reviews Java LMS pattern choice and explains why State is safer than IF-ELSE.
- Another group sends Super Chat in-room and confirms each account only sees its own
  sent/received gift history.
- Another group creates, replaces audio, renames and deletes a podcast as PRO/SUPER.
- Another group reviews stress-test thresholds and reports p95 latency and failure rate.
