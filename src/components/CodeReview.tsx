import React from 'react';
import { Box, Typography, Paper, List, ListItem, ListItemText, Chip } from '@mui/material';

interface CodeReviewProps {
  review: {
    review: string;
    score: number;
    suggestions: string[];
  };
}

export const CodeReview: React.FC<CodeReviewProps> = ({ review }) => {
  const getScoreColor = (score: number) => {
    if (score >= 8) return 'success';
    if (score >= 6) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Результаты проверки:
      </Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ mr: 2 }}>
            Оценка:
          </Typography>
          <Chip
            label={`${review.score}/10`}
            color={getScoreColor(review.score)}
          />
        </Box>
        
        <Typography variant="body1" paragraph>
          {review.review}
        </Typography>
      </Paper>

      {review.suggestions && review.suggestions.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Рекомендации по улучшению:
          </Typography>
          <List>
            {review.suggestions.map((suggestion, index) => (
              <ListItem key={index}>
                <ListItemText primary={suggestion} />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
}; 