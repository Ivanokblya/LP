import React, { useState, useEffect, useCallback } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  CircularProgress,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  AppBar,
  Toolbar,
} from '@mui/material';
import { getRandomTask, updateAttempt, getAttempts } from './services/taskService';
import { login, register, logout, isAuthenticated, getCurrentUser } from './services/authService';
import Auth from './components/Auth';
import { Task, Difficulty, Source, Attempt, TaskResponse } from './types';

const DEEPL_API_KEY = 'your-api-key'; // Замените на ваш API ключ

async function translateText(text: string): Promise<string> {
  try {
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    if (cleanText.length > 400) {
      const parts = cleanText.split(/(?<=[.!?])\s+/);
      const translatedParts = await Promise.all(
        parts.map(part => translateText(part))
      );
      return translatedParts.join(' ');
    }

    console.log('Отправка текста на перевод:', cleanText);
    const encodedText = encodeURIComponent(cleanText);
    const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|ru`);

    if (!response.ok) {
      console.error('Ошибка перевода:', response.status, response.statusText);
      throw new Error('Translation failed');
    }

    const data = await response.json();
    console.log('Ответ от API перевода:', data);
    
    if (!data.responseData || !data.responseData.translatedText) {
      console.error('Нет переведенного текста в ответе:', data);
      return cleanText;
    }
    
    let translatedText = data.responseData.translatedText
      .replace(/QUERY LENGTH LIMIT EXCEEDED\. MAX ALLOWED QUERY : \d+ CHARS/g, '')
      .replace(/NO QUERY SPECIFIED\. EXAMPLE REQUEST: GET\?Q=HELLO&LANGPAIR=EN\|IT/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/(\d+)\s+(\d+)/g, '$1$2')
      .replace(/([.,!?])\s*/g, '$1 ')
      .trim();

    return translatedText;
  } catch (error) {
    console.error('Ошибка перевода:', error);
    return text;
  }
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(isAuthenticated());
  const [currentUser, setCurrentUser] = useState(getCurrentUser());
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [source, setSource] = useState<Source>('random');
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [timer, setTimer] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [translatedContent, setTranslatedContent] = useState('');

  // Загрузка истории попыток
  const loadAttempts = useCallback(async () => {
    try {
      const history = await getAttempts();
      setAttempts(Array.isArray(history) ? history : []);
    } catch (error) {
      console.error('Ошибка при загрузке истории:', error);
      setAttempts([]);
    }
  }, []);

  useEffect(() => {
    loadAttempts();
  }, [loadAttempts]);

  // Таймер
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timerActive) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timerActive]);

  useEffect(() => {
    if (currentTask && currentTask.source === 'leetcode' && currentTask.content) {
      console.log('Начинаем перевод задачи:', currentTask.content);
      const sections = currentTask.content.split(/(?=Example \d:|Constraints:|Input:|Output:|Explanation:)/);
      
      const cleanSections = sections.map(section => 
        section.trim().replace(/\n+/g, ' ').replace(/\s+/g, ' ')
      );

      Promise.all(cleanSections.map(section => translateText(section)))
        .then(translatedParts => {
          const translated = translatedParts.join('\n\n');
          console.log('Получен перевод:', translated);
          setTranslatedContent(translated);
        });
    } else {
      setTranslatedContent(currentTask?.content || '');
    }
  }, [currentTask]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGetRandomTask = async () => {
    setLoading(true);
    setError(null);
    try {
      const response: TaskResponse = await getRandomTask(difficulty, source);
      setCurrentTask(response.data.randomQuestion);
      setAttemptId(response.attemptId);
      setTimer(0);
      setTimerActive(true);
    } catch (error) {
      setError('Ошибка при получении задачи');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleTaskComplete = async (status: 'completed' | 'failed' | 'abandoned') => {
    if (!attemptId) return;
    
    setTimerActive(false);
    try {
      await updateAttempt(attemptId.toString(), status, undefined, timer);
      await loadAttempts();
      setCurrentTask(null);
      setAttemptId(null);
      setTimer(0);
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error);
      setError('Ошибка при обновлении статуса задачи');
    }
  };

  const handleLogin = async (username: string, password: string) => {
    try {
      const response = await login(username, password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setIsLoggedIn(true);
      setCurrentUser(response.user);
    } catch (error) {
      console.error('Ошибка входа:', error);
    }
  };

  const handleRegister = async (username: string, email: string, password: string) => {
    try {
      const response = await register(username, email, password);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setIsLoggedIn(true);
      setCurrentUser(response.user);
    } catch (error) {
      console.error('Ошибка регистрации:', error);
    }
  };

  const handleLogout = () => {
    logout();
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  if (!isLoggedIn) {
    return <Auth onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Генератор задач по программированию
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography>
              {currentUser?.username}
            </Typography>
            <Button color="inherit" onClick={handleLogout}>
              Выйти
            </Button>
          </Box>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            Генератор задач по программированию
          </Typography>

          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Сложность</InputLabel>
                <Select
                  value={difficulty}
                  label="Сложность"
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                >
                  <MenuItem value="easy">Легкая</MenuItem>
                  <MenuItem value="medium">Средняя</MenuItem>
                  <MenuItem value="hard">Сложная</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <FormControl fullWidth>
                <InputLabel>Источник</InputLabel>
                <Select
                  value={source}
                  label="Источник"
                  onChange={(e) => setSource(e.target.value as Source)}
                >
                  <MenuItem value="random">Случайный</MenuItem>
                  <MenuItem value="leetcode">LeetCode</MenuItem>
                  <MenuItem value="codeforces">Codeforces</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleGetRandomTask}
                disabled={loading}
                sx={{ height: '56px' }}
              >
                {loading ? <CircularProgress size={24} /> : 'Получить задачу'}
              </Button>
            </Grid>
          </Grid>

          {error && (
            <Typography color="error" align="center" sx={{ mb: 2 }}>
              {error}
            </Typography>
          )}

          {currentTask && (
            <Paper sx={{ p: 3, mb: 4 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6">
                  {currentTask.title}
                </Typography>
                <Chip
                  label={currentTask.source}
                  color="primary"
                  size="small"
                />
              </Box>
              <Typography variant="body1" gutterBottom>
                Сложность: {currentTask.difficulty}
              </Typography>
              <Typography variant="body1" gutterBottom>
                Категория: {currentTask.categoryTitle}
              </Typography>
              <Box sx={{ mb: 2 }}>
                {currentTask.topicTags?.map((tag: { name: string; slug: string }) => (
                  <Chip
                    key={tag.slug}
                    label={tag.name}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                  />
                ))}
              </Box>
              
              {currentTask.content && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Описание:
                  </Typography>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      whiteSpace: 'normal',
                      '& code': {
                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                        padding: '2px 4px',
                        borderRadius: '4px',
                        fontFamily: 'monospace'
                      },
                      '& p': {
                        marginBottom: '1em',
                        lineHeight: 1.6
                      },
                      '& ul, & ol': {
                        paddingLeft: '2em',
                        marginBottom: '1em'
                      },
                      '& li': {
                        marginBottom: '0.5em',
                        lineHeight: 1.6
                      },
                      '& sub, & sup': {
                        fontSize: '0.8em',
                        lineHeight: 0,
                        verticalAlign: 'super'
                      },
                      fontSize: '1rem',
                      lineHeight: 1.8,
                      textAlign: 'justify',
                      hyphens: 'auto',
                      '& > *': {
                        marginBottom: '1em'
                      }
                    }}
                    dangerouslySetInnerHTML={{ 
                      __html: translatedContent
                        .replace(/&nbsp;/g, ' ')
                        .replace(/&lt;/g, '<')
                        .replace(/&gt;/g, '>')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&#39;/g, "'")
                        .replace(/&apos;/g, "'")
                        .replace(/(\d+)\s*≤\s*([^≤]+)\s*≤\s*(\d+)/g, '$1 ≤ $2 ≤ $3')
                        .replace(/(\d+)\s*⋅\s*(\d+)/g, '$1 × $2')
                        .replace(/([a-zA-Z])\s*<sub>([^<]+)<\/sub>/g, '$1<sub>$2</sub>')
                        .replace(/([a-zA-Z])\s*<sup>([^<]+)<\/sup>/g, '$1<sup>$2</sup>')
                        .replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, '<code>$1</code>')
                        .replace(/\n{3,}/g, ' ')
                        .replace(/\s{2,}/g, ' ')
                        .replace(/<div[^>]*>([^<]*)<\/div>/g, '$1')
                        .replace(/<p[^>]*>([^<]*)<\/p>/g, '$1')
                        .replace(/Example (\d+):/g, 'Пример $1:')
                        .replace(/Input:/g, 'Входные данные:')
                        .replace(/Output:/g, 'Выходные данные:')
                        .replace(/Explanation:/g, 'Объяснение:')
                        .replace(/Constraints:/g, 'Ограничения:')
                        .replace(/(\d+)\s*<=\s*([^<]+)\s*<=\s*(\d+)/g, '$1 ≤ $2 ≤ $3')
                        .replace(/(\d+)\s*==\s*([^<]+)\s*==\s*(\d+)/g, '$1 = $2 = $3')
                        .replace(/Описание:/g, 'Описание:')
                        .replace(/ограничение по времени на тест/g, 'Ограничение по времени на тест:')
                        .replace(/ограничение по памяти на тест/g, 'Ограничение по памяти на тест:')
                        .replace(/Входные данные/g, 'Входные данные:')
                        .replace(/Выходные данные/g, 'Выходные данные:')
                        .replace(/([A-Z])\s*=\s*{([^}]+)}/g, '$1 = {$2}')
                        .replace(/(\d+)\s*,\s*(\d+)/g, '$1, $2')
                        .replace(/В (\w+) наборе входных данных/g, 'В $1 наборе входных данных:')
                    }}
                  />
                </Box>
              )}

              {currentTask.examples && currentTask.examples.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Примеры:
                  </Typography>
                  {currentTask.examples.map((example, index) => {
                    const [input, output] = example.split('\n\nВыходные данные:');
                    return (
                      <Box key={index} sx={{ mb: 3, p: 2, bgcolor: 'rgba(0, 0, 0, 0.02)', borderRadius: 1 }}>
                        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                          Пример {index + 1}:
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                              Входные данные:
                            </Typography>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                whiteSpace: 'pre-wrap', 
                                fontFamily: 'monospace',
                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                                p: 1,
                                borderRadius: 1
                              }}
                            >
                              {input.replace('Входные данные:', '').trim()}
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                              Выходные данные:
                            </Typography>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                whiteSpace: 'pre-wrap', 
                                fontFamily: 'monospace',
                                bgcolor: 'rgba(0, 0, 0, 0.04)',
                                p: 1,
                                borderRadius: 1
                              }}
                            >
                              {output.trim()}
                            </Typography>
                          </Box>
                          {example.includes('Explanation:') && (
                            <Box>
                              <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 0.5 }}>
                                Объяснение:
                              </Typography>
                              <Typography 
                                variant="body1" 
                                sx={{ 
                                  whiteSpace: 'pre-wrap',
                                  lineHeight: 1.6
                                }}
                              >
                                {example.split('Explanation:')[1].trim()}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              )}

              {currentTask.constraints && currentTask.constraints.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Ограничения:
                  </Typography>
                  <Box component="ul" sx={{ pl: 2 }}>
                    {currentTask.constraints.map((constraint, index) => (
                      <Typography 
                        key={index} 
                        component="li" 
                        variant="body1" 
                        sx={{ 
                          mb: 1,
                          lineHeight: 1.6,
                          '& code': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            fontFamily: 'monospace'
                          },
                          '& sub, & sup': {
                            fontSize: '0.8em',
                            lineHeight: 0
                          }
                        }}
                      >
                        <div
                          dangerouslySetInnerHTML={{ 
                            __html: constraint
                              .replace(/&lt;/g, '<')
                              .replace(/&gt;/g, '>')
                              .replace(/&amp;/g, '&')
                              .replace(/(\d+)\s*<sup>(\d+)<\/sup>/g, '$1<sup>$2</sup>')
                              .replace(/(\d+)\s*<sub>(\d+)<\/sub>/g, '$1<sub>$2</sub>')
                          }}
                        />
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              {currentTask.hints && currentTask.hints.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Подсказки:
                  </Typography>
                  <Box component="ol" sx={{ pl: 2 }}>
                    {currentTask.hints.map((hint, index) => (
                      <Typography 
                        key={index} 
                        component="li" 
                        variant="body1" 
                        sx={{ 
                          mb: 1,
                          lineHeight: 1.6
                        }}
                      >
                        {hint}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              <Typography variant="h6" gutterBottom>
                Время: {formatTime(timer)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => handleTaskComplete('completed')}
                >
                  Решено
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={() => handleTaskComplete('failed')}
                >
                  Не решено
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleTaskComplete('abandoned')}
                >
                  Пропустить
                </Button>
              </Box>
            </Paper>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setShowHistory(true)}
            >
              История попыток
            </Button>
          </Box>

          <Dialog
            open={showHistory}
            onClose={() => setShowHistory(false)}
            maxWidth="md"
            fullWidth
          >
            <DialogTitle>История попыток</DialogTitle>
            <DialogContent>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Дата</TableCell>
                      <TableCell>Задача</TableCell>
                      <TableCell>Источник</TableCell>
                      <TableCell>Сложность</TableCell>
                      <TableCell>Статус</TableCell>
                      <TableCell>Время</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Array.isArray(attempts) && attempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          {attempt.submissionTime ? new Date(attempt.submissionTime).toLocaleString() : 'Нет данных'}
                        </TableCell>
                        <TableCell>{attempt.task?.title || 'Задача не найдена'}</TableCell>
                        <TableCell>{attempt.task?.source || 'Неизвестно'}</TableCell>
                        <TableCell>{attempt.task?.difficulty || 'Неизвестно'}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              attempt.status === 'completed' ? 'Решено' :
                              attempt.status === 'failed' ? 'Не решено' :
                              attempt.status === 'abandoned' ? 'Пропущено' :
                              attempt.status === 'in_progress' ? 'В процессе' :
                              attempt.status
                            }
                            color={
                              attempt.status === 'completed'
                                ? 'success'
                                : attempt.status === 'failed'
                                ? 'error'
                                : 'default'
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{formatTime(attempt.timeSpent || 0)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setShowHistory(false)}>Закрыть</Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Container>
    </>
  );
}

export default App; 