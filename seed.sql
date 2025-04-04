-- Add a test user
INSERT INTO users (id, email, name) 
VALUES ('user-001', 'test@example.com', 'Test User');

-- Add default categories
INSERT INTO categories (id, user_id, name, color) 
VALUES 
  ('cat-001', 'user-001', 'Food', '#FF5733'),
  ('cat-002', 'user-001', 'Transportation', '#33FF57'),
  ('cat-003', 'user-001', 'Housing', '#3357FF'),
  ('cat-004', 'user-001', 'Entertainment', '#F033FF'),
  ('cat-005', 'user-001', 'Shopping', '#33FFF0');
