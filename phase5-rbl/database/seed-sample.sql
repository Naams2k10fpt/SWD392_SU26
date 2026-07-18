INSERT IGNORE INTO roles (name, description) VALUES
    ('ANONYMOUS', 'User chưa đăng nhập hoặc chưa có quyền nâng cao'),
    ('PRO', 'Mentor theo dõi learner và review nội dung học'),
    ('SUPER', 'Creator quản trị tài khoản, import và quản lý học liệu');

INSERT IGNORE INTO languages (code, name) VALUES
    ('en', 'English'),
    ('zh', 'Chinese'),
    ('ja', 'Japanese');

INSERT IGNORE INTO stages (language_id, stage_number, title)
SELECT id, 1, 'Stage 1 / Levels 1-30'
FROM languages;
