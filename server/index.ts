import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

const LEETCODE_API_URL = 'https://leetcode.com/graphql';

app.post('/api/leetcode/random', async (req, res) => {
  try {
    const { difficulty } = req.body;
    
    const response = await axios.post(
      LEETCODE_API_URL,
      {
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
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error('Ошибка при проксировании запроса к LeetCode:', error);
    res.status(500).json({ error: 'Ошибка при получении данных от LeetCode' });
  }
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
}); 