const express = require('express');
const cors = require('cors');
const session = require('express-session');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const passport = require('./config/passport');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Create uploads directory if it doesn't exist
const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// ============ Middleware ============
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// ============ API Routes ============
app.use('/api', routes);

// ============ Frontend Routes ============
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/index.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/login.html'));
});

app.get('/register.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/register.html'));
});

app.get('/student_dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/student-dashboard.html'));
});

app.get('/teacher_dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/teacher-dashboard.html'));
});

app.get('/quiz-forge.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/quiz-forge.html'));
});

app.get('/take-quiz.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/take-quiz.html'));
});

app.get('/quiz-results.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/quiz-results.html'));
});

app.get('/auth-success.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pages/auth-success.html'));
});

// ============ Error Handling ============
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ============ Start Server ============
app.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║     🎓 EduPlay Server Running 🎓     ║
  ╠═══════════════════════════════════════╣
  ║  Port: ${PORT}                        
  ║  Environment: ${process.env.NODE_ENV || 'development'}
  ║  Frontend: http://localhost:${PORT}
  ║  API: http://localhost:${PORT}/api
  ╚═══════════════════════════════════════╝
  `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});

module.exports = app;