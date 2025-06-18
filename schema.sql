CREATE DATABASE IF NOT EXISTS `programming_tasks`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE `programming_tasks`;

CREATE TABLE `users` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX (`username`),
  INDEX (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `tasks` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(255) NOT NULL,
  `source` VARCHAR(50) NOT NULL,
  `difficulty` VARCHAR(50) NOT NULL,
  `content` TEXT,
  `examples` LONGTEXT COLLATE utf8mb4_bin,
  `constraints` LONGTEXT COLLATE utf8mb4_bin,
  `hints` LONGTEXT COLLATE utf8mb4_bin,
  `topic_tags` LONGTEXT COLLATE utf8mb4_bin,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `attempts` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_id` INT(11) NOT NULL,
  `task_id` INT(11) NOT NULL,
  `status` VARCHAR(50),
  `submitted_code` TEXT,
  `submission_time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `timeSpent` INT(11) DEFAULT 0,
  `solution_language` VARCHAR(50),
  `solution_complexity` VARCHAR(50),
  `notes` TEXT,
  `time_spent` INT(11) DEFAULT 0,
  `code_review` TEXT,
  `review_score` INT(11),
  `review_suggestions` LONGTEXT COLLATE utf8mb4_bin,
  PRIMARY KEY (`id`),
  INDEX (`user_id`),
  INDEX (`task_id`),
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
