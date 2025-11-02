const fs = require('fs');
const pdfParse = require('pdf-parse');
const axios = require('axios');

// Generate quiz from PDF using OpenAI
const generateQuizFromAI = async (pdfPath, topics, numQuestions, difficulty) => {
  try {
    // Read and parse PDF
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    // Prepare prompt for OpenAI
    const prompt = `Based on the following document content, generate ${numQuestions} multiple choice questions at ${difficulty} difficulty level focusing on these topics: ${topics.join(', ')}.

Document Content:
${pdfText.substring(0, 3000)} 

Please return a JSON object with the following structure:
{
  "title": "Quiz Title",
  "questions": [
    {
      "question": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0
    }
  ]
}

Make sure all questions are clear, educational, and at the specified difficulty level.`;

    // Call OpenAI API
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educator creating educational quizzes. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const quizData = JSON.parse(response.data.choices[0].message.content);

    // Clean up uploaded file
    fs.unlinkSync(pdfPath);

    return quizData;
  } catch (error) {
    console.error('AI quiz generation error:', error);
    
    // Clean up file on error
    if (fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    // Return fallback quiz if AI fails
    return {
      title: `${topics[0]} Quiz - ${difficulty}`,
      questions: generateFallbackQuestions(topics, numQuestions, difficulty)
    };
  }
};

// Generate fallback questions if AI service fails
const generateFallbackQuestions = (topics, numQuestions, difficulty) => {
  const questions = [];
  
  for (let i = 0; i < numQuestions; i++) {
    questions.push({
      question: `Question ${i + 1} about ${topics[0]}`,
      options: [
        'Option A',
        'Option B',
        'Option C',
        'Option D'
      ],
      correctAnswer: 0
    });
  }
  
  return questions;
};

module.exports = {
  generateQuizFromAI
};