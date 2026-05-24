CREATE TABLE IF NOT EXISTS MemoReaction (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memo_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    reaction_type TEXT NOT NULL CHECK(reaction_type IN ('❤️','😂','😅','👀','🎉','😮','😆','😉','😭','🍀')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(memo_id, fingerprint, reaction_type)
);
CREATE INDEX IF NOT EXISTS idx_mr_memo ON MemoReaction(memo_id);
CREATE INDEX IF NOT EXISTS idx_mr_fingerprint ON MemoReaction(fingerprint);
