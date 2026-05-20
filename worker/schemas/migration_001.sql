-- Migration 001: pinned comments + multi reactions
ALTER TABLE Comment ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS CommentReaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    fingerprint TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK(reaction_type IN ('👍','❤️','😂','😮','😢','🎉')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, fingerprint, reaction_type),
    FOREIGN KEY (comment_id) REFERENCES Comment (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cr_comment ON CommentReaction(comment_id);
CREATE INDEX IF NOT EXISTS idx_cr_fingerprint ON CommentReaction(fingerprint);
