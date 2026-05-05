-- create comment table
CREATE TABLE IF NOT EXISTS Comment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pub_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    post_slug TEXT NOT NULL,
    author TEXT NOT NULL,
    email TEXT NOT NULL,
    url TEXT,
    ip_address TEXT,
    device TEXT,
    os TEXT,
    browser TEXT,
    user_agent TEXT,
    content_text TEXT NOT NULL,
    content_html TEXT NOT NULL,
    parent_id INTEGER,
    like_count INTEGER NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'approved',
    -- 建立自引用外键约束（父子评论关系）
    FOREIGN KEY (parent_id) REFERENCES Comment (id) ON DELETE SET NULL
);

-- Settings table for web-based configuration
CREATE TABLE IF NOT EXISTS Settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- 可选：为常用查询字段创建索引以提高性能
CREATE INDEX IF NOT EXISTS idx_post_slug ON Comment(post_slug);
CREATE INDEX IF NOT EXISTS idx_status ON Comment(status);

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