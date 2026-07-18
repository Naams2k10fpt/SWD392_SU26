CREATE TABLE IF NOT EXISTS stress_test_runs (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    run_name VARCHAR(160) NOT NULL,
    target_virtual_users INT NOT NULL,
    p95_latency_ms INT NULL,
    failure_rate DECIMAL(8,4) NULL,
    notes TEXT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cross_testing_reports (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    tester_group VARCHAR(120) NOT NULL,
    tested_group VARCHAR(120) NOT NULL,
    tested_feature VARCHAR(160) NOT NULL,
    result VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    issue_summary TEXT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO stress_test_runs (run_name, target_virtual_users, notes) VALUES
    ('Phase 5 baseline realtime/auth/wallet stress test', 1000, 'Run with k6 script stress-tests/realtime-auth-wallet-stress.js');
