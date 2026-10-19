-- Migration 003: align CommentReaction's allowed values with the reaction set the
-- site actually offers.
--
-- migration_001 created the table with the legacy six emoji:
--     CHECK(reaction_type IN ('👍','❤️','😂','😮','😢','🎉'))
-- while the UI/API have offered these ten for a long time:
--     ❤️ 😂 😅 👀 🎉 😮 😆 😉 😭 🍀
--
-- SQLite cannot alter a CHECK constraint, so 😅 👀 😆 😉 😭 🍀 were rejected on
-- INSERT. `INSERT OR IGNORE` swallowed the violation, reactComment.ts still
-- answered 200 with the unchanged counts, and the reaction therefore looked like
-- it worked until the next page load. MemoReaction (migration_002) already had the
-- correct ten, which is why only comments were affected.
--
-- This rebuilds the table with the ten-value CHECK. Rows whose reaction_type is
-- not in the new set (the legacy 👍 / 😢) are dropped on purpose: those reactions
-- are no longer offered anywhere in the UI.

CREATE TABLE CommentReaction_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    comment_id INTEGER NOT NULL,
    fingerprint TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK(reaction_type IN ('❤️','😂','😅','👀','🎉','😮','😆','😉','😭','🍀')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(comment_id, fingerprint, reaction_type),
    FOREIGN KEY (comment_id) REFERENCES Comment (id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO CommentReaction_new (id, comment_id, fingerprint, reaction_type, created_at)
SELECT id, comment_id, fingerprint, reaction_type, created_at
FROM CommentReaction
WHERE reaction_type IN ('❤️','😂','😅','👀','🎉','😮','😆','😉','😭','🍀');

DROP TABLE CommentReaction;

ALTER TABLE CommentReaction_new RENAME TO CommentReaction;

CREATE INDEX IF NOT EXISTS idx_cr_comment ON CommentReaction(comment_id);
CREATE INDEX IF NOT EXISTS idx_cr_fingerprint ON CommentReaction(fingerprint);
