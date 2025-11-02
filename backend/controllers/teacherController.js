const { query } = require('../config/database');

// Get teacher dashboard overview
const getTeacherDashboard = async (req, res) => {
  try {
    const teacherId = req.user.id;

    // Get total stats
    const statsResult = await query(
      `SELECT 
       COUNT(DISTINCT q.id) as total_quizzes,
       COUNT(DISTINCT qa.student_id) as active_students,
       COUNT(DISTINCT q.subject_id) as subjects_taught,
       COALESCE(AVG(qat.score), 0) as average_performance
       FROM quizzes q
       LEFT JOIN quiz_assignments qa ON q.id = qa.quiz_id
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id AND qat.completed_at IS NOT NULL
       WHERE q.teacher_id = $1`,
      [teacherId]
    );

    // Get recent quizzes
    const quizzesResult = await query(
      `SELECT q.*, s.name as subject_name,
       COUNT(DISTINCT qa.student_id) as students_assigned,
       COALESCE(AVG(qat.score), 0) as avg_score,
       COUNT(DISTINCT CASE WHEN qat.completed_at IS NOT NULL THEN qa.student_id END) as completed_count
       FROM quizzes q
       JOIN subjects s ON q.subject_id = s.id
       LEFT JOIN quiz_assignments qa ON q.id = qa.quiz_id
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       WHERE q.teacher_id = $1
       GROUP BY q.id, s.name
       ORDER BY q.created_at DESC
       LIMIT 10`,
      [teacherId]
    );

    // Get class overview by subject
    const classOverviewResult = await query(
      `SELECT s.id, s.name, s.icon,
       COUNT(DISTINCT qa.student_id) as student_count,
       COUNT(DISTINCT q.id) as quiz_count,
       COALESCE(AVG(qat.score), 0) as avg_performance
       FROM subjects s
       LEFT JOIN quizzes q ON s.id = q.subject_id AND q.teacher_id = $1
       LEFT JOIN quiz_assignments qa ON q.id = qa.quiz_id
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id AND qat.completed_at IS NOT NULL
       WHERE s.name != 'Daily Challenge'
       GROUP BY s.id, s.name, s.icon
       ORDER BY s.id`,
      [teacherId]
    );

    res.json({
      stats: statsResult.rows[0],
      recentQuizzes: quizzesResult.rows,
      classOverview: classOverviewResult.rows
    });
  } catch (error) {
    console.error('Get teacher dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// Get all students
const getStudents = async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.email, u.full_name, u.profile_picture,
       COUNT(DISTINCT qa.id) as quizzes_assigned,
       COUNT(DISTINCT CASE WHEN qat.completed_at IS NOT NULL THEN qa.id END) as quizzes_completed,
       COALESCE(AVG(qat.score), 0) as average_score
       FROM users u
       LEFT JOIN quiz_assignments qa ON u.id = qa.student_id
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       WHERE u.role = 'student'
       GROUP BY u.id, u.email, u.full_name, u.profile_picture
       ORDER BY u.full_name`,
      []
    );

    res.json({ students: result.rows });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

// Get student progress details
const getStudentProgress = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Get student info
    const studentResult = await query(
      'SELECT id, email, full_name, profile_picture FROM users WHERE id = $1 AND role = $2',
      [studentId, 'student']
    );

    if (studentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get progress by subject
    const progressResult = await query(
      `SELECT s.name as subject, 
       COUNT(DISTINCT qa.id) as quizzes_assigned,
       COUNT(DISTINCT CASE WHEN qat.completed_at IS NOT NULL THEN qa.id END) as quizzes_completed,
       COALESCE(AVG(qat.score), 0) as average_score
       FROM subjects s
       LEFT JOIN quizzes q ON s.id = q.subject_id
       LEFT JOIN quiz_assignments qa ON q.id = qa.quiz_id AND qa.student_id = $1
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       WHERE s.name != 'Daily Challenge'
       GROUP BY s.id, s.name
       ORDER BY s.name`,
      [studentId]
    );

    // Get recent quiz attempts
    const attemptsResult = await query(
      `SELECT q.title, s.name as subject, qat.score, qat.completed_at, qat.time_taken_minutes
       FROM quiz_attempts qat
       JOIN quizzes q ON qat.quiz_id = q.id
       JOIN subjects s ON q.subject_id = s.id
       WHERE qat.student_id = $1
       ORDER BY qat.completed_at DESC
       LIMIT 15`,
      [studentId]
    );

    res.json({
      student: studentResult.rows[0],
      progress: progressResult.rows,
      recentAttempts: attemptsResult.rows
    });
  } catch (error) {
    console.error('Get student progress error:', error);
    res.status(500).json({ error: 'Failed to fetch student progress' });
  }
};

// Get quiz analytics
const getQuizAnalytics = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user.id;

    // Verify quiz belongs to teacher
    const quizResult = await query(
      'SELECT * FROM quizzes WHERE id = $1 AND teacher_id = $2',
      [quizId, teacherId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Get overall stats
    const statsResult = await query(
      `SELECT 
       COUNT(DISTINCT qa.student_id) as total_students,
       COUNT(DISTINCT CASE WHEN qat.completed_at IS NOT NULL THEN qa.student_id END) as completed_count,
       COALESCE(AVG(qat.score), 0) as average_score,
       COALESCE(MAX(qat.score), 0) as highest_score,
       COALESCE(MIN(qat.score), 0) as lowest_score,
       COALESCE(AVG(qat.time_taken_minutes), 0) as avg_time_taken
       FROM quiz_assignments qa
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       WHERE qa.quiz_id = $1`,
      [quizId]
    );

    // Get question-wise analysis
    const questionAnalysisResult = await query(
      `SELECT q.id, q.question_text,
       COUNT(sa.id) as total_answers,
       COUNT(CASE WHEN sa.is_correct THEN 1 END) as correct_answers,
       ROUND(COUNT(CASE WHEN sa.is_correct THEN 1 END)::numeric / NULLIF(COUNT(sa.id), 0) * 100, 2) as success_rate
       FROM questions q
       LEFT JOIN student_answers sa ON q.id = sa.question_id
       WHERE q.quiz_id = $1
       GROUP BY q.id, q.question_text
       ORDER BY success_rate ASC`,
      [quizId]
    );

    // Get student performance list
    const studentPerformanceResult = await query(
      `SELECT u.full_name, u.email,
       qat.score, qat.completed_at, qat.time_taken_minutes,
       qa.status
       FROM quiz_assignments qa
       JOIN users u ON qa.student_id = u.id
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       WHERE qa.quiz_id = $1
       ORDER BY qat.score DESC NULLS LAST`,
      [quizId]
    );

    res.json({
      quiz: quizResult.rows[0],
      stats: statsResult.rows[0],
      questionAnalysis: questionAnalysisResult.rows,
      studentPerformance: studentPerformanceResult.rows
    });
  } catch (error) {
    console.error('Get quiz analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz analytics' });
  }
};

// Export student data
const exportStudentData = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const result = await query(
      `SELECT u.full_name, u.email, s.name as subject,
       COUNT(DISTINCT qa.id) as quizzes_assigned,
       COUNT(DISTINCT CASE WHEN qat.completed_at IS NOT NULL THEN qa.id END) as quizzes_completed,
       COALESCE(AVG(qat.score), 0) as average_score,
       MAX(qat.completed_at) as last_activity
       FROM users u
       LEFT JOIN quiz_assignments qa ON u.id = qa.student_id
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       LEFT JOIN quizzes q ON qa.quiz_id = q.id
       LEFT JOIN subjects s ON q.subject_id = s.id
       WHERE u.role = 'student' AND (q.teacher_id = $1 OR q.teacher_id IS NULL)
       GROUP BY u.id, u.full_name, u.email, s.name
       ORDER BY u.full_name, s.name`,
      [teacherId]
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Export student data error:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
};

module.exports = {
  getTeacherDashboard,
  getStudents,
  getStudentProgress,
  getQuizAnalytics,
  exportStudentData
};