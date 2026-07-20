-- ============================================================
-- ROOM MESSAGES (chat/conversation history)
-- ============================================================
CREATE TABLE IF NOT EXISTS room_messages (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    participant_id CHAR(36) NULL,
    user_id VARCHAR(120) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_room_messages_room FOREIGN KEY (room_id) REFERENCES realtime_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_room_messages_participant FOREIGN KEY (participant_id) REFERENCES realtime_room_participants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_room_messages_room_created ON room_messages(room_id, created_at);

-- ============================================================
-- RECORDING LOGS (in-room recording sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS recording_logs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    room_id CHAR(36) NOT NULL,
    started_by VARCHAR(120) NOT NULL,
    started_by_display_name VARCHAR(120) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'RECORDING',
    storage_uri VARCHAR(500) NULL,
    duration_seconds INT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    stopped_at TIMESTAMP NULL,
    CONSTRAINT fk_recording_logs_room FOREIGN KEY (room_id) REFERENCES realtime_rooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_recording_logs_room ON recording_logs(room_id, started_at);
