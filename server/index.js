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
          'Origin': 'https://leetcode.com',
          'Cookie': 'LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50X3ZlcmlmaWVkX2VtYWlsIjpudWxsLCJhY2NvdW50X3VzZXIiOiJhbzdsbyIsIl9hdXRoX3VzZXJfaWQiOiIxNzkyNTc1NiIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImFsbGF1dGguYWNjb3VudC5hdXRoX2JhY2tlbmRzLkF1dGhlbnRpY2F0aW9uQmFja2VuZCIsIl9hdXRoX3VzZXJfaGFzaCI6ImY4ODA0ODVhYzY3ZDc0ZDA1MTAyZDc3Y2M1YTMwNjc1ZjkyYTNjMzVlMGZkOTBiOWE0MGViMGE2MzQ0MDFkNTQiLCJzZXNzaW9uX3V1aWQiOiI2NzIzYzU3ZiIsImlkIjoxNzkyNTc1NiwiZW1haWwiOiJpdmFuLm1pbGFzaGthMjAyMEB5YW5kZXgucnUiLCJ1c2VybmFtZSI6InBvZHBpdmFzaGthIiwidXNlcl9zbHVnIjoicG9kcGl2YXNoa2EiLCJhdmF0YXIiOiJodHRwczovL2Fzc2V0cy5sZWV0Y29kZS5jb20vdXNlcnMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNzQ5MjQxMTU5LCJpcCI6IjE3OC4xNDEuMTcuNzIiLCJpZGVudGl0eSI6ImYyNzJiODBkZDkzODdjYmM0OWEyZmRmN2E4OGIxNGYxIiwiZGV2aWNlX3dpdGhfaXAiOlsiZmVhZDNhYTU1ZDA3MTNiMDBkNTI1NjgyMTA4MzVmOTUiLCIxNzguMTQxLjE3LjcyIl19.BzR8SVNmgzNBIq8cvQDROxFHdY5wbzHvdIvyn-bq0DY; csrftoken=vnRufms5JxWOCSvOpvaQ59w6juWStAZCR0GLIwNExm42Cc7cRjD2qlA0y6oESWaE',
          'X-CSRFToken': 'vnRufms5JxWOCSvOpvaQ59w6juWStAZCR0GLIwNExm42Cc7cRjD2qlA0y6oESWaE'
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