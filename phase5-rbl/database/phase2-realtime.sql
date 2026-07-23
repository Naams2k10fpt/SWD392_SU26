CREATE TABLE IF NOT EXISTS realtime_rooms (
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

CREATE TABLE IF NOT EXISTS realtime_room_participants (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    user_id CHAR(36) NULL,
    anonymous_uid VARCHAR(120) NULL,
    display_name VARCHAR(120) NOT NULL,
    role_name VARCHAR(32) NOT NULL DEFAULT 'ANONYMOUS',
    mic_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    hand_raised BOOLEAN NOT NULL DEFAULT FALSE,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP NULL,
    CONSTRAINT fk_realtime_participants_room FOREIGN KEY (room_id) REFERENCES realtime_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_realtime_participants_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS realtime_latency_samples (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    participant_id CHAR(36) NULL,
    round_trip_ms INT NOT NULL,
    sampled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_latency_room FOREIGN KEY (room_id) REFERENCES realtime_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_latency_participant FOREIGN KEY (participant_id) REFERENCES realtime_room_participants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO realtime_rooms (room_code, title, language_code, level_number, agora_channel_name, status) VALUES
    ('trial-level-1', 'Anonymous Trial Level 1', 'en', 1, 'lucy-trial-level-1', 'OPEN'),
    ('trial-level-5', 'Anonymous Trial Level 5', 'en', 5, 'lucy-trial-level-5', 'OPEN');
