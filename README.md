# LeetCode & Codeforces Task Viewer

Приложение для просмотра и решения задач с LeetCode и Codeforces. Поддерживает автоматический перевод описаний задач с английского на русский язык.

## Авторы

### Разработчики
- **Славкин Данил** - [dan.slavkin@yandex.ru](mailto:dan.slavkin@yandex.ru)
- **Иван Перов** - [ivan.milashka2020@yandex.ru](mailto:ivan.milashka2020@yandex.ru)

### Руководитель проекта
- **Кирилл Бодров** - Преподаватель, ревьюер
  - GitHub: [@KiBodr](https://github.com/KiBodr)
  - Год: 2025

## Технологии

- React
- TypeScript
- Material-UI
- MyMemory Translation API

## Требования

- Node.js (версия 14 или выше)
- npm или 
- Доступ к интернету для работы с API

## Установка

1. Клонируйте репозиторий:
```bash
git clone https://github.com/Ivanokblya/LP
cd LP
```

2. Установите зависимости:
```bash
npm install


## Запуск

1. Запустите сервер разработки:
```bash
npm run dev


2. Откройте [http://localhost:3000](http://localhost:3000) в вашем браузере

## Использование API

### MyMemory Translation API

Приложение использует MyMemory Translation API для перевода описаний задач. API имеет следующие ограничения:
- Максимальная длина запроса: 500 символов
- Ограничение на количество запросов в день
- Не требует API ключа

### LeetCode API

Для работы с задачами LeetCode используется GraphQL API. Все запросы проходят через локальный сервер для безопасности.

### Codeforces API

Для работы с задачами Codeforces используется официальное API Codeforces.

## Структура проекта

```
src/
  ├── components/     # React компоненты
  ├── services/      # Сервисы для работы с API
  ├── types/         # TypeScript типы
  └── App.tsx        # Основной компонент приложения
```

## Функциональность

- Просмотр случайных задач с LeetCode и Codeforces
- Автоматический перевод описаний задач
- Отслеживание прогресса решения задач
- История решенных задач
- Фильтрация по сложности

## Разработка

Для разработки используйте:
```bash
npm run dev
# или


## Сборка

Для создания production сборки:
```bash
npm run build

## Лицензия

MIT 
