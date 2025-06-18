export interface Task {
  id: number;
  title: string;
  source: string;
  difficulty: string;
  content?: string;
  examples?: string[];
  constraints?: string[];
  hints?: string[];
  topicTags?: { name: string; slug: string }[];
  categoryTitle?: string;
}

export interface Attempt {
  id: number;
  userId: number;
  taskId: number;
  status: 'completed' | 'failed' | 'abandoned' | 'in_progress';
  timeSpent: number;
  submissionTime: string;
  task?: Task;
  submittedCode?: string;
  codeReview?: string;
  reviewScore?: number;
  reviewSuggestions?: string[];
}

export type Difficulty = 'easy' | 'medium' | 'hard';
export type Source = 'leetcode' | 'codeforces' | 'random';

export interface TaskResponse {
  data: {
    randomQuestion: Task;
  };
  attemptId: number;
} 