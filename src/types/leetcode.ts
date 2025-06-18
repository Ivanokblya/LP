export interface LeetCodeProblem {
  questionId: string;
  title: string;
  titleSlug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  categoryTitle: string;
  stats: {
    totalAccepted: number;
    totalSubmission: number;
    acRate: number;
  };
  topicTags: {
    name: string;
    slug: string;
  }[];
}

export interface LeetCodeResponse {
  data: {
    randomQuestion: LeetCodeProblem;
  };
} 