INSERT IGNORE INTO realtime_rooms (room_code, title, language_code, level_number, agora_channel_name, status) VALUES
    ('demo-podcast-room', 'Demo Podcast Room', 'en', 1, 'demo-podcast-room', 'OPEN');

INSERT IGNORE INTO podcast_recordings (creator_external_id, room_code, title, storage_uri, duration_seconds) VALUES
    ('demo-creator', 'demo-podcast-room', 'Sample Podcast - English Level 1', '/recordings/sample-podcast.wav', 3);
