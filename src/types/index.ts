export type Difficulty = 'easy' | 'medium' | 'hard';
export type Source = 'leetcode' | 'codeforces' | 'random';
export type AttemptStatus = 'started' | 'completed' | 'failed' | 'abandoned';

export interface TopicTag {
  name: string;
  slug: string;
}

export interface TaskStats {
  totalAccepted: number;
  totalSubmission: number;
  acRate: number;
}

export interface Task {
  questionId: string;
  title: string;
  titleSlug: string;
  difficulty: string | number;
  categoryTitle: string;
  stats: string; // JSON string of TaskStats
  topicTags: TopicTag[];
  source: Source;
  content?: string; // Описание задания
  examples?: string[]; // Примеры входных/выходных данных
  constraints?: string[]; // Ограничения
  hints?: string[]; // Подсказки
}

export interface Attempt {
  id: number;
  timestamp: string;
  task: Task;
  status: AttemptStatus;
  timeSpent: number;
  completedAt?: string;
}

export interface TaskResponse {
  data: {
    randomQuestion: Task;
  };
  attemptId: number;
}

export interface AttemptsResponse {
  attempts: Attempt[];
}

export interface ApiError {
  error: string;
  details: string | any;
} 