# Database Design Document — LUCY SWD392

| **Tên dự án** | LUCY (Language Unity & Collaborative Youth) |
|---|---|
| **Phiên bản** | 1.2.0 |
| **Ngày cập nhật** | 2026-07-23 |
| **Loại tài liệu** | Database Design |
| **DBMS** | MariaDB 12.2 |
| **Charset** | utf8mb4 + utf8mb4_unicode_ci |

---

## Mục lục

- [1. Database Isolation Strategy](#1-database-isolation-strategy)
- [2. Entity List theo Domain](#2-entity-list-theo-domain)
- [3. Entity Relationship Diagram](#3-entity-relationship-diagram)
- [4. Indexing Strategy](#4-indexing-strategy)
- [5. Migration Scripts](#5-migration-scripts)
- [6. Seed Data](#6-seed-data)

---

## 1. Database Isolation Strategy

Tất cả service dùng chung 1 MariaDB instance (localhost:3306) nhưng tách biệt theo phase:

| Database | Phase | Tables | Mục đích |
|---|---|---|---|
| lucy_phase1 | 1 | 10 | Auth + Learning Content (users, roles, languages, stages, levels, lessons, content_blocks) |
| lucy_phase2 | 2 | 13 | Phase 1 + Realtime (realtime_rooms, participants, latency) |
| lucy_phase3 | 3 | 16 | Phase 2 + LMS (mentor_material_pins, learner_progress, transitions) |
| lucy_phase4 | 4 | 20 | Phase 3 + Monetization (wallet_accounts, transactions, gifts, podcasts) |
| lucy_phase5 | 5 | 24 | Phase 4 + Stress Test + room chat/recording logs |

**Migration**: Import thủ qua `database/import-all.sql`, script này chạy tuần tự:
```
import-all.sql
├── schema.sql               # Auth + Learning Content tables
├── seed-sample.sql          # Seed roles, languages
├── generated/digitized-content.sql  # Digitized learning content
├── phase2-realtime.sql      # Realtime tables
├── phase3-lms.sql           # LMS tables
├── phase4-monetization.sql  # Monetization tables
├── phase5-stress-evaluation.sql  # Stress test tables
└── phase5-realtime-chat-record.sql # Chat và recording logs
```

---

## 2. Entity List theo Domain

### Auth Domain (Phase 1)

| Table | Columns | Ghi chú |
|---|---|---|
| **roles** | id (CHAR 36 PK), name (VARCHAR 32 UNIQUE), description (TEXT) | 3 roles: Anonymous, Pro, Super |
| **users** | id (CHAR 36 PK), email (VARCHAR 255 UNIQUE), display_name (VARCHAR 120), password_hash (TEXT), status (VARCHAR 32), created_at (TIMESTAMP) | Status: ACTIVE, BANNED, INACTIVE |
| **user_roles** | user_id (CHAR 36 FK), role_id (CHAR 36 FK) | Composite PK, many-to-many |

```sql
CREATE TABLE users (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(120) NOT NULL,
    password_hash TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Learning Content Domain (Phase 1)

| Table | Columns | Ghi chú |
|---|---|---|
| **languages** | id (CHAR 36 PK), code (VARCHAR 10 UNIQUE), name (VARCHAR 80) | en, zh, ja |
| **stages** | id (CHAR 36 PK), language_id (CHAR 36 FK), stage_number (INT), title (VARCHAR 255) | Mỗi ngôn ngữ có 3 stages |
| **levels** | id (CHAR 36 PK), stage_id (CHAR 36 FK), level_number (INT), title (VARCHAR 255) | Stage 1: Levels 1-30, Stage 2: 31-60, Stage 3: 61-100 |
| **lessons** | id (CHAR 36 PK), level_id (CHAR 36 FK), sequence_number (INT), title (VARCHAR 255) | Mỗi level có nhiều lessons |
| **content_blocks** | id (CHAR 36 PK), lesson_id (CHAR 36 FK), block_type (VARCHAR 40), content_text (TEXT), sort_order (INT) | block_type: paragraph, vocabulary, grammar, exercise |
| **source_documents** | id (CHAR 36 PK), file_name (VARCHAR 255), language_code (VARCHAR 10), checksum (VARCHAR 128), status (VARCHAR 32) | Theo dõi file Word gốc đã import |
| **word_import_jobs** | id (CHAR 36 PK), source_document_id (CHAR 36 FK), started_at, completed_at, status, error_message | Log job import Word |

```sql
CREATE TABLE levels (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    stage_id CHAR(36) NOT NULL,
    level_number INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    UNIQUE KEY uq_levels_stage_number (stage_id, level_number),
    CONSTRAINT fk_levels_stage FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Realtime Domain (Phase 2)

| Table | Columns | Ghi chú |
|---|---|---|
| **realtime_rooms** | id (CHAR 36 PK), room_code (VARCHAR 80 UNIQUE), title (VARCHAR 255), language_code (VARCHAR 10), level_number (INT), agora_channel_name (VARCHAR 120 UNIQUE), password_hash (VARCHAR 255 NULL), status (VARCHAR 32), created_at (TIMESTAMP) | `password_hash` là `scrypt` hash; NULL là phòng công khai |
| **realtime_room_participants** | id (CHAR 36 PK), room_id (CHAR 36 FK), user_id (CHAR 36 FK NULL), anonymous_uid (VARCHAR 120), display_name (VARCHAR 120), role_name (VARCHAR 32), mic_enabled (BOOLEAN), hand_raised (BOOLEAN), joined_at (TIMESTAMP), left_at (TIMESTAMP NULL) | left_at NULL = đang trong phòng |
| **realtime_latency_samples** | id (CHAR 36 PK), room_id (CHAR 36 FK), participant_id (CHAR 36 FK NULL), round_trip_ms (INT), sampled_at (TIMESTAMP) | Đo độ trễ round-trip |
| **room_messages** | id, room_id, participant_id, user_id, display_name, message, created_at | Chat và metadata tài liệu; API tách thành hai luồng |
| **recording_logs** | id, room_id, started_by, status, storage_uri, duration_seconds, started_at, stopped_at | Theo dõi phiên ghi âm |

```sql
CREATE TABLE realtime_rooms (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_code VARCHAR(80) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    level_number INT NOT NULL,
    agora_channel_name VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### LMS Domain (Phase 3)

| Table | Columns | Ghi chú |
|---|---|---|
| **mentor_material_pins** | id (CHAR 36 PK), mentor_user_id (CHAR 36 FK NULL), material_title (VARCHAR 255), language_code (VARCHAR 10), stage_number (INT), level_number (INT NULL), pinned_at (TIMESTAMP) | Mentor ghim tài liệu cho learner |
| **learner_progress** | id (CHAR 36 PK), learner_user_id (CHAR 36 FK NULL), anonymous_uid (VARCHAR 120 UNIQUE), display_name (VARCHAR 120), language_code (VARCHAR 10), stage_number (INT), level_number (INT), sub_level (VARCHAR 40), sub_level_started_at (TIMESTAMP), updated_at (TIMESTAMP) | sub_level: WARM_UP, GUIDED_PRACTICE, PEER_EXCHANGE, REFLECTION |
| **lms_transition_events** | id (CHAR 36 PK), learner_progress_id (CHAR 36 FK), from_sub_level (VARCHAR 40), to_sub_level (VARCHAR 40), pattern_name (VARCHAR 80), transitioned_at (TIMESTAMP) | Ghi log mỗi transition |

Các sub-level values:

| Sub-level | Mô tả | Default duration |
|---|---|---|
| WARM_UP | Khởi động, làm quen chủ đề | 10 phút |
| GUIDED_PRACTICE | Thực hành có hướng dẫn | 10 phút |
| PEER_EXCHANGE | Trao đổi với bạn học | 10 phút |
| REFLECTION | Tổng kết, reflection | 10 phút |

```sql
CREATE TABLE learner_progress (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    anonymous_uid VARCHAR(120) NULL,
    display_name VARCHAR(120) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    stage_number INT NOT NULL,
    level_number INT NOT NULL,
    sub_level VARCHAR(40) NOT NULL DEFAULT 'WARM_UP',
    sub_level_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_learner_progress_anonymous_uid (anonymous_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Monetization Domain (Phase 4)

| Table | Columns | Ghi chú |
|---|---|---|
| **wallet_accounts** | id (CHAR 36 PK), user_id (CHAR 36 FK NULL), external_owner_id (VARCHAR 120 UNIQUE), balance (DECIMAL 18,2), currency_code (VARCHAR 10), updated_at (TIMESTAMP) | Mỗi user có 1 wallet, currency mặc định VND |
| **wallet_transactions** | id (CHAR 36 PK), wallet_id (CHAR 36 FK), transaction_type (VARCHAR 40), amount (DECIMAL 18,2), provider_reference (VARCHAR 120), status (VARCHAR 32), created_at (TIMESTAMP) | Type: TOP_UP, GIFT_SENT, GIFT_RECEIVED |
| **gift_transactions** | id (CHAR 36 PK), from_wallet_id (CHAR 36 FK), to_wallet_id (CHAR 36 FK), room_code (VARCHAR 80), amount (DECIMAL 18,2), message (VARCHAR 255), realtime_event (VARCHAR 80), created_at (TIMESTAMP) | realtime_event: gift:sent; lịch sử API chỉ trả giao dịch user hiện tại gửi/nhận |
| **podcast_recordings** | id (CHAR 36 PK), creator_user_id (CHAR 36 FK NULL), creator_external_id (VARCHAR 120), room_code (VARCHAR 80), title (VARCHAR 255), storage_uri (VARCHAR 500), duration_seconds (INT), created_at (TIMESTAMP) | PRO/SUPER quản lý podcast |

```sql
CREATE TABLE wallet_accounts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NULL,
    external_owner_id VARCHAR(120) NOT NULL UNIQUE,
    balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'VND',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Stress Test Domain (Phase 5)

| Table | Columns | Ghi chú |
|---|---|---|
| **stress_test_runs** | id (CHAR 36 PK), run_name (VARCHAR 160), target_virtual_users (INT), p95_latency_ms (INT NULL), failure_rate (DECIMAL 8,4 NULL), notes (TEXT), started_at (TIMESTAMP), completed_at (TIMESTAMP NULL) | Log mỗi lần chạy k6 |
| **cross_testing_reports** | id (CHAR 36 PK), tester_group (VARCHAR 120), tested_group (VARCHAR 120), tested_feature (VARCHAR 160), result (VARCHAR 32), issue_summary (TEXT), created_at (TIMESTAMP) | Kết quả cross-test giữa các nhóm |

---

## 3. Entity Relationship Diagram

### Auth Domain

```
users 1───* user_roles *───1 roles
```

### Learning Content Domain

```
languages 1───* stages 1───* levels 1───* lessons 1───* content_blocks
```

### Realtime Domain

```
realtime_rooms 1───* realtime_room_participants
realtime_rooms 1───* realtime_latency_samples
realtime_rooms 1───* room_messages
realtime_rooms 1───* recording_logs
```

### LMS Domain

```
learner_progress 1───* lms_transition_events
users (mentor) 1───* mentor_material_pins
```

### Monetization Domain

```
users 1───0..1 wallet_accounts 1───* wallet_transactions
wallet_accounts (sender) 1───* gift_transactions *───1 wallet_accounts (receiver)
users (creator) 1───* podcast_recordings
```

### Cross-Domain Relationships

```
users.id ──FK──▶ user_roles.user_id
users.id ──FK──▶ realtime_room_participants.user_id
users.id ──FK──▶ wallet_accounts.user_id
users.id ──FK──▶ learner_progress.learner_user_id
users.id ──FK──▶ mentor_material_pins.mentor_user_id
users.id ──FK──▶ podcast_recordings.creator_user_id
```

---

## 4. Indexing Strategy

| Table | Index | Type | Lý do |
|---|---|---|---|
| users | email | UNIQUE | Tìm kiếm user khi login/register |
| wallet_accounts | external_owner_id | UNIQUE | Tìm wallet theo userId nhanh |
| gift_transactions | from_wallet_id | INDEX | Truy vấn gift đã gửi |
| gift_transactions | to_wallet_id | INDEX | Truy vấn gift đã nhận |
| realtime_room_participants | room_id, left_at | INDEX | Tìm participant đang active trong phòng |
| realtime_rooms | room_code | UNIQUE | Join phòng theo code |
| realtime_rooms | agora_channel_name | UNIQUE | Agora channel mapping |
| levels | stage_id, level_number | UNIQUE | Đảm bảo không trùng level trong stage |
| lessons | level_id, sequence_number | UNIQUE | Đảm bảo sequence unique trong level |
| content_blocks | lesson_id, sort_order | UNIQUE | Đảm bảo sort order unique trong lesson |
| learner_progress | anonymous_uid | UNIQUE | Mỗi anonymous learner chỉ có 1 progress record |

---

## 5. Migration Scripts

Các script migration nằm trong `database/` của mỗi phase:

| Script | Phase | Nội dung |
|---|---|---|
| `schema.sql` | 1 | Auth + Learning Content tables (7 tables) |
| `seed-sample.sql` | 1 | Seed roles (Anonymous, Pro, Super) và languages (en, zh, ja) |
| `phase2-realtime.sql` | 2 | Realtime tables (3 tables + seed rooms) |
| `phase3-lms.sql` | 3 | LMS tables (3 tables + seed data) |
| `phase4-monetization.sql` | 4 | Monetization tables (4 tables + seed wallets) |
| `phase5-stress-evaluation.sql` | 5 | Stress test tables (2 tables + seed run) |
| `phase5-realtime-chat-record.sql` | 5 | Chat và recording logs (2 tables) |
| `import-all.sql` | 5 | Import tất cả (chạy tuần tự các script trên) |

### Cách import

```bash
# Import full database Phase 5
cd phase5-rbl
mariadb -u root -p1 < database/import-all.sql

# Import từng phase
mariadb -u root -p1 lucy_phase1 < database/schema.sql
mariadb -u root -p1 lucy_phase1 < database/seed-sample.sql
mariadb -u root -p1 lucy_phase4 < database/phase4-monetization.sql
```

---

## 6. Seed Data

### Roles

| Name | Description |
|---|---|
| Anonymous | Người dùng ẩn danh, vào phòng Level 1-5 |
| Pro | Mentor, dashboard learner, gửi tài liệu, quản lý podcast, nhận gift |
| Super | Creator, gửi tài liệu, quản lý podcast, nhận gift |

### Languages

| Code | Name |
|---|---|
| en | English |
| zh | Chinese |
| ja | Japanese |

### Realtime Rooms (Seed)

| room_code | title | language | level |
|---|---|---|---|
| trial-level-1 | Anonymous Trial Level 1 | en | 1 |
| trial-level-5 | Anonymous Trial Level 5 | en | 5 |

### Material Pins (Seed)

| Title | Language | Stage | Level |
|---|---|---|---|
| English Stage 1 Speaking Drill | en | 1 | 1 |
| Japanese Stage 1 Listening | ja | 1 | 1 |

### Learner Progress (Seed)

| anonymous_uid | display_name | Level | Sub-level |
|---|---|---|---|
| anon-level-1-demo | Anonymous Level 1 | 1 | WARM_UP |
| anon-level-4-demo | Anonymous Level 4 | 4 | GUIDED_PRACTICE |

### Wallets (Seed)

| external_owner_id | Balance | Currency |
|---|---|---|
| pro-mentor-1 | 150,000 | VND |
| super-creator-1 | 250,000 | VND |
