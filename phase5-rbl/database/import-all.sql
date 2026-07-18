CREATE DATABASE IF NOT EXISTS lucy_phase5 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucy_phase5;

SOURCE database/schema.sql;
SOURCE database/seed-sample.sql;
SOURCE generated/digitized-content.sql;
SOURCE database/phase2-realtime.sql;
SOURCE database/phase3-lms.sql;
SOURCE database/phase4-monetization.sql;
SOURCE database/phase5-stress-evaluation.sql;
