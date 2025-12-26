-- Simple test to validate schema syntax
CREATE TABLE IF NOT EXISTS test_table (
  id INT PRIMARY KEY,
  name VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);