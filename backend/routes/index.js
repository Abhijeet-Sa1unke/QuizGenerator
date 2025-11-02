const express = require('express');
const passport = require('passport');
const multer = require('multer');
const path = require('path');

const authController = require('../controllers/authController');
const quizController = require('../controllers/quizController');
const studentController = require('../controllers/studentController');
const teacherController = require('../controllers/teacherController');
const { authenticateToken, isTeacher, isStudent } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

// ============ Authentication Routes ============
router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/auth/current', authenticateToken, authController.getCurrentUser);
router.post('/auth/logout', authenticateToken, authController.logout);

// Google OAuth routes
router.get('/auth/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: '/login.html',
    session: false 
  }),
  authController.googleCallback
);

// ============ Student Routes ============
router.get('/student/dashboard', authenticateToken, isStudent, studentController.getStudentDashboard);
router.get('/student/profile', authenticateToken, isStudent, studentController.getStudentProfile);
router.post('/student/quiz/:assignmentId/start', authenticateToken, isStudent, studentController.startQuiz);
router.post('/student/quiz/:attemptId/submit', authenticateToken, isStudent, studentController.submitQuiz);
router.get('/student/quiz/:attemptId/results', authenticateToken, isStudent, studentController.getQuizResults);

// ============ Teacher Routes ============
router.get('/teacher/dashboard', authenticateToken, isTeacher, teacherController.getTeacherDashboard);
router.get('/teacher/students', authenticateToken, isTeacher, teacherController.getStudents);
router.get('/teacher/student/:studentId/progress', authenticateToken, isTeacher, teacherController.getStudentProgress);
router.get('/teacher/quiz/:quizId/analytics', authenticateToken, isTeacher, teacherController.getQuizAnalytics);
router.get('/teacher/export/students', authenticateToken, isTeacher, teacherController.exportStudentData);

// ============ Quiz Routes (Teacher) ============
router.post('/quiz/create', authenticateToken, isTeacher, quizController.createQuiz);
router.post('/quiz/generate', authenticateToken, isTeacher, upload.single('pdf'), quizController.generateQuizFromPDF);
router.get('/quiz/list', authenticateToken, isTeacher, quizController.getTeacherQuizzes);
router.get('/quiz/:quizId', authenticateToken, quizController.getQuizDetails);
router.post('/quiz/:quizId/assign', authenticateToken, isTeacher, quizController.assignQuiz);
router.delete('/quiz/:quizId', authenticateToken, isTeacher, quizController.deleteQuiz);

// ============ Subject Routes ============
router.get('/subjects', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../config/database');
    const result = await query('SELECT * FROM subjects ORDER BY id');
    res.json({ subjects: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch subjects' });
  }
});

// ============ Health Check ============
router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'EduPlay API is running' });
});

module.exports = router;