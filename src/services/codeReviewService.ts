import { API_URL } from '../config';

export const reviewCode = async (code: string, taskDescription: string) => {
  try {
    const response = await fetch(`${API_URL}/api/review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        taskDescription,
      }),
    });

    if (!response.ok) {
      throw new Error('Ошибка при проверке кода');
    }

    const data = await response.json();
    console.log('Ответ от сервера:', data);

    // Проверяем, что у нас есть все необходимые поля
    if (data.score === undefined || data.reviewText === undefined) {
      throw new Error('Неверный формат ответа от сервера');
    }

    // Извлекаем рекомендации из текста проверки
    const suggestions = data.suggestions || [];

    return {
      code_review: data.reviewText,
      review_score: data.score,
      review_suggestions: suggestions,
    };
  } catch (error) {
    console.error('Error reviewing code:', error);
    throw error;
  }
}; 