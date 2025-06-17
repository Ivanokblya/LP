const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const bcrypt = require('bcrypt');

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Подключение к базе данных
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  database: 'programming_tasks',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Проверка подключения к базе данных
pool.getConnection()
  .then(connection => {
    console.log('Успешное подключение к базе данных');
    connection.release();
  })
  .catch(err => {
    console.error('Ошибка подключения к базе данных:', err);
  });

const LEETCODE_API_URL = 'https://leetcode.com/graphql';
const CODEFORCES_API_URL = 'https://codeforces.com/api/problemset.problems';
const EXERCISM_API_URL = 'https://exercism.org/api/v2/tracks';

// Middleware для аутентификации
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Недействительный токен' });
    }
    req.user = user;
    next();
  });
};

// Хранилище для истории попыток
const attemptHistory = [];

// Функция для получения случайной задачи из указанного API
async function getRandomTaskFromAPI(source, difficulty) {
  if (source === 'codeforces') {
    try {
      console.log('Открываем страницу: https://codeforces.com/contest/1679/problem/B');
      const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      
      console.log('Загружаем страницу...');
      await page.goto('https://codeforces.com/contest/1679/problem/B', {
        waitUntil: 'networkidle0',
        timeout: 30000
      });

      console.log('Ожидаем загрузку контента...');
      await page.waitForSelector('.problem-statement', { timeout: 10000 });

      console.log('Извлекаем описание задачи...');
      const content = await page.evaluate(() => {
        const problemStatement = document.querySelector('.problem-statement');
        if (!problemStatement) return null;

        // Получаем заголовок
        const title = problemStatement.querySelector('.title')?.textContent || '';

        // Получаем описание
        const description = Array.from(problemStatement.querySelectorAll('.problem-statement > div'))
          .filter(div => {
            const text = div.textContent || '';
            return !text.includes('Input') && 
                   !text.includes('Output') && 
                   !text.includes('Example') &&
                   !text.includes('time limit') &&
                   !text.includes('memory limit') &&
                   !text.includes('Note');
          })
          .map(div => div.textContent.trim())
          .join('\n\n');

        // Получаем ограничения
        const constraints = Array.from(problemStatement.querySelectorAll('.problem-statement > div'))
          .filter(div => {
            const text = div.textContent || '';
            return text.includes('time limit') || 
                   text.includes('memory limit') ||
                   text.includes('Note');
          })
          .map(div => div.textContent.trim())
          .join('\n\n');

        // Получаем примеры
        const examples = Array.from(problemStatement.querySelectorAll('.sample-test'))
          .map(test => {
            const input = test.querySelector('.input pre')?.textContent || '';
            const output = test.querySelector('.output pre')?.textContent || '';
            return `Входные данные:\n${input}\n\nВыходные данные:\n${output}`;
          });

        return {
          title,
          description,
          constraints,
          examples
        };
      });

      console.log('Успешно получено описание задачи');
      await browser.close();

      if (!content) {
        throw new Error('Не удалось получить описание задачи');
      }

      return {
        title: content.title,
        source: 'codeforces',
        difficulty: difficulty || 'medium',
        content: `${content.description}\n\n${content.constraints}`,
        examples: content.examples,
        constraints: [content.constraints],
        hints: [],
        topicTags: []
      };
    } catch (error) {
      console.error('Ошибка при получении задачи с Codeforces:', error);
      throw error;
    }
  }

  console.log(`Получение задачи из ${source} с сложностью ${difficulty}`);
  
  switch (source) {
    case 'leetcode':
      return await getLeetCodeTask(difficulty);
    case 'codeforces':
      return await getCodeforcesTask(difficulty);
    case 'exercism':
      return await getExercismTask(difficulty);
    default:
      throw new Error(`Неизвестный API: ${source}`);
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
  if (!question) {
    throw new Error('Не удалось получить задачу с LeetCode');
  }

  console.log('Успешный ответ от LeetCode:', {
    id: question.questionId,
    title: question.title,
    difficulty: question.difficulty
  });

  // Обработка примеров
  const examples = question.exampleTestcases ? 
    question.exampleTestcases.split('\n\n').map(example => {
      const [input, output] = example.split('\n');
      return `Входные данные:\n${input}\n\nВыходные данные:\n${output}`;
    }) : [];

  // Обработка ограничений
  let constraints = [];
  if (question.content) {
    const constraintsMatch = question.content.match(/<p><strong>Constraints:<\/strong><\/p>([\s\S]*?)(?:<p>|$)/);
    if (constraintsMatch) {
      constraints = constraintsMatch[1]
        .split('</li>')
        .map(line => line.replace(/<[^>]+>/g, '').trim())
        .filter(line => line);
    }
  }

  // Обработка контента
  let content = '';
  if (question.content) {
    content = question.content
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return {
    id: question.questionId,
    title: question.title,
    titleSlug: question.titleSlug,
    difficulty: question.difficulty.toLowerCase(),
    categoryTitle: question.categoryTitle,
    content,
    examples,
    constraints,
    hints: question.hints || [],
    stats: question.stats,
    topicTags: question.topicTags || [],
    source: 'leetcode'
  };
}

// Получение задачи с Codeforces
async function getCodeforcesTask(difficulty) {
  try {
    // Получаем случайный контест
    const response = await fetch('https://codeforces.com/api/contest.list');
    const data = await response.json();
    
    if (data.status !== 'OK') {
      throw new Error('Ошибка при получении списка контестов');
    }

    // Фильтруем контесты по сложности
    const contests = data.result.filter(contest => {
      if (difficulty === 'easy') return contest.difficulty < 1500;
      if (difficulty === 'medium') return contest.difficulty >= 1500 && contest.difficulty < 2000;
      if (difficulty === 'hard') return contest.difficulty >= 2000;
      return true;
    });

    if (contests.length === 0) {
      throw new Error('Не найдены контесты с указанной сложностью');
    }

    // Выбираем случайный контест
    const randomContest = contests[Math.floor(Math.random() * contests.length)];
    const contestId = randomContest.id;

    // Получаем задачи контеста
    const problemsResponse = await fetch(`https://codeforces.com/api/contest.standings?contestId=${contestId}&from=1&count=1`);
    const problemsData = await problemsResponse.json();

    if (problemsData.status !== 'OK') {
      throw new Error('Ошибка при получении задач контеста');
    }

    const problems = problemsData.result.problems;
    if (problems.length === 0) {
      throw new Error('В контесте нет задач');
    }

    // Выбираем случайную задачу
    const randomProblem = problems[Math.floor(Math.random() * problems.length)];
    const problemIndex = randomProblem.index;

    // Получаем описание задачи
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    await page.goto(`https://codeforces.com/contest/${contestId}/problem/${problemIndex}`, {
      waitUntil: 'networkidle0',
      timeout: 30000
    });

    await page.waitForSelector('.problem-statement', { timeout: 10000 });

    const content = await page.evaluate(() => {
      const problemStatement = document.querySelector('.problem-statement');
      if (!problemStatement) return null;

      // Получаем заголовок
      const title = problemStatement.querySelector('.title')?.textContent || '';

      // Получаем описание
      const description = Array.from(problemStatement.querySelectorAll('.problem-statement > div'))
        .filter(div => {
          const text = div.textContent || '';
          return !text.includes('Input') && 
                 !text.includes('Output') && 
                 !text.includes('Example') &&
                 !text.includes('time limit') &&
                 !text.includes('memory limit') &&
                 !text.includes('Note');
        })
        .map(div => div.textContent.trim())
        .join('\n\n');

      // Получаем ограничения
      const constraints = Array.from(problemStatement.querySelectorAll('.problem-statement > div'))
        .filter(div => {
          const text = div.textContent || '';
          return text.includes('time limit') || 
                 text.includes('memory limit') ||
                 text.includes('Note');
        })
        .map(div => div.textContent.trim())
        .join('\n\n');

      // Получаем примеры
      const examples = Array.from(problemStatement.querySelectorAll('.sample-test'))
        .map(test => {
          const input = test.querySelector('.input pre')?.textContent || '';
          const output = test.querySelector('.output pre')?.textContent || '';
          return `Входные данные:\n${input}\n\nВыходные данные:\n${output}`;
        });

      return {
        title,
        description,
        constraints,
        examples
      };
    });

    await browser.close();

    if (!content) {
      throw new Error('Не удалось получить описание задачи');
    }

    return {
      title: content.title,
      source: 'codeforces',
      difficulty: difficulty || 'medium',
      content: `${content.description}\n\n${content.constraints}`,
      examples: content.examples,
      constraints: [content.constraints],
      hints: [],
      topicTags: []
    };
  } catch (error) {
    console.error('Ошибка при получении задачи с Codeforces:', error);
    throw error;
  }
}

// Получение задачи с Exercism
async function getExercismTask(difficulty) {
  console.log('Запрос к Exercism API');
  try {
    // Получаем список треков
    const response = await axios.get(EXERCISM_API_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const tracks = response.data.tracks;
    console.log(`Получено ${tracks.length} треков с Exercism`);

    // Выбираем случайный трек
    const randomTrack = tracks[Math.floor(Math.random() * tracks.length)];
    console.log('Выбран трек:', randomTrack.slug);

    // Получаем упражнения для трека
    const exercisesResponse = await axios.get(`${EXERCISM_API_URL}/${randomTrack.slug}/exercises`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const exercises = exercisesResponse.data.exercises;
    console.log(`Получено ${exercises.length} упражнений для трека ${randomTrack.slug}`);

    // Фильтруем упражнения по сложности
    let filteredExercises = exercises;
    if (difficulty) {
      const difficultyMap = {
        'easy': 'easy',
        'medium': 'medium',
        'hard': 'hard'
      };
      const targetDifficulty = difficultyMap[difficulty.toLowerCase()];
      
      if (targetDifficulty) {
        filteredExercises = exercises.filter(e => e.difficulty === targetDifficulty);
        console.log(`Отфильтровано ${filteredExercises.length} упражнений со сложностью ${difficulty}`);
      }
    }

    if (filteredExercises.length === 0) {
      throw new Error('Не найдено упражнений с указанной сложностью');
    }

    // Выбираем случайное упражнение
    const randomExercise = filteredExercises[Math.floor(Math.random() * filteredExercises.length)];
    console.log('Выбрано упражнение:', randomExercise.slug);

    // Получаем детали упражнения
    const exerciseResponse = await axios.get(`${EXERCISM_API_URL}/${randomTrack.slug}/exercises/${randomExercise.slug}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    const exercise = exerciseResponse.data.exercise;

    return {
      id: exercise.uuid,
      title: exercise.title,
      difficulty: exercise.difficulty,
      content: exercise.description,
      examples: exercise.examples || [],
      constraints: exercise.constraints || [],
      hints: exercise.hints || [],
      topicTags: exercise.topics || [],
      source: 'exercism',
      track: randomTrack.slug
    };
  } catch (error) {
    console.error('Ошибка при получении задачи с Exercism:', error);
    throw error;
  }
}

// Получение задачи с LeetCode по ID
async function getLeetCodeTaskById(taskId) {
  console.log('Запрос к LeetCode API для задачи:', taskId);
  const requestBody = {
    query: `
      query question($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
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
      titleSlug: taskId
    }
  };

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
    throw new Error(response.data.errors[0].message);
  }

  const question = response.data.data.question;
  if (!question) {
    throw new Error('Задача не найдена');
  }

  // Обработка примеров
  const examples = question.exampleTestcases ? 
    question.exampleTestcases.split('\n\n').map(example => {
      const [input, output] = example.split('\n');
      return `Входные данные:\n${input}\n\nВыходные данные:\n${output}`;
    }) : [];

  // Обработка ограничений
  let constraints = [];
  if (question.content) {
    const constraintsMatch = question.content.match(/<p><strong>Constraints:<\/strong><\/p>([\s\S]*?)(?:<p>|$)/);
    if (constraintsMatch) {
      constraints = constraintsMatch[1]
        .split('</li>')
        .map(line => line.replace(/<[^>]+>/g, '').trim())
        .filter(line => line);
    }
  }

  // Обработка контента
  let content = '';
  if (question.content) {
    content = question.content
      .replace(/<[^>]+>/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  return {
    id: question.questionId,
    title: question.title,
    titleSlug: question.titleSlug,
    difficulty: question.difficulty.toLowerCase(),
    categoryTitle: question.categoryTitle,
    content,
    examples,
    constraints,
    hints: question.hints || [],
    stats: question.stats,
    topicTags: question.topicTags || [],
    source: 'leetcode'
  };
}

// Получение задачи с Codeforces по ID
async function getCodeforcesTaskById(taskId) {
  console.log('Запрос к Codeforces API для задачи:', taskId);
  
  // Разбираем ID задачи (формат: contestId + index)
  const match = taskId.match(/^(\d+)([A-Za-z]+)$/);
  if (!match) {
    throw new Error('Неверный формат ID задачи Codeforces');
  }

  const [, contestId, index] = match;
  const problemDescription = await getCodeforcesProblemDescription(contestId, index);

  return {
    id: taskId,
    contestId: parseInt(contestId),
    index,
    ...problemDescription,
    source: 'codeforces',
    difficulty: 'medium' // По умолчанию
  };
}

// Получение задачи с Exercism по ID
async function getExercismTaskById(taskId) {
  console.log('Запрос к Exercism API для задачи:', taskId);
  
  // Получаем список треков
  const response = await axios.get(EXERCISM_API_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  const tracks = response.data.tracks;
  
  // Ищем задачу во всех треках
  for (const track of tracks) {
    try {
      const exerciseResponse = await axios.get(`${EXERCISM_API_URL}/${track.slug}/exercises/${taskId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });

      const exercise = exerciseResponse.data.exercise;
      if (exercise) {
        return {
          id: exercise.uuid,
          title: exercise.title,
          difficulty: exercise.difficulty,
          content: exercise.description,
          examples: exercise.examples || [],
          constraints: exercise.constraints || [],
          hints: exercise.hints || [],
          topicTags: exercise.topics || [],
          source: 'exercism',
          track: track.slug
        };
      }
    } catch (error) {
      console.log(`Задача не найдена в треке ${track.slug}`);
    }
  }

  throw new Error('Задача не найдена');
}

// Подключаем маршруты аутентификации
app.use('/api/auth', authRoutes);

// Маршрут для проверки аутентификации
app.get('/api/auth/check', authenticateToken, (req, res) => {
  res.json({ 
    authenticated: true,
    user: {
      id: req.user.id,
      username: req.user.username
    }
  });
});

// Защищенные маршруты
app.use('/api/attempts', authenticateToken);
app.use('/api/tasks', authenticateToken);

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

// Маршрут для обновления попытки
app.put('/api/attempts/:attemptId', authenticateToken, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { 
      status, 
      submitted_code, 
      time_spent,
      solution_language,
      solution_complexity,
      notes 
    } = req.body;

    console.log('Обновление попытки:', { 
      attemptId, 
      status, 
      submitted_code,
      time_spent,
      solution_language,
      solution_complexity,
      notes 
    });

    // Проверяем существование попытки
    const [attempts] = await pool.execute(
      'SELECT * FROM attempts WHERE id = ? AND user_id = ?',
      [attemptId, req.user.id]
    );

    if (attempts.length === 0) {
      return res.status(404).json({ error: 'Попытка не найдена' });
    }

    // Обновляем попытку
    await pool.execute(
      `UPDATE attempts 
      SET status = ?, 
          submitted_code = ?,
          timeSpent = ?,
          solution_language = ?,
          solution_complexity = ?,
          notes = ?,
          submission_time = NOW()
      WHERE id = ? AND user_id = ?`,
      [
        status, 
        submitted_code || null, 
        time_spent || 0,
        solution_language || null,
        solution_complexity || null,
        notes || null,
        attemptId, 
        req.user.id
      ]
    );

    res.json({ message: 'Попытка обновлена' });
  } catch (error) {
    console.error('Ошибка при обновлении попытки:', error);
    res.status(500).json({ error: 'Ошибка при обновлении попытки' });
  }
});

// Маршрут для получения истории попыток
app.get('/api/attempts', authenticateToken, async (req, res) => {
  try {
    const [attempts] = await pool.execute(
      `SELECT 
        a.id,
        a.user_id as userId,
        a.task_id as taskId,
        a.status,
        a.time_spent as timeSpent,
        a.submission_time as submissionTime,
        t.title,
        t.source,
        t.difficulty,
        t.content,
        t.examples,
        t.constraints,
        t.hints,
        t.topic_tags
      FROM attempts a
      LEFT JOIN tasks t ON a.task_id = t.id
      WHERE a.user_id = ?
      ORDER BY a.submission_time DESC`,
      [req.user.id]
    );

    // Преобразуем JSON строки в объекты
    const formattedAttempts = attempts.map(attempt => ({
      ...attempt,
      task: {
        title: attempt.title,
        source: attempt.source,
        difficulty: attempt.difficulty,
        content: attempt.content,
        examples: attempt.examples ? JSON.parse(attempt.examples) : [],
        constraints: attempt.constraints ? JSON.parse(attempt.constraints) : [],
        hints: attempt.hints ? JSON.parse(attempt.hints) : [],
        topicTags: attempt.topic_tags ? JSON.parse(attempt.topic_tags) : []
      }
    }));

    res.json(formattedAttempts);
  } catch (error) {
    console.error('Ошибка при получении истории попыток:', error);
    res.status(500).json({ error: 'Ошибка при получении истории попыток' });
  }
});

// Маршрут для получения случайной задачи
app.get('/api/tasks/random', authenticateToken, async (req, res) => {
  try {
    const { difficulty, source } = req.query;
    console.log('Получение случайной задачи:', { difficulty, source });

    // Получаем задачу из API
    const task = await getRandomTaskFromAPI(source || 'leetcode', difficulty);

    // Сохраняем задачу в базу данных
    const [result] = await pool.execute(
      `INSERT INTO tasks (
        title,
        source,
        difficulty,
        content,
        examples,
        constraints,
        hints,
        topic_tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.title || 'Без названия',
        task.source || 'unknown',
        task.difficulty || 'medium',
        task.content || '',
        JSON.stringify(task.examples || []),
        JSON.stringify(task.constraints || []),
        JSON.stringify(task.hints || []),
        JSON.stringify(task.topicTags || [])
      ]
    );

    // Создаем попытку
    const [attemptResult] = await pool.execute(
      `INSERT INTO attempts (
        user_id,
        task_id,
        status,
        submission_time
      ) VALUES (?, ?, 'in_progress', NOW())`,
      [req.user.id, result.insertId]
    );

    res.json({
      data: {
        randomQuestion: task
      },
      attemptId: attemptResult.insertId
    });
  } catch (error) {
    console.error('Ошибка при получении случайной задачи:', error);
    res.status(500).json({ error: 'Ошибка при получении случайной задачи' });
  }
});

// Маршрут для получения задачи по ID
app.get('/api/tasks/:taskId', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { source } = req.query;

    console.log('Получение задачи по ID:', { taskId, source });

    let task;
    switch (source) {
      case 'leetcode':
        task = await getLeetCodeTaskById(taskId);
        break;
      case 'codeforces':
        task = await getCodeforcesTaskById(taskId);
        break;
      case 'exercism':
        task = await getExercismTaskById(taskId);
        break;
      default:
        throw new Error('Неизвестный источник задачи');
    }

    if (!task) {
      throw new Error('Задача не найдена');
    }

    res.json({ data: { task } });
  } catch (error) {
    console.error('Ошибка при получении задачи:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения статистики пользователя
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    // Получаем общую статистику
    const [totalStats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_attempts,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_attempts,
        AVG(time_spent) as avg_time_spent
      FROM attempts 
      WHERE user_id = ?`,
      [req.user.id]
    );

    // Получаем статистику по источникам
    const [sourceStats] = await pool.execute(
      `SELECT 
        source,
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_attempts,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_attempts,
        AVG(time_spent) as avg_time_spent
      FROM attempts 
      WHERE user_id = ?
      GROUP BY source`,
      [req.user.id]
    );

    // Получаем статистику по сложности
    const [difficultyStats] = await pool.execute(
      `SELECT 
        difficulty,
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_attempts,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_attempts,
        AVG(time_spent) as avg_time_spent
      FROM attempts 
      WHERE user_id = ?
      GROUP BY difficulty`,
      [req.user.id]
    );

    // Получаем последние попытки
    const [recentAttempts] = await pool.execute(
      `SELECT * FROM attempts 
      WHERE user_id = ? 
      ORDER BY submission_time DESC 
      LIMIT 10`,
      [req.user.id]
    );

    res.json({
      total: totalStats[0],
      bySource: sourceStats,
      byDifficulty: difficultyStats,
      recentAttempts
    });
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения профиля пользователя
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      throw new Error('Пользователь не найден');
    }

    const user = users[0];

    // Получаем статистику пользователя
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_attempts,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_attempts,
        AVG(time_spent) as avg_time_spent
      FROM attempts 
      WHERE user_id = ?`,
      [req.user.id]
    );

    res.json({
      user,
      stats: stats[0]
    });
  } catch (error) {
    console.error('Ошибка при получении профиля:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для обновления профиля пользователя
app.put('/api/profile', authenticateToken, async (req, res) => {
  try {
    const { username, email, currentPassword, newPassword } = req.body;

    // Проверяем существование пользователя
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      throw new Error('Пользователь не найден');
    }

    const user = users[0];

    // Если меняется пароль
    if (currentPassword && newPassword) {
      // Проверяем текущий пароль
      const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
      if (!validPassword) {
        throw new Error('Неверный текущий пароль');
      }

      // Хешируем новый пароль
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(newPassword, salt);

      // Обновляем пароль
      await pool.execute(
        'UPDATE users SET password_hash = ? WHERE id = ?',
        [passwordHash, req.user.id]
      );
    }

    // Обновляем остальные поля
    if (username || email) {
      // Проверяем уникальность username и email
      const [existingUsers] = await pool.execute(
        'SELECT * FROM users WHERE (username = ? OR email = ?) AND id != ?',
        [username || user.username, email || user.email, req.user.id]
      );

      if (existingUsers.length > 0) {
        throw new Error('Пользователь с таким username или email уже существует');
      }

      // Обновляем профиль
      await pool.execute(
        'UPDATE users SET username = ?, email = ? WHERE id = ?',
        [username || user.username, email || user.email, req.user.id]
      );
    }

    // Получаем обновленный профиль
    const [updatedUsers] = await pool.execute(
      'SELECT id, username, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );

    res.json({
      user: updatedUsers[0],
      message: 'Профиль успешно обновлен'
    });
  } catch (error) {
    console.error('Ошибка при обновлении профиля:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения настроек пользователя
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const [settings] = await pool.execute(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    if (settings.length === 0) {
      // Создаем настройки по умолчанию
      const defaultSettings = {
        theme: 'light',
        language: 'ru',
        notifications: true,
        difficulty: 'medium',
        source: 'random'
      };

      await pool.execute(
        'INSERT INTO user_settings (user_id, settings) VALUES (?, ?)',
        [req.user.id, JSON.stringify(defaultSettings)]
      );

      res.json({ settings: defaultSettings });
    } else {
      res.json({ settings: JSON.parse(settings[0].settings) });
    }
  } catch (error) {
    console.error('Ошибка при получении настроек:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для обновления настроек пользователя
app.put('/api/settings', authenticateToken, async (req, res) => {
  try {
    const { settings } = req.body;

    // Проверяем существование настроек
    const [existingSettings] = await pool.execute(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.id]
    );

    if (existingSettings.length === 0) {
      // Создаем новые настройки
      await pool.execute(
        'INSERT INTO user_settings (user_id, settings) VALUES (?, ?)',
        [req.user.id, JSON.stringify(settings)]
      );
    } else {
      // Обновляем существующие настройки
      await pool.execute(
        'UPDATE user_settings SET settings = ? WHERE user_id = ?',
        [JSON.stringify(settings), req.user.id]
      );
    }

    res.json({
      settings,
      message: 'Настройки успешно обновлены'
    });
  } catch (error) {
    console.error('Ошибка при обновлении настроек:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения уведомлений пользователя
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const [notifications] = await pool.execute(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );

    res.json({ notifications });
  } catch (error) {
    console.error('Ошибка при получении уведомлений:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для отметки уведомления как прочитанного
app.put('/api/notifications/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    // Проверяем существование уведомления
    const [notifications] = await pool.execute(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );

    if (notifications.length === 0) {
      throw new Error('Уведомление не найдено');
    }

    // Отмечаем уведомление как прочитанное
    await pool.execute(
      'UPDATE notifications SET read = true WHERE id = ?',
      [notificationId]
    );

    res.json({ message: 'Уведомление отмечено как прочитанное' });
  } catch (error) {
    console.error('Ошибка при обновлении уведомления:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для удаления уведомления
app.delete('/api/notifications/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;

    // Проверяем существование уведомления
    const [notifications] = await pool.execute(
      'SELECT * FROM notifications WHERE id = ? AND user_id = ?',
      [notificationId, req.user.id]
    );

    if (notifications.length === 0) {
      throw new Error('Уведомление не найдено');
    }

    // Удаляем уведомление
    await pool.execute(
      'DELETE FROM notifications WHERE id = ?',
      [notificationId]
    );

    res.json({ message: 'Уведомление удалено' });
  } catch (error) {
    console.error('Ошибка при удалении уведомления:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения достижений пользователя
app.get('/api/achievements', authenticateToken, async (req, res) => {
  try {
    // Получаем все достижения пользователя
    const [achievements] = await pool.execute(
      `SELECT a.*, ua.progress, ua.completed_at 
      FROM achievements a 
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
      ORDER BY a.id`,
      [req.user.id]
    );

    // Получаем статистику пользователя для проверки прогресса
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_attempts,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_attempts,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_attempts,
        COUNT(DISTINCT source) as unique_sources,
        COUNT(DISTINCT difficulty) as unique_difficulties
      FROM attempts 
      WHERE user_id = ?`,
      [req.user.id]
    );

    // Обновляем прогресс достижений
    for (const achievement of achievements) {
      let progress = 0;
      let completed = false;

      switch (achievement.type) {
        case 'total_attempts':
          progress = Math.min(stats[0].total_attempts / achievement.target * 100, 100);
          completed = stats[0].total_attempts >= achievement.target;
          break;
        case 'completed_attempts':
          progress = Math.min(stats[0].completed_attempts / achievement.target * 100, 100);
          completed = stats[0].completed_attempts >= achievement.target;
          break;
        case 'unique_sources':
          progress = Math.min(stats[0].unique_sources / achievement.target * 100, 100);
          completed = stats[0].unique_sources >= achievement.target;
          break;
        case 'unique_difficulties':
          progress = Math.min(stats[0].unique_difficulties / achievement.target * 100, 100);
          completed = stats[0].unique_difficulties >= achievement.target;
          break;
      }

      // Если достижение выполнено и еще не отмечено
      if (completed && !achievement.completed_at) {
        await pool.execute(
          'INSERT INTO user_achievements (user_id, achievement_id, progress, completed_at) VALUES (?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE progress = ?, completed_at = NOW()',
          [req.user.id, achievement.id, progress, progress]
        );

        // Создаем уведомление о новом достижении
        await pool.execute(
          'INSERT INTO notifications (user_id, type, title, message, created_at) VALUES (?, ?, ?, ?, NOW())',
          [req.user.id, 'achievement', 'Новое достижение!', `Вы получили достижение "${achievement.title}"!`]
        );
      } else if (!completed && achievement.progress !== progress) {
        // Обновляем прогресс
        await pool.execute(
          'INSERT INTO user_achievements (user_id, achievement_id, progress) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE progress = ?',
          [req.user.id, achievement.id, progress, progress]
        );
      }
    }

    // Получаем обновленные достижения
    const [updatedAchievements] = await pool.execute(
      `SELECT a.*, ua.progress, ua.completed_at 
      FROM achievements a 
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
      ORDER BY a.id`,
      [req.user.id]
    );

    res.json({ achievements: updatedAchievements });
  } catch (error) {
    console.error('Ошибка при получении достижений:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения рейтинга пользователей
app.get('/api/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    let timeFilter = '';

    // Фильтр по периоду
    switch (period) {
      case 'week':
        timeFilter = 'AND submission_time >= DATE_SUB(NOW(), INTERVAL 1 WEEK)';
        break;
      case 'month':
        timeFilter = 'AND submission_time >= DATE_SUB(NOW(), INTERVAL 1 MONTH)';
        break;
      case 'year':
        timeFilter = 'AND submission_time >= DATE_SUB(NOW(), INTERVAL 1 YEAR)';
        break;
    }

    // Получаем рейтинг пользователей
    const [leaderboard] = await pool.execute(
      `SELECT 
        u.id,
        u.username,
        COUNT(DISTINCT a.id) as total_attempts,
        SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_attempts,
        SUM(CASE WHEN a.status = 'failed' THEN 1 ELSE 0 END) as failed_attempts,
        AVG(a.time_spent) as avg_time_spent,
        COUNT(DISTINCT ua.achievement_id) as achievements_count
      FROM users u
      LEFT JOIN attempts a ON u.id = a.user_id ${timeFilter}
      LEFT JOIN user_achievements ua ON u.id = ua.user_id
      GROUP BY u.id, u.username
      ORDER BY completed_attempts DESC, achievements_count DESC
      LIMIT 100`
    );

    // Получаем позицию текущего пользователя
    const [userRank] = await pool.execute(
      `SELECT rank
      FROM (
        SELECT 
          u.id,
          RANK() OVER (
            ORDER BY 
              SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) DESC,
              COUNT(DISTINCT ua.achievement_id) DESC
          ) as rank
        FROM users u
        LEFT JOIN attempts a ON u.id = a.user_id ${timeFilter}
        LEFT JOIN user_achievements ua ON u.id = ua.user_id
        GROUP BY u.id
      ) ranked
      WHERE id = ?`,
      [req.user.id]
    );

    res.json({
      leaderboard,
      userRank: userRank[0]?.rank || 0
    });
  } catch (error) {
    console.error('Ошибка при получении рейтинга:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения комментариев к задаче
app.get('/api/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Получаем комментарии
    const [comments] = await pool.execute(
      `SELECT 
        c.*,
        u.username,
        u.id as user_id,
        COUNT(cl.id) as likes_count,
        SUM(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END) as is_liked
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.task_id = ?
      GROUP BY c.id
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?`,
      [req.user.id, taskId, parseInt(limit), offset]
    );

    // Получаем общее количество комментариев
    const [total] = await pool.execute(
      'SELECT COUNT(*) as total FROM comments WHERE task_id = ?',
      [taskId]
    );

    res.json({
      comments,
      pagination: {
        total: total[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка при получении комментариев:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для создания комментария
app.post('/api/tasks/:taskId/comments', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      throw new Error('Комментарий не может быть пустым');
    }

    // Создаем комментарий
    const [result] = await pool.execute(
      'INSERT INTO comments (user_id, task_id, content, created_at) VALUES (?, ?, ?, NOW())',
      [req.user.id, taskId, content.trim()]
    );

    // Получаем созданный комментарий
    const [comments] = await pool.execute(
      `SELECT 
        c.*,
        u.username,
        u.id as user_id,
        0 as likes_count,
        0 as is_liked
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.id = ?`,
      [result.insertId]
    );

    res.json({ comment: comments[0] });
  } catch (error) {
    console.error('Ошибка при создании комментария:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для обновления комментария
app.put('/api/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      throw new Error('Комментарий не может быть пустым');
    }

    // Проверяем существование комментария
    const [comments] = await pool.execute(
      'SELECT * FROM comments WHERE id = ? AND user_id = ?',
      [commentId, req.user.id]
    );

    if (comments.length === 0) {
      throw new Error('Комментарий не найден или у вас нет прав на его редактирование');
    }

    // Обновляем комментарий
    await pool.execute(
      'UPDATE comments SET content = ?, updated_at = NOW() WHERE id = ?',
      [content.trim(), commentId]
    );

    // Получаем обновленный комментарий
    const [updatedComments] = await pool.execute(
      `SELECT 
        c.*,
        u.username,
        u.id as user_id,
        COUNT(cl.id) as likes_count,
        SUM(CASE WHEN cl.user_id = ? THEN 1 ELSE 0 END) as is_liked
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      LEFT JOIN comment_likes cl ON c.id = cl.comment_id
      WHERE c.id = ?
      GROUP BY c.id`,
      [req.user.id, commentId]
    );

    res.json({ comment: updatedComments[0] });
  } catch (error) {
    console.error('Ошибка при обновлении комментария:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для удаления комментария
app.delete('/api/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    // Проверяем существование комментария
    const [comments] = await pool.execute(
      'SELECT * FROM comments WHERE id = ? AND user_id = ?',
      [commentId, req.user.id]
    );

    if (comments.length === 0) {
      throw new Error('Комментарий не найден или у вас нет прав на его удаление');
    }

    // Удаляем комментарий
    await pool.execute(
      'DELETE FROM comments WHERE id = ?',
      [commentId]
    );

    res.json({ message: 'Комментарий удален' });
  } catch (error) {
    console.error('Ошибка при удалении комментария:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для лайка комментария
app.post('/api/comments/:commentId/like', authenticateToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    // Проверяем существование комментария
    const [comments] = await pool.execute(
      'SELECT * FROM comments WHERE id = ?',
      [commentId]
    );

    if (comments.length === 0) {
      throw new Error('Комментарий не найден');
    }

    // Проверяем, не лайкнул ли уже пользователь
    const [likes] = await pool.execute(
      'SELECT * FROM comment_likes WHERE comment_id = ? AND user_id = ?',
      [commentId, req.user.id]
    );

    if (likes.length > 0) {
      // Убираем лайк
      await pool.execute(
        'DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?',
        [commentId, req.user.id]
      );
    } else {
      // Добавляем лайк
      await pool.execute(
        'INSERT INTO comment_likes (comment_id, user_id, created_at) VALUES (?, ?, NOW())',
        [commentId, req.user.id]
      );
    }

    // Получаем обновленное количество лайков
    const [updatedLikes] = await pool.execute(
      'SELECT COUNT(*) as likes_count FROM comment_likes WHERE comment_id = ?',
      [commentId]
    );

    res.json({ likesCount: updatedLikes[0].likes_count });
  } catch (error) {
    console.error('Ошибка при обработке лайка:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения всех тегов
app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    // Получаем все теги
    const [tags] = await pool.execute(
      `SELECT 
        t.*,
        COUNT(DISTINCT a.id) as usage_count
      FROM tags t
      LEFT JOIN task_tags tt ON t.id = tt.tag_id
      LEFT JOIN attempts a ON tt.task_id = a.task_id
      GROUP BY t.id
      ORDER BY usage_count DESC`
    );

    res.json({ tags });
  } catch (error) {
    console.error('Ошибка при получении тегов:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения задач по тегу
app.get('/api/tags/:tagId/tasks', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    // Получаем задачи с указанным тегом
    const [tasks] = await pool.execute(
      `SELECT 
        t.*,
        COUNT(DISTINCT a.id) as attempts_count,
        COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) as completed_attempts
      FROM task_tags tt
      JOIN tasks t ON tt.task_id = t.id
      LEFT JOIN attempts a ON t.id = a.task_id
      WHERE tt.tag_id = ?
      GROUP BY t.id
      ORDER BY attempts_count DESC
      LIMIT ? OFFSET ?`,
      [tagId, parseInt(limit), offset]
    );

    // Получаем общее количество задач
    const [total] = await pool.execute(
      'SELECT COUNT(DISTINCT task_id) as total FROM task_tags WHERE tag_id = ?',
      [tagId]
    );

    res.json({
      tasks,
      pagination: {
        total: total[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total[0].total / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка при получении задач по тегу:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для создания тега
app.post('/api/tags', authenticateToken, async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      throw new Error('Название тега не может быть пустым');
    }

    // Проверяем существование тега
    const [existingTags] = await pool.execute(
      'SELECT * FROM tags WHERE name = ?',
      [name.trim()]
    );

    if (existingTags.length > 0) {
      throw new Error('Тег с таким названием уже существует');
    }

    // Создаем тег
    const [result] = await pool.execute(
      'INSERT INTO tags (name, description, created_at) VALUES (?, ?, NOW())',
      [name.trim(), description?.trim() || null]
    );

    // Получаем созданный тег
    const [tags] = await pool.execute(
      'SELECT * FROM tags WHERE id = ?',
      [result.insertId]
    );

    res.json({ tag: tags[0] });
  } catch (error) {
    console.error('Ошибка при создании тега:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для обновления тега
app.put('/api/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;
    const { name, description } = req.body;

    if (!name || name.trim().length === 0) {
      throw new Error('Название тега не может быть пустым');
    }

    // Проверяем существование тега
    const [existingTags] = await pool.execute(
      'SELECT * FROM tags WHERE name = ? AND id != ?',
      [name.trim(), tagId]
    );

    if (existingTags.length > 0) {
      throw new Error('Тег с таким названием уже существует');
    }

    // Обновляем тег
    await pool.execute(
      'UPDATE tags SET name = ?, description = ?, updated_at = NOW() WHERE id = ?',
      [name.trim(), description?.trim() || null, tagId]
    );

    // Получаем обновленный тег
    const [tags] = await pool.execute(
      'SELECT * FROM tags WHERE id = ?',
      [tagId]
    );

    res.json({ tag: tags[0] });
  } catch (error) {
    console.error('Ошибка при обновлении тега:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для удаления тега
app.delete('/api/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { tagId } = req.params;

    // Проверяем существование тега
    const [tags] = await pool.execute(
      'SELECT * FROM tags WHERE id = ?',
      [tagId]
    );

    if (tags.length === 0) {
      throw new Error('Тег не найден');
    }

    // Удаляем связи с задачами
    await pool.execute(
      'DELETE FROM task_tags WHERE tag_id = ?',
      [tagId]
    );

    // Удаляем тег
    await pool.execute(
      'DELETE FROM tags WHERE id = ?',
      [tagId]
    );

    res.json({ message: 'Тег удален' });
  } catch (error) {
    console.error('Ошибка при удалении тега:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для добавления тега к задаче
app.post('/api/tasks/:taskId/tags', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;
    const { tagId } = req.body;

    if (!tagId) {
      throw new Error('ID тега не указан');
    }

    // Проверяем существование задачи
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE id = ?',
      [taskId]
    );

    if (tasks.length === 0) {
      throw new Error('Задача не найдена');
    }

    // Проверяем существование тега
    const [tags] = await pool.execute(
      'SELECT * FROM tags WHERE id = ?',
      [tagId]
    );

    if (tags.length === 0) {
      throw new Error('Тег не найден');
    }

    // Проверяем существование связи
    const [existingLinks] = await pool.execute(
      'SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?',
      [taskId, tagId]
    );

    if (existingLinks.length > 0) {
      throw new Error('Тег уже добавлен к задаче');
    }

    // Создаем связь
    await pool.execute(
      'INSERT INTO task_tags (task_id, tag_id, created_at) VALUES (?, ?, NOW())',
      [taskId, tagId]
    );

    res.json({ message: 'Тег добавлен к задаче' });
  } catch (error) {
    console.error('Ошибка при добавлении тега к задаче:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для удаления тега из задачи
app.delete('/api/tasks/:taskId/tags/:tagId', authenticateToken, async (req, res) => {
  try {
    const { taskId, tagId } = req.params;

    // Проверяем существование связи
    const [links] = await pool.execute(
      'SELECT * FROM task_tags WHERE task_id = ? AND tag_id = ?',
      [taskId, tagId]
    );

    if (links.length === 0) {
      throw new Error('Связь между задачей и тегом не найдена');
    }

    // Удаляем связь
    await pool.execute(
      'DELETE FROM task_tags WHERE task_id = ? AND tag_id = ?',
      [taskId, tagId]
    );

    res.json({ message: 'Тег удален из задачи' });
  } catch (error) {
    console.error('Ошибка при удалении тега из задачи:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Маршрут для получения тегов задачи
app.get('/api/tasks/:taskId/tags', authenticateToken, async (req, res) => {
  try {
    const { taskId } = req.params;

    // Получаем теги задачи
    const [tags] = await pool.execute(
      `SELECT t.* 
      FROM tags t
      JOIN task_tags tt ON t.id = tt.tag_id
      WHERE tt.task_id = ?
      ORDER BY t.name`,
      [taskId]
    );

    res.json({ tags });
  } catch (error) {
    console.error('Ошибка при получении тегов задачи:', error);
    res.status(500).json({ error: error.message || 'Ошибка сервера' });
  }
});

// Обработка ошибок
function handleError(error, res) {
  console.error('Ошибка:', error);

  if (error.response) {
    // Ошибка от внешнего API
    console.error('Ответ от API:', {
      status: error.response.status,
      data: error.response.data
    });
    return res.status(error.response.status).json({
      error: 'Ошибка внешнего API',
      details: error.response.data
    });
  }

  if (error.request) {
    // Ошибка запроса
    console.error('Ошибка запроса:', error.request);
    return res.status(500).json({
      error: 'Ошибка при выполнении запроса',
      details: error.message
    });
  }

  // Другие ошибки
  return res.status(500).json({
    error: 'Внутренняя ошибка сервера',
    details: error.message
  });
}

// Обработка необработанных ошибок
process.on('unhandledRejection', (error) => {
  console.error('Необработанное отклонение промиса:', error);
});

process.on('uncaughtException', (error) => {
  console.error('Необработанное исключение:', error);
  process.exit(1);
});

// Тестовый эндпоинт
app.get('/api/test', (req, res) => {
  res.json({ message: 'Сервер работает!' });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Что-то пошло не так!' });
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
  console.log(`Тестовый эндпоинт доступен по адресу: http://localhost:${port}/api/test`);
}); 