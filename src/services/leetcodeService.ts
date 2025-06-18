import axios from 'axios';
import { LeetCodeResponse } from '../types/leetcode';

const API_URL = 'http://localhost:3001/api/leetcode';

const RANDOM_QUESTION_QUERY = `
  query randomQuestion($categorySlug: String, $filters: QuestionListFilterInput) {
    randomQuestion(categorySlug: $categorySlug, filters: $filters) {
      questionId
      title
      titleSlug
      difficulty
      categoryTitle
      stats {
        totalAccepted
        totalSubmission
        acRate
      }
      topicTags {
        name
        slug
      }
    }
  }
`;

export const leetcodeService = {
  async getRandomQuestion(difficulty?: 'Easy' | 'Medium' | 'Hard') {
    try {
      const response = await axios.post<LeetCodeResponse>(
        `${API_URL}/random`,
        { difficulty }
      );

      return response.data.data.randomQuestion;
    } catch (error) {
      console.error('Ошибка при получении случайной задачи:', error);
      throw error;
    }
  },

  getProblemUrl(titleSlug: string): string {
    return `https://leetcode.com/problems/${titleSlug}/`;
  }
}; 