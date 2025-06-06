const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const LEETCODE_API_URL = 'https://leetcode.com/graphql';

app.post('/api/leetcode/random', async (req, res) => {
  console.log('Получен запрос на случайную задачу');
  try {
    const { difficulty } = req.body;
    console.log('Параметры запроса:', { difficulty });
    
    const requestBody = {
      query: `
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
      `,
      variables: {
        categorySlug: 'all-code-essentials',
        filters: difficulty ? { difficulty } : undefined
      }
    };

    console.log('Отправляем запрос к LeetCode:', JSON.stringify(requestBody, null, 2));

    const response = await axios.post(
      LEETCODE_API_URL,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9',
          'Origin': 'https://leetcode.com',
          'Referer': 'https://leetcode.com/'
        }
      }
    );

    console.log('Получен ответ от LeetCode:', JSON.stringify(response.data, null, 2));
    res.json(response.data);
  } catch (error) {
    console.error('Ошибка при проксировании запроса к LeetCode:', error);
    if (error.response) {
      console.error('Детали ошибки:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
    } else if (error.request) {
      console.error('Запрос был отправлен, но ответ не получен:', error.request);
    } else {
      console.error('Ошибка при настройке запроса:', error.message);
    }
    res.status(500).json({ 
      error: 'Ошибка при получении данных от LeetCode',
      details: error.message || 'Неизвестная ошибка',
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null
    });
  }
});

// Добавляем тестовый эндпоинт
app.get('/api/test', (req, res) => {
  res.json({ message: 'Сервер работает!' });
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log(`Тестовый эндпоинт доступен по адресу: http://localhost:${port}/api/test`);
}); 