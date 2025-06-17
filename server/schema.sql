-- Создание базы данных
CREATE DATABASE IF NOT EXISTS programming_tasks;
USE programming_tasks;

-- Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Таблица задач
CREATE TABLE IF NOT EXISTS tasks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL,
  difficulty VARCHAR(50) NOT NULL,
  content TEXT,
  examples JSON,
  constraints JSON,
  hints JSON,
  topic_tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Таблица попыток
CREATE TABLE IF NOT EXISTS attempts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  task_id INT NOT NULL,
  status VARCHAR(50),
  submitted_code TEXT,
  submission_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_spent INT DEFAULT 0,
  solution_language VARCHAR(50),
  solution_complexity VARCHAR(50),
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id)
); 