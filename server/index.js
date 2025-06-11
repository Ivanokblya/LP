const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const LEETCODE_API_URL = 'https://leetcode.com/graphql';
const CODEFORCES_API_URL = 'https://codeforces.com/api/problemset.problems';
const EXERCISM_API_URL = 'https://exercism.org/api/v2/tracks';

// Хранилище для истории попыток
const attemptHistory = [];

// Функция для получения случайной задачи из указанного API
async function getRandomTaskFromAPI(apiName, difficulty) {
  console.log(`Получение задачи из ${apiName} с сложностью ${difficulty}`);
  
  switch (apiName) {
    case 'leetcode':
      return await getLeetCodeTask(difficulty);
    case 'codeforces':
      return await getCodeforcesTask(difficulty);
    case 'exercism':
      return await getExercismTask(difficulty);
    default:
      throw new Error(`Неизвестный API: ${apiName}`);
  }
}

// Получение задачи с LeetCode
async function getLeetCodeTask(difficulty) {
  console.log('Запрос к LeetCode API');
  const requestBody = {
    query: `
      query randomQuestion($categorySlug: String, $filters: QuestionListFilterInput) {
        randomQuestion(categorySlug: $categorySlug, filters: $filters) {
          questionId
          title
          titleSlug
          difficulty
          categoryTitle
          stats
          topicTags {
            name
            slug
          }
        }
      }
    `,
    variables: {
      categorySlug: 'all-code-essentials',
      filters: difficulty ? { difficulty: difficulty.toUpperCase() } : undefined
    }
  };

  console.log('LeetCode запрос:', JSON.stringify(requestBody, null, 2));

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
      }
    }
  );

  if (response.data.errors) {
    console.error('Ошибка LeetCode API:', response.data.errors);
    throw new Error(response.data.errors[0].message);
  }

  console.log('Успешный ответ от LeetCode');
  return {
    ...response.data.data.randomQuestion,
    source: 'leetcode'
  };
}

// Получение задачи с Codeforces
async function getCodeforcesTask(difficulty) {
  console.log('Запрос к Codeforces API');
  const response = await axios.get(CODEFORCES_API_URL);
  
  if (response.data.status !== 'OK') {
    console.error('Ошибка Codeforces API:', response.data);
    throw new Error('Ошибка в ответе Codeforces API');
  }

  let problems = response.data.result.problems;
  console.log(`Получено ${problems.length} задач с Codeforces`);
  
  if (difficulty) {
    const difficultyMap = {
      'easy': 1200,
      'medium': 1600,
      'hard': 2000
    };
    const targetRating = difficultyMap[difficulty];
    problems = problems.filter(p => p.rating && Math.abs(p.rating - targetRating) <= 200);
    console.log(`Отфильтровано ${problems.length} задач по сложности ${difficulty}`);
  }

  if (problems.length === 0) {
    throw new Error('Нет задач с указанной сложностью');
  }

  const randomProblem = problems[Math.floor(Math.random() * problems.length)];
  console.log('Выбрана задача:', randomProblem.name);
  
  return {
    questionId: randomProblem.contestId + randomProblem.index,
    title: randomProblem.name,
    titleSlug: `${randomProblem.contestId}/${randomProblem.index}`,
    difficulty: randomProblem.rating,
    categoryTitle: 'Codeforces',
    stats: JSON.stringify({
      totalAccepted: randomProblem.solvedCount || 0,
      totalSubmission: 0,
      acRate: 0
    }),
    topicTags: randomProblem.tags.map(tag => ({
      name: tag,
      slug: tag.toLowerCase()
    })),
    source: 'codeforces'
  };
}

