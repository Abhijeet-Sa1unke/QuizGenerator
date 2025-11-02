const { query, getClient } = require('../config/database');
const { generateQuizFromAI } = require('../services/aiService');

// Create quiz manually
const createQuiz = async (req, res) => {
  const client = await getClient();
  
  try {
    const { title, subjectId, difficultyLevel, durationMinutes, questions } = req.body;
    const teacherId = req.user.id;

    await client.query('BEGIN');

    // Create quiz
    const quizResult = await client.query(
      `INSERT INTO quizzes (title, subject_id, teacher_id, difficulty_level, total_questions, duration_minutes)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, subjectId, teacherId, difficultyLevel, questions.length, durationMinutes]
    );

    const quiz = quizResult.rows[0];

    // Insert questions and options
    for (const q of questions) {
      const questionResult = await client.query(
        `INSERT INTO questions (quiz_id, question_text, question_type, points)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [quiz.id, q.questionText, q.questionType || 'multiple_choice', q.points || 1]
      );

      const question = questionResult.rows[0];

      // Insert options for multiple choice questions
      if (q.options && q.options.length > 0) {
        for (let i = 0; i < q.options.length; i++) {
          await client.query(
            `INSERT INTO question_options (question_id, option_text, is_correct, option_order)
             VALUES ($1, $2, $3, $4)`,
            [question.id, q.options[i].text, q.options[i].isCorrect, i + 1]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Quiz created successfully',
      quiz
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  } finally {
    client.release();
  }
};

// Generate quiz from PDF using AI
const generateQuizFromPDF = async (req, res) => {
  try {
    const { topics, numQuestions, difficulty, subjectId } = req.body;
    const teacherId = req.user.id;

    if (!req.file) {
      return res.status(400).json({ error: 'PDF file is required' });
    }

    // Generate quiz using AI service
    const quizData = await generateQuizFromAI(
      req.file.path,
      topics,
      numQuestions,
      difficulty
    );

    // Save quiz to database
    const client = await getClient();
    
    try {
      await client.query('BEGIN');

      const quizResult = await client.query(
        `INSERT INTO quizzes (title, subject_id, teacher_id, difficulty_level, total_questions, duration_minutes)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [quizData.title, subjectId, teacherId, difficulty, quizData.questions.length, 30]
      );

      const quiz = quizResult.rows[0];

      for (const q of quizData.questions) {
        const questionResult = await client.query(
          `INSERT INTO questions (quiz_id, question_text, question_type, points)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [quiz.id, q.question, 'multiple_choice', 1]
        );

        const question = questionResult.rows[0];

        for (let i = 0; i < q.options.length; i++) {
          await client.query(
            `INSERT INTO question_options (question_id, option_text, is_correct, option_order)
             VALUES ($1, $2, $3, $4)`,
            [question.id, q.options[i], q.correctAnswer === i, i + 1]
          );
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Quiz generated successfully',
        quiz
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Generate quiz error:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
};

// Get all quizzes for teacher
const getTeacherQuizzes = async (req, res) => {
  try {
    const teacherId = req.user.id;

    const result = await query(
      `SELECT q.*, s.name as subject_name,
       (SELECT COUNT(*) FROM quiz_assignments WHERE quiz_id = q.id) as students_assigned,
       (SELECT COALESCE(AVG(score), 0) FROM quiz_attempts WHERE quiz_id = q.id) as avg_score
       FROM quizzes q
       LEFT JOIN subjects s ON q.subject_id = s.id
       WHERE q.teacher_id = $1
       ORDER BY q.created_at DESC`,
      [teacherId]
    );

    res.json({ quizzes: result.rows });
  } catch (error) {
    console.error('Get teacher quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
};

// Get quiz details
const getQuizDetails = async (req, res) => {
  try {
    const { quizId } = req.params;

    const quizResult = await query(
      `SELECT q.*, s.name as subject_name, u.full_name as teacher_name
       FROM quizzes q
       LEFT JOIN subjects s ON q.subject_id = s.id
       LEFT JOIN users u ON q.teacher_id = u.id
       WHERE q.id = $1`,
      [quizId]
    );

    if (quizResult.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    const quiz = quizResult.rows[0];

    // Get questions with options
    const questionsResult = await query(
      `SELECT q.*, 
       json_agg(json_build_object(
         'id', qo.id,
         'optionText', qo.option_text,
         'isCorrect', qo.is_correct,
         'optionOrder', qo.option_order
       ) ORDER BY qo.option_order) as options
       FROM questions q
       LEFT JOIN question_options qo ON q.id = qo.question_id
       WHERE q.quiz_id = $1
       GROUP BY q.id
       ORDER BY q.id`,
      [quizId]
    );

    quiz.questions = questionsResult.rows;

    res.json({ quiz });
  } catch (error) {
    console.error('Get quiz details error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz details' });
  }
};

// Assign quiz to students
const assignQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const { studentIds, dueDate } = req.body;

    const client = await getClient();

    try {
      await client.query('BEGIN');

      for (const studentId of studentIds) {
        await client.query(
          `INSERT INTO quiz_assignments (quiz_id, student_id, due_date, status)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (quiz_id, student_id) DO NOTHING`,
          [quizId, studentId, dueDate, 'assigned']
        );
      }

      await client.query('COMMIT');

      res.json({ message: 'Quiz assigned successfully' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Assign quiz error:', error);
    res.status(500).json({ error: 'Failed to assign quiz' });
  }
};

// Delete quiz
const deleteQuiz = async (req, res) => {
  try {
    const { quizId } = req.params;
    const teacherId = req.user.id;

    const result = await query(
      'DELETE FROM quizzes WHERE id = $1 AND teacher_id = $2 RETURNING *',
      [quizId, teacherId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Quiz not found or unauthorized' });
    }

    res.json({ message: 'Quiz deleted successfully' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
};

module.exports = {
  createQuiz,
  generateQuizFromPDF,
  getTeacherQuizzes,
  getQuizDetails,
  assignQuiz,
  deleteQuiz
};