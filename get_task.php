<?php
$difficulty = $_POST['difficulty'] ?? 'easy';

echo "<h1>Вы выбрали: " . htmlspecialchars($difficulty) . "</h1>";
echo "<p>Здесь будет случайная задача с LeetCode...</p>";
echo "<a href='index.php'>Назад</a>";
