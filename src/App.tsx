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
} from '@mui/material';
import { getRandomTask, updateAttempt, getAttempts } from './services/taskService';
import { Task, Difficulty, Source, Attempt, TaskResponse } from './types';

function App() {
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

  // Загрузка истории попыток
  const loadAttempts = useCallback(async () => {
    try {
      const history = await getAttempts();
      setAttempts(history);
    } catch (error) {
      console.error('Ошибка при загрузке истории:', error);
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
      await updateAttempt(attemptId, status, timer);
      await loadAttempts();
      setCurrentTask(null);
      setAttemptId(null);
      setTimer(0);
    } catch (error) {
      console.error('Ошибка при обновлении статуса:', error);
    }
  };

  return (
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
                <MenuItem value="exercism">Exercism</MenuItem>
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
              {currentTask.topicTags.map((tag) => (
                <Chip
                  key={tag.slug}
                  label={tag.name}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
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
                  {attempts.map((attempt) => (
                    <TableRow key={attempt.id}>
                      <TableCell>
                        {new Date(attempt.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell>{attempt.task.title}</TableCell>
                      <TableCell>{attempt.task.source}</TableCell>
                      <TableCell>{attempt.task.difficulty}</TableCell>
                      <TableCell>
                        <Chip
                          label={attempt.status}
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
                      <TableCell>{formatTime(attempt.timeSpent)}</TableCell>
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
  );
}

export default App; 