CREATE TABLE IF NOT EXISTS mentor_material_pins (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    mentor_user_id CHAR(36) NULL,
    material_title VARCHAR(255) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    stage_number INT NOT NULL,
    level_number INT NULL,
    pinned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_material_pins_mentor FOREIGN KEY (mentor_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learner_progress (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    learner_user_id CHAR(36) NULL,
    anonymous_uid VARCHAR(120) NULL,
    display_name VARCHAR(120) NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    stage_number INT NOT NULL,
    level_number INT NOT NULL,
    sub_level VARCHAR(40) NOT NULL DEFAULT 'WARM_UP',
    sub_level_started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_learner_progress_anonymous_uid (anonymous_uid),
    CONSTRAINT fk_learner_progress_user FOREIGN KEY (learner_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lms_transition_events (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    learner_progress_id CHAR(36) NOT NULL,
    from_sub_level VARCHAR(40) NOT NULL,
    to_sub_level VARCHAR(40) NOT NULL,
    pattern_name VARCHAR(80) NOT NULL DEFAULT 'State Pattern',
    transitioned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transition_progress FOREIGN KEY (learner_progress_id) REFERENCES learner_progress(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO mentor_material_pins (material_title, language_code, stage_number, level_number) VALUES
    ('English Stage 1 Speaking Drill', 'en', 1, 1),
    ('Japanese Stage 1 Listening', 'ja', 1, 1);

INSERT IGNORE INTO learner_progress (anonymous_uid, display_name, language_code, stage_number, level_number, sub_level) VALUES
    ('anon-level-1-demo', 'Anonymous Level 1', 'en', 1, 1, 'WARM_UP'),
    ('anon-level-4-demo', 'Anonymous Level 4', 'en', 1, 4, 'GUIDED_PRACTICE');
