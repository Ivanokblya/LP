require('dotenv').config();

module.exports = {
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  PORT: process.env.PORT || 3001,
  DB_CONFIG: {
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',
    database: 'programming_tasks',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }
}; 