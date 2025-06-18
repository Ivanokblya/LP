interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthResponse {
  user: User;
  token: string;
}

const API_URL = 'http://localhost:3001/api';

export const login = async (username: string, password: string): Promise<AuthResponse> => {
  try {
    console.log('Попытка входа для пользователя:', username);
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Ошибка входа:', error);
      throw new Error(error.error || 'Ошибка входа');
    }

    const data = await response.json();
    console.log('Получен ответ от сервера:', { token: data.token ? 'есть' : 'отсутствует' });
    
    if (!data.token) {
      throw new Error('Токен не получен');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    console.log('Токен сохранен в localStorage');
    return data;
  } catch (error) {
    console.error('Ошибка входа:', error);
    throw error;
  }
};

export const register = async (username: string, email: string, password: string): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, email, password }),
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Ошибка регистрации');
    }

    const data = await response.json();
    if (!data.token) {
      throw new Error('Токен не получен');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    throw error;
  }
};

export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export const getCurrentUser = (): User | null => {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  return JSON.parse(userStr);
};

export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('token');
};

export const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  console.log('Текущий токен в localStorage:', token ? 'есть' : 'отсутствует');
  return token ? { Authorization: `Bearer ${token}` } : {};
}; 