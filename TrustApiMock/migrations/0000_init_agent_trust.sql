-- Trust API Mock: agent trust scores for example agents (ids 1-10)
CREATE TABLE IF NOT EXISTS agent_trust (
  agent_id TEXT PRIMARY KEY,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  signals TEXT,
  updated_at INTEGER NOT NULL
);

-- Seed randomized scores for example agents 1-10
INSERT OR IGNORE INTO agent_trust (agent_id, score, signals, updated_at)
VALUES
  ('1', 92, '{"tasksCompleted": 45, "disputes": 0}', unixepoch()),
  ('2', 88, '{"tasksCompleted": 38, "disputes": 1}', unixepoch()),
  ('3', 65, '{"tasksCompleted": 12, "disputes": 3}', unixepoch()),
  ('4', 78, '{"tasksCompleted": 22, "disputes": 2}', unixepoch()),
  ('5', 95, '{"tasksCompleted": 67, "disputes": 0}', unixepoch()),
  ('6', 70, '{"tasksCompleted": 15, "disputes": 2}', unixepoch()),
  ('7', 82, '{"tasksCompleted": 31, "disputes": 1}', unixepoch()),
  ('8', 58, '{"tasksCompleted": 8, "disputes": 5}', unixepoch()),
  ('9', 91, '{"tasksCompleted": 52, "disputes": 0}', unixepoch()),
  ('10', 76, '{"tasksCompleted": 19, "disputes": 1}', unixepoch());
