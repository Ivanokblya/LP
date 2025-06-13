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
          'Referer': 'https://leetcode.com/',
          'Origin': 'https://leetcode.com'
        },
        timeout: 10000,
        validateStatus: function (status) {
          return status >= 200 && status < 500;
        }
      }
    );

    if (response.data.errors) {
      console.error('Ошибка в ответе LeetCode:', response.data.errors);
      return res.status(400).json({
        error: 'Ошибка в ответе LeetCode',
        details: response.data.errors
      });
    }

    console.log('Получен ответ от LeetCode:', JSON.stringify(response.data, null, 2));
    res.json(response.data);
  } catch (error) {
    console.error('Ошибка при запросе к LeetCode:', error);
    
    if (error.response) {
      console.error('Детали ошибки:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      });
      res.status(error.response.status).json({
        error: 'Ошибка при получении данных от LeetCode',
        details: error.response.data
      });
    } else if (error.request) {
      console.error('Запрос был отправлен, но ответ не получен:', error.request);
      res.status(500).json({
        error: 'Нет ответа от LeetCode',
        details: 'Сервер LeetCode не отвечает'
      });
    } else {
      console.error('Ошибка при настройке запроса:', error.message);
      res.status(500).json({
        error: 'Ошибка при настройке запроса',
        details: error.message
      });
    }
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