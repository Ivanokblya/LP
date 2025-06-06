import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Button, 
  Card, 
  CardContent,
  CircularProgress,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Stack
} from '@mui/material';
import { leetcodeService } from './services/leetcodeService';
import { LeetCodeProblem } from './types/leetcode';

function App() {
  const [currentTask, setCurrentTask] = useState<LeetCodeProblem | null>(null);
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<'Easy' | 'Medium' | 'Hard' | ''>('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getRandomTask = async () => {
    setLoading(true);
    try {
      const task = await leetcodeService.getRandomQuestion(
        selectedDifficulty || undefined
      );
      setCurrentTask(task);
      setTimer(0);
      setIsTimerRunning(true);
    } catch (error) {
      console.error('Ошибка при получении задачи:', error);
    }
    setLoading(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'success';
      case 'Medium':
        return 'warning';
      case 'Hard':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom>
          Рандомайзер задач программирования
        </Typography>
        
        <Box sx={{ my: 2 }}>
          <Typography variant="h5" gutterBottom>
            Таймер: {formatTime(timer)}
          </Typography>
        </Box>

        <FormControl sx={{ m: 2, minWidth: 200 }}>
          <InputLabel>Сложность</InputLabel>
          <Select
            value={selectedDifficulty}
            label="Сложность"
            onChange={(e) => setSelectedDifficulty(e.target.value as any)}
          >
            <MenuItem value="">Любая</MenuItem>
            <MenuItem value="Easy">Легкая</MenuItem>
            <MenuItem value="Medium">Средняя</MenuItem>
            <MenuItem value="Hard">Сложная</MenuItem>
          </Select>
        </FormControl>

        <Button 
          variant="contained" 
          onClick={getRandomTask}
          disabled={loading}
          sx={{ my: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Получить случайную задачу'}
        </Button>

        {currentTask && (
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="h5" component="div">
                {currentTask.title}
              </Typography>
              <Chip 
                label={currentTask.difficulty}
                color={getDifficultyColor(currentTask.difficulty)}
                sx={{ my: 1 }}
              />
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Категория: {currentTask.categoryTitle}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                {currentTask.topicTags.map((tag) => (
                  <Chip 
                    key={tag.slug}
                    label={tag.name}
                    size="small"
                  />
                ))}
              </Stack>
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Принято решений: {currentTask.stats.totalAccepted}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Процент успешных решений: {currentTask.stats.acRate.toFixed(1)}%
                </Typography>
              </Box>
              <Button 
                href={leetcodeService.getProblemUrl(currentTask.titleSlug)}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
                sx={{ mt: 2 }}
              >
                Открыть задачу
              </Button>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
}

export default App; 