ALTER TABLE Comment ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS CommentLike (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    fingerprint TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, fingerprint),
    FOREIGN KEY (comment_id) REFERENCES Comment (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_comment_like_comment_id ON CommentLike(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_like_fingerprint ON CommentLike(fingerprint);
