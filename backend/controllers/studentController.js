const { query, getClient } = require('../config/database');

// Get student dashboard data
const getStudentDashboard = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get assigned quizzes with progress
    const quizzesResult = await query(
      `SELECT qa.*, q.title, q.total_questions, q.duration_minutes,
       s.name as subject_name, s.icon as subject_icon,
       qat.score, qat.completed_at,
       CASE 
         WHEN qat.completed_at IS NOT NULL THEN 'completed'
         WHEN qat.started_at IS NOT NULL THEN 'in_progress'
         ELSE 'assigned'
       END as status
       FROM quiz_assignments qa
       JOIN quizzes q ON qa.quiz_id = q.id
       JOIN subjects s ON q.subject_id = s.id
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       WHERE qa.student_id = $1
       ORDER BY qa.assigned_at DESC`,
      [studentId]
    );

    // Get progress by subject
    const progressResult = await query(
      `SELECT s.id, s.name, s.icon,
       COALESCE(sp.quizzes_completed, 0) as quizzes_completed,
       COALESCE(sp.total_quizzes_assigned, 0) as total_quizzes,
       COALESCE(sp.average_score, 0) as average_score
       FROM subjects s
       LEFT JOIN student_progress sp ON s.id = sp.subject_id AND sp.student_id = $1
       WHERE s.name != 'Daily Challenge'
       ORDER BY s.id`,
      [studentId]
    );

    // Get daily challenge
    const challengeResult = await query(
      `SELECT dc.*, ca.completed, ca.points_earned
       FROM daily_challenges dc
       LEFT JOIN challenge_attempts ca ON dc.id = ca.challenge_id AND ca.student_id = $1
       WHERE dc.challenge_date = CURRENT_DATE
       LIMIT 1`,
      [studentId]
    );

    const dashboard = {
      quizzes: quizzesResult.rows,
      subjects: progressResult.rows,
      dailyChallenge: challengeResult.rows[0] || null
    };

    res.json(dashboard);
  } catch (error) {
    console.error('Get student dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
};

// Start quiz attempt
const startQuiz = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const studentId = req.user.id;

    console.log('Starting quiz for assignmentId:', assignmentId, 'studentId:', studentId);

    // Verify assignment belongs to student
    const assignmentResult = await query(
      `SELECT qa.*, q.id as quiz_id, q.title, q.total_questions, q.duration_minutes
       FROM quiz_assignments qa
       JOIN quizzes q ON qa.quiz_id = q.id
       WHERE qa.id = $1 AND qa.student_id = $2`,
      [assignmentId, studentId]
    );

    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const assignment = assignmentResult.rows[0];

    // Check if already completed
    const existingAttempt = await query(
      'SELECT * FROM quiz_attempts WHERE assignment_id = $1 AND completed_at IS NOT NULL',
      [assignmentId]
    );

    if (existingAttempt.rows.length > 0) {
      return res.status(400).json({ error: 'Quiz already completed' });
    }

    // Create or get attempt - Fixed to handle both new and existing attempts
    let attempt;
    const checkAttempt = await query(
      'SELECT * FROM quiz_attempts WHERE assignment_id = $1',
      [assignmentId]
    );

    if (checkAttempt.rows.length > 0) {
      // Update existing attempt
      const attemptResult = await query(
        `UPDATE quiz_attempts 
         SET started_at = CURRENT_TIMESTAMP 
         WHERE assignment_id = $1 
         RETURNING *`,
        [assignmentId]
      );
      attempt = attemptResult.rows[0];
    } else {
      // Create new attempt
      const attemptResult = await query(
        `INSERT INTO quiz_attempts (assignment_id, student_id, quiz_id, total_points)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [assignmentId, studentId, assignment.quiz_id, assignment.total_questions]
      );
      attempt = attemptResult.rows[0];
    }

    // Update assignment status
    await query(
      `UPDATE quiz_assignments SET status = 'in_progress' WHERE id = $1`,
      [assignmentId]
    );

    // Get quiz questions - Fixed to return proper format
    const questionsResult = await query(
      `SELECT q.id, q.question_text, q.question_type, q.points,
       json_agg(json_build_object(
         'id', qo.id,
         'optionText', qo.option_text,
         'optionOrder', qo.option_order
       ) ORDER BY qo.option_order) as options
       FROM questions q
       LEFT JOIN question_options qo ON q.id = qo.question_id
       WHERE q.quiz_id = $1
       GROUP BY q.id
       ORDER BY q.id`,
      [assignment.quiz_id]
    );

    res.json({
      attempt: attempt,
      quiz: {
        title: assignment.title,
        durationMinutes: assignment.duration_minutes,
        questions: questionsResult.rows
      }
    });
  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
};

// Submit quiz answers
const submitQuiz = async (req, res) => {
  const client = await getClient();
  
  try {
    const { attemptId } = req.params;
    const { answers } = req.body; // Array of { questionId, selectedOptionId }
    const studentId = req.user.id;

    await client.query('BEGIN');

    // Verify attempt belongs to student
    const attemptResult = await client.query(
      'SELECT * FROM quiz_attempts WHERE id = $1 AND student_id = $2',
      [attemptId, studentId]
    );

    if (attemptResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Attempt not found' });
    }

    const attempt = attemptResult.rows[0];

    // Check if already completed
    if (attempt.completed_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Quiz already submitted' });
    }

    let totalScore = 0;
    let correctAnswers = 0;

    // Process each answer
    for (const answer of answers) {
      const optionResult = await client.query(
        'SELECT * FROM question_options WHERE id = $1',
        [answer.selectedOptionId]
      );

      if (optionResult.rows.length === 0) {
        continue; // Skip invalid options
      }

      const option = optionResult.rows[0];
      const isCorrect = option.is_correct;
      const pointsEarned = isCorrect ? 1 : 0;

      if (isCorrect) {
        correctAnswers++;
        totalScore += pointsEarned;
      }

      await client.query(
        `INSERT INTO student_answers (attempt_id, question_id, selected_option_id, is_correct, points_earned)
         VALUES ($1, $2, $3, $4, $5)`,
        [attemptId, answer.questionId, answer.selectedOptionId, isCorrect, pointsEarned]
      );
    }

    // Calculate score percentage
    const scorePercentage = attempt.total_points > 0 ? (totalScore / attempt.total_points) * 100 : 0;

    // Calculate time taken
    const timeTaken = Math.floor(
      (new Date() - new Date(attempt.started_at)) / 60000
    );

    // Update attempt
    await client.query(
      `UPDATE quiz_attempts 
       SET score = $1, completed_at = CURRENT_TIMESTAMP, time_taken_minutes = $2
       WHERE id = $3`,
      [scorePercentage, timeTaken, attemptId]
    );

    // Update assignment status
    await client.query(
      'UPDATE quiz_assignments SET status = $1 WHERE id = $2',
      ['completed', attempt.assignment_id]
    );

    // Update student progress
    const quizResult = await client.query(
      'SELECT subject_id FROM quizzes WHERE id = $1',
      [attempt.quiz_id]
    );

    const subjectId = quizResult.rows[0].subject_id;

    await client.query(
      `INSERT INTO student_progress (student_id, subject_id, total_quizzes_assigned, quizzes_completed, average_score)
       VALUES ($1, $2, 1, 1, $3)
       ON CONFLICT (student_id, subject_id) 
       DO UPDATE SET 
         quizzes_completed = student_progress.quizzes_completed + 1,
         average_score = (student_progress.average_score * student_progress.quizzes_completed + $3) / (student_progress.quizzes_completed + 1),
         last_activity = CURRENT_TIMESTAMP`,
      [studentId, subjectId, scorePercentage]
    );

    await client.query('COMMIT');

    res.json({
      message: 'Quiz submitted successfully',
      score: scorePercentage,
      correctAnswers,
      totalQuestions: attempt.total_points,
      timeTaken
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: error.message || 'Failed to submit quiz' });
  } finally {
    client.release();
  }
};

// Get quiz results
const getQuizResults = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const studentId = req.user.id;

    const attemptResult = await query(
      `SELECT qa.*, q.title, q.total_questions,
       qat.score, qat.completed_at, qat.time_taken_minutes,
       s.name as subject_name
       FROM quiz_attempts qat
       JOIN quiz_assignments qa ON qat.assignment_id = qa.id
       JOIN quizzes q ON qat.quiz_id = q.id
       JOIN subjects s ON q.subject_id = s.id
       WHERE qat.id = $1 AND qat.student_id = $2`,
      [attemptId, studentId]
    );

    if (attemptResult.rows.length === 0) {
      return res.status(404).json({ error: 'Results not found' });
    }

    const attempt = attemptResult.rows[0];

    // Get detailed answers
    const answersResult = await query(
      `SELECT sa.*, q.question_text, qo.option_text as selected_option,
       (SELECT option_text FROM question_options WHERE question_id = q.id AND is_correct = true LIMIT 1) as correct_option
       FROM student_answers sa
       JOIN questions q ON sa.question_id = q.id
       LEFT JOIN question_options qo ON sa.selected_option_id = qo.id
       WHERE sa.attempt_id = $1
       ORDER BY q.id`,
      [attemptId]
    );

    res.json({
      attempt,
      answers: answersResult.rows
    });
  } catch (error) {
    console.error('Get quiz results error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz results' });
  }
};

// Get student profile and stats
const getStudentProfile = async (req, res) => {
  try {
    const studentId = req.user.id;

    // Get basic stats
    const statsResult = await query(
      `SELECT 
       COUNT(DISTINCT qa.id) as total_quizzes_assigned,
       COUNT(DISTINCT CASE WHEN qat.completed_at IS NOT NULL THEN qat.id END) as quizzes_completed,
       COALESCE(AVG(qat.score), 0) as average_score,
       COUNT(DISTINCT sr.id) as rewards_earned
       FROM quiz_assignments qa
       LEFT JOIN quiz_attempts qat ON qa.id = qat.assignment_id
       LEFT JOIN student_rewards sr ON sr.student_id = $1
       WHERE qa.student_id = $1`,
      [studentId]
    );

    // Get recent activity
    const activityResult = await query(
      `SELECT q.title, s.name as subject, qat.score, qat.completed_at
       FROM quiz_attempts qat
       JOIN quizzes q ON qat.quiz_id = q.id
       JOIN subjects s ON q.subject_id = s.id
       WHERE qat.student_id = $1 AND qat.completed_at IS NOT NULL
       ORDER BY qat.completed_at DESC
       LIMIT 10`,
      [studentId]
    );

    res.json({
      user: req.user,
      stats: statsResult.rows[0],
      recentActivity: activityResult.rows
    });
  } catch (error) {
    console.error('Get student profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};

module.exports = {
  getStudentDashboard,
  startQuiz,
  submitQuiz,
  getQuizResults,
  getStudentProfile
};