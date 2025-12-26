-- Simple check for MySQL syntax validation
CREATE TABLE test_table (
  id INT PRIMARY KEY,
  name VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);