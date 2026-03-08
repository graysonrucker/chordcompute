CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  status TEXT NOT NULL,
  input_notes TEXT NOT NULL,
  input_note_count INTEGER NOT NULL,
  span INTEGER,
  result_count INTEGER,
  runtime_ms INTEGER,
  bytes_written INTEGER,
  cancel_reason TEXT,
  error_message TEXT
);