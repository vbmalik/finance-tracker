-- Add additional fields to the budgets table
ALTER TABLE budgets ADD COLUMN current_spent REAL DEFAULT 0;
ALTER TABLE budgets ADD COLUMN remaining REAL;
ALTER TABLE budgets ADD COLUMN percentage_used REAL DEFAULT 0;

-- Create a reports table for monthly reports
CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  generated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
