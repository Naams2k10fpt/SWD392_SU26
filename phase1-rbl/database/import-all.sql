CREATE DATABASE IF NOT EXISTS lucy_phase1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lucy_phase1;

SOURCE database/schema.sql;
SOURCE database/seed-sample.sql;
SOURCE generated/digitized-content.sql;

mariadb -u root -p lucy_phase1 < database/schema.sql
mariadb -u root -p lucy_phase1 < database/seed-sample.sql
mariadb -u root -p lucy_phase1 < generated/digitized-content.sql


