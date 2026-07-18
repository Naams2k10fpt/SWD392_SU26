CREATE DATABASE IF NOT EXISTS lucy_phase2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucy_phase2;

SOURCE database/schema.sql;
SOURCE database/seed-sample.sql;
SOURCE generated/digitized-content.sql;
SOURCE database/phase2-realtime.sql;
