const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer');

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
          content
          exampleTestcases
          hints
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

  const question = response.data.data.randomQuestion;
  console.log('Успешный ответ от LeetCode');

  // Обработка примеров
  const examples = question.exampleTestcases ? 
    question.exampleTestcases.split('\n\n').map(example => {
      const [input, output] = example.split('\n');
      return `Входные данные:\n${input}\n\nВыходные данные:\n${output}`;
    }) : [];

  // Обработка ограничений
  const constraintsMatch = question.content.match(/<p><strong>Constraints:<\/strong><\/p>([\s\S]*?)(?:<p>|$)/);
  const constraints = constraintsMatch ? 
    constraintsMatch[1]
      .split('</li>')
      .map(line => line.replace(/<[^>]+>/g, '').trim())
      .filter(line => line) : [];

  return {
    ...question,
    source: 'leetcode',
    examples,
    constraints,
    content: question.content.replace(/<[^>]+>/g, '\n').trim()
  };
}

// Получение описания задачи через Puppeteer
async function getCodeforcesProblemDescription(contestId, index) {
  const url = `https://codeforces.com/contest/${contestId}/problem/${index}`;
  console.log('Открываем страницу:', url);
  
  const browser = await puppeteer.launch({ 
    headless: false,
    slowMo: 50,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Устанавливаем таймаут для навигации
    await page.setDefaultNavigationTimeout(30000);
    
    // Переходим на страницу
    console.log('Загружаем страницу...');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    
    // Ждем загрузку контента
    console.log('Ожидаем загрузку контента...');
    await page.waitForSelector('.problem-statement', { timeout: 10000 });
    
    // Извлекаем описание задачи
    console.log('Извлекаем описание задачи...');
    const problemHtml = await page.$eval('.problem-statement', el => {
      // Получаем заголовок
      const title = el.querySelector('.title')?.innerText || '';
      
      // Получаем ограничения
      const timeLimit = el.querySelector('.time-limit')?.innerText || '';
      const memoryLimit = el.querySelector('.memory-limit')?.innerText || '';
      
      // Получаем описание
      const description = Array.from(el.querySelectorAll('p'))
        .map(p => p.innerText.trim())
        .filter(text => text && !text.includes('ограничение по времени') && !text.includes('ограничение по памяти'))
        .join(' ');
      
      // Получаем входные и выходные данные
      const inputSpec = el.querySelector('.input-specification')?.innerText || '';
      const outputSpec = el.querySelector('.output-specification')?.innerText || '';
      
      // Форматируем текст
      return [
        title,
        timeLimit,
        memoryLimit,
        description,
        inputSpec,
        outputSpec
      ].filter(Boolean).join('\n');
    });
    
    // Извлекаем примеры
    console.log('Извлекаем примеры...');
    const examples = await page.$$eval('.sample-test', tests => {
      return tests.map(test => {
        const input = test.querySelector('.input pre')?.innerText.trim() || '';
        const output = test.querySelector('.output pre')?.innerText.trim() || '';
        return `Пример:\nВходные данные:\n${input}\n\nВыходные данные:\n${output}`;
      });
    });
    
    console.log('Успешно получено описание задачи');
    return {
      url,
      description: problemHtml,
      examples
    };
  } catch (error) {
    console.error('Ошибка при получении описания задачи:', error);
    
    // Проверяем HTML страницы в случае ошибки
    try {
      const html = await page.content();
      console.log('HTML страницы при ошибке:', html.slice(0, 1000));
    } catch (e) {
      console.error('Не удалось получить HTML страницы:', e);
    }
    
    throw new Error(`Ошибка при получении описания задачи: ${error.message}`);
  } finally {
    console.log('Закрываем браузер...');
    await browser.close();
  }
}

// Получение задачи с Codeforces
async function getCodeforcesTask(difficulty) {
  console.log('Запрос к Codeforces API');
  try {
    // Получаем список всех задач
    const response = await axios.get('https://codeforces.com/api/problemset.problems', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://codeforces.com',
        'Referer': 'https://codeforces.com/'
      },
      params: {
        lang: 'en'
      },
      timeout: 10000,
      validateStatus: function (status) {
        return status >= 200 && status < 500;
      }
    });
    
    console.log('Ответ от Codeforces API:', {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data
    });

    if (!response.data || response.data.status !== 'OK') {
      console.error('Ошибка Codeforces API:', response.data);
      throw new Error('Ошибка в ответе Codeforces API: ' + JSON.stringify(response.data));
    }

    let problems = response.data.result.problems;
    console.log(`Получено ${problems.length} задач с Codeforces`);
    
    // Фильтруем по сложности
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

    // Выбираем случайную задачу
    const randomProblem = problems[Math.floor(Math.random() * problems.length)];
    console.log('Выбрана задача:', randomProblem.name);

    // Получаем полное описание задачи через Puppeteer
    console.log('Получаем описание задачи через Puppeteer...');
    const problemDescription = await getCodeforcesProblemDescription(randomProblem.contestId, randomProblem.index);

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
      source: 'codeforces',
      content: problemDescription.description,
      examples: problemDescription.examples,
      constraints: [
        `Сложность: ${randomProblem.rating}`,
        `Теги: ${randomProblem.tags.join(', ')}`,
        `Ссылка на задачу: ${problemDescription.url}`
      ]
    };
  } catch (error) {
    console.error('Ошибка при получении задачи с Codeforces:', error);
    throw error;
  }
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