// Получение задачи с Exercism
async function getExercismTask(difficulty) {
  console.log('Запрос к Exercism API');
  const response = await axios.get(EXERCISM_API_URL, {
    headers: {
      'Accept': 'application/json'
    }
  });

  const tracks = response.data.tracks;
  console.log(`Получено ${tracks.length} треков с Exercism`);
  
  const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
  console.log('Выбран трек:', randomTrack.title);
  
  const exercisesResponse = await axios.get(`${EXERCISM_API_URL}/${randomTrack.slug}/exercises`, {
    headers: {
      'Accept': 'application/json'
    }
  });

  let exercises = exercisesResponse.data.exercises;
  console.log(`Получено ${exercises.length} упражнений для трека ${randomTrack.title}`);
  
  if (difficulty) {
    const difficultyMap = {
      'easy': 1,
      'medium': 2,
      'hard': 3
    };
    const targetDifficulty = difficultyMap[difficulty];
    exercises = exercises.filter(e => e.difficulty === targetDifficulty);
    console.log(`Отфильтровано ${exercises.length} упражнений по сложности ${difficulty}`);
  }

  if (exercises.length === 0) {
    throw new Error('Нет задач с указанной сложностью');
  }

  const randomExercise = exercises[Math.floor(Math.random() * exercises.length)];
  console.log('Выбрано упражнение:', randomExercise.title);
  
  return {
    questionId: randomExercise.id,
    title: randomExercise.title,
    titleSlug: randomExercise.slug,
    difficulty: randomExercise.difficulty,
    categoryTitle: randomTrack.title,
    stats: JSON.stringify({
      totalAccepted: 0,
      totalSubmission: 0,
      acRate: 0
    }),
    topicTags: randomExercise.topics.map(topic => ({
      name: topic,
      slug: topic.toLowerCase()
    })),
    source: 'exercism'
  };
}

// Основной эндпоинт для получения случайной задачи
app.post('/api/random-task', async (req, res) => {
  console.log('Получен запрос на случайную задачу');
  try {
    const { difficulty, source } = req.body;
    console.log('Параметры запроса:', { difficulty, source });

    let apiName = source;
    if (!apiName || apiName === 'random') {
      const apis = ['leetcode', 'codeforces', 'exercism'];
      apiName = apis[Math.floor(Math.random() * apis.length)];
      console.log('Выбран случайный API:', apiName);
    }

    const task = await getRandomTaskFromAPI(apiName, difficulty);
    console.log('Получена задача:', task.title);
    
    // Добавляем запись в историю
    const attempt = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      task,
      status: 'started',
      timeSpent: 0
    };
    attemptHistory.push(attempt);
    console.log('Добавлена запись в историю:', attempt.id);

    res.json({
      data: {
        randomQuestion: task
      },
      attemptId: attempt.id
    });
  } catch (error) {
    console.error('Ошибка при получении задачи:', error);
    handleError(error, res);
  }
});

// Эндпоинт для обновления статуса попытки
app.post('/api/attempt/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, timeSpent } = req.body;
    console.log('Обновление попытки:', { id, status, timeSpent });

    const attempt = attemptHistory.find(a => a.id === parseInt(id));
    if (!attempt) {
      console.error('Попытка не найдена:', id);
      return res.status(404).json({
        error: 'Попытка не найдена',
        details: 'Указанный ID попытки не существует'
      });
    }

    attempt.status = status;
    attempt.timeSpent = timeSpent;
    attempt.completedAt = new Date().toISOString();
    console.log('Попытка обновлена:', attempt);

    res.json({ success: true, attempt });
  } catch (error) {
    console.error('Ошибка при обновлении попытки:', error);
    handleError(error, res);
  }
});

// Эндпоинт для получения истории попыток
app.get('/api/attempts', (req, res) => {
  try {
    console.log('Запрос истории попыток');
    res.json({
      attempts: attemptHistory.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    });
  } catch (error) {
    console.error('Ошибка при получении истории:', error);
    handleError(error, res);
  }
});

// Вспомогательная функция для обработки ошибок
function handleError(error, res) {
  console.error('Детали ошибки:', {
    message: error.message,
    stack: error.stack
  });

  if (error.response) {
    console.error('Ответ сервера:', {
      status: error.response.status,
      statusText: error.response.statusText,
      data: error.response.data
    });
    res.status(error.response.status).json({
      error: 'Ошибка при получении данных',
      details: error.response.data
    });
  } else if (error.request) {
    console.error('Запрос был отправлен, но ответ не получен:', error.request);
    res.status(500).json({
      error: 'Нет ответа от сервера',
      details: 'Сервер не отвечает'
    });
  } else {
    console.error('Ошибка при настройке запроса:', error.message);
    res.status(500).json({
      error: 'Ошибка при настройке запроса',
      details: error.message
    });
  }
}

// Тестовый эндпоинт
app.get('/api/test', (req, res) => {
  res.json({ message: 'Сервер работает!' });
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log(`Тестовый эндпоинт доступен по адресу: http://localhost:${port}/api/test`);
}); 