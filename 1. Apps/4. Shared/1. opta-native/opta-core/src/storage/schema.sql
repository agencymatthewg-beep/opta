-- Opta SQLite Schema v1

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value BLOB NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    expertise_level TEXT NOT NULL DEFAULT 'intermediate',
    communication_style TEXT NOT NULL DEFAULT 'balanced',
    preferences BLOB,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS optimizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    score_before INTEGER NOT NULL,
    score_after INTEGER NOT NULL,
    actions BLOB NOT NULL,
    result TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS telemetry_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp INTEGER NOT NULL,
    cpu_usage REAL NOT NULL,
    memory_usage REAL NOT NULL,
    gpu_usage REAL,
    temperature REAL
);

CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_optimizations_timestamp ON optimizations(timestamp);
