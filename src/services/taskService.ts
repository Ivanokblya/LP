import axios from 'axios';
import { Difficulty, Source, TaskResponse, Attempt, AttemptStatus } from '../types';

const API_URL = 'http://localhost:3001/api';

export const getRandomTask = async (difficulty?: Difficulty, source?: Source): Promise<TaskResponse> => {
  try {
    const response = await axios.post<TaskResponse>(`${API_URL}/random-task`, {
      difficulty,
      source
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при получении случайной задачи:', error);
    throw error;
  }
};

export const updateAttempt = async (attemptId: number, status: AttemptStatus, timeSpent: number) => {
  try {
    const response = await axios.post(`${API_URL}/attempt/${attemptId}`, {
      status,
      timeSpent
    });
    return response.data;
  } catch (error) {
    console.error('Ошибка при обновлении попытки:', error);
    throw error;
  }
};

export const getAttempts = async () => {
  try {
    const response = await axios.get<{ attempts: Attempt[] }>(`${API_URL}/attempts`);
    return response.data.attempts;
  } catch (error) {
    console.error('Ошибка при получении истории попыток:', error);
    throw error;
  }
}; 