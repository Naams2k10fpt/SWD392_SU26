# Phase 3 Java LMS Module

Minimal Java/Maven module for RBL SWD392 Phase 3: Pro/Mentor LMS, pinned materials, learner dashboard summary, and automatic sub-level transitions.

## Design pattern choice

The module uses the **State pattern** for sub-level transitions. Each sub-level owns its transition rule through `SubLevelState`, avoiding a fragile IF-ELSE chain when Stage 1-3 later add different timing or unlock rules. The dashboard acts like a simple observer/consumer of refreshed learner progress, but the core automatic Stage logic is State-based.

## Run

```bash
mvn compile
mvn exec:java -Dexec.mainClass=com.lucy.lms.LmsApplication
```

## Current scaffold flows

- Pro/Mentor pins English/Japanese materials.
- Mentor dashboard tracks learner level and current sub-level.
- `StageTransitionEngine` moves a learner to the next sub-level after 10 minutes.
- The module reads/writes MariaDB tables `mentor_material_pins`, `learner_progress`, and `lms_transition_events`. Configure with `LUCY_JDBC_URL`, `LUCY_DB_USER`, and `LUCY_DB_PASSWORD` if your local database is not `jdbc:mysql://localhost:3306/lucy_phase4` with root/no password.
