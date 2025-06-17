import { getAuthHeader } from './authService';
import { Task, Difficulty, Source, Attempt, TaskResponse } from '../types';

const API_URL = 'http://localhost:3001/api';

export const getRandomTask = async (difficulty: Difficulty, source: Source): Promise<TaskResponse> => {
  try {
    const authHeader = getAuthHeader();
    const headers = new Headers();
    if (authHeader.Authorization) {
      headers.append('Authorization', authHeader.Authorization);
    }

    const response = await fetch(`${API_URL}/tasks/random?difficulty=${difficulty}&source=${source}`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Ошибка при получении задачи');
    }

    return response.json();
  } catch (error) {
    console.error('Ошибка при получении задачи:', error);
    throw error;
  }
};

export const updateAttempt = async (
  attemptId: string | number, 
  status: string, 
  submitted_code?: string,
  time_spent?: number
) => {
  try {
    const response = await fetch(`${API_URL}/attempts/${attemptId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ 
        status, 
        submitted_code,
        time_spent
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка при обновлении попытки');
    }

    return await response.json();
  } catch (error) {
    console.error('Ошибка при обновлении попытки:', error);
    throw error;
  }
};

export const getAttempts = async (): Promise<Attempt[]> => {
  try {
    const authHeader = getAuthHeader();
    const headers = new Headers();
    if (authHeader.Authorization) {
      headers.append('Authorization', authHeader.Authorization);
    }

    const response = await fetch(`${API_URL}/attempts`, {
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Ошибка при получении истории попыток');
    }

    return response.json();
  } catch (error) {
    console.error('Ошибка при получении истории попыток:', error);
    throw error;
  }
}; 