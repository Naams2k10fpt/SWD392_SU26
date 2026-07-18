CREATE TABLE IF NOT EXISTS wallet_accounts (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    user_id CHAR(36) NULL,
    external_owner_id VARCHAR(120) NOT NULL UNIQUE,
    balance DECIMAL(18,2) NOT NULL DEFAULT 0,
    currency_code VARCHAR(10) NOT NULL DEFAULT 'VND',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    wallet_id CHAR(36) NOT NULL,
    transaction_type VARCHAR(40) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    provider_reference VARCHAR(120) NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'COMMITTED',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_wallet_transactions_wallet FOREIGN KEY (wallet_id) REFERENCES wallet_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS gift_transactions (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    from_wallet_id CHAR(36) NOT NULL,
    to_wallet_id CHAR(36) NOT NULL,
    room_code VARCHAR(80) NOT NULL,
    amount DECIMAL(18,2) NOT NULL,
    message VARCHAR(255) NULL,
    realtime_event VARCHAR(80) NOT NULL DEFAULT 'gift:sent',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gift_from_wallet FOREIGN KEY (from_wallet_id) REFERENCES wallet_accounts(id) ON DELETE RESTRICT,
    CONSTRAINT fk_gift_to_wallet FOREIGN KEY (to_wallet_id) REFERENCES wallet_accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS podcast_recordings (
    id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
    creator_user_id CHAR(36) NULL,
    creator_external_id VARCHAR(120) NOT NULL,
    room_code VARCHAR(80) NOT NULL,
    title VARCHAR(255) NOT NULL,
    storage_uri VARCHAR(500) NOT NULL,
    duration_seconds INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_podcast_creator FOREIGN KEY (creator_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO wallet_accounts (external_owner_id, balance, currency_code) VALUES
    ('pro-mentor-1', 150000, 'VND'),
    ('super-creator-1', 250000, 'VND');
