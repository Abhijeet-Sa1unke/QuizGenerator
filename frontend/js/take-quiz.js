const API_URL = 'http://localhost:3000/api';

let currentQuestion = 0;
let questions = [];
let answers = {};
let attemptId = null;
let assignmentId = null;
let timerInterval = null;
let timeRemaining = 0;

function getAuthToken() {
    return localStorage.getItem('token');
}

function checkAuth() {
    const token = getAuthToken();
    const role = localStorage.getItem('userRole');
    
    if (!token || role !== 'student') {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

function getAssignmentId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('assignment');
}

async function loadQuiz() {
    assignmentId = getAssignmentId();
    
    if (!assignmentId) {
        alert('Invalid quiz assignment');
        window.location.href = '/student_dashboard';
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/student/quiz/${assignmentId}/start`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            attemptId = data.attempt.id;
            questions = data.quiz.questions;
            
            document.getElementById('quiz-title').textContent = data.quiz.title;
            document.getElementById('quiz-subject').textContent = 'Quiz';
            
            timeRemaining = data.quiz.durationMinutes * 60;
            startTimer();
            
            document.getElementById('loading-section').style.display = 'none';
            document.getElementById('quiz-section').style.display = 'block';
            
            displayQuestion();
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to load quiz');
            window.location.href = '/student_dashboard';
        }
    } catch (error) {
        console.error('Load quiz error:', error);
        alert('Network error. Please try again.');
        window.location.href = '/student_dashboard';
    }
}

function startTimer() {
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            alert('Time is up! Submitting quiz...');
            submitQuiz();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    document.getElementById('time-remaining').textContent = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    const timerElement = document.getElementById('timer');
    if (timeRemaining < 60) {
        timerElement.style.background = 'rgba(239, 68, 68, 0.3)';
    } else if (timeRemaining < 300) {
        timerElement.style.background = 'rgba(245, 158, 11, 0.3)';
    }
}

function displayQuestion() {
    const question = questions[currentQuestion];
    const container = document.getElementById('question-container');
    
    document.getElementById('question-progress').textContent = 
        `Question ${currentQuestion + 1} of ${questions.length}`;
    
    const progressPercent = ((currentQuestion + 1) / questions.length) * 100;
    document.getElementById('progress-fill').style.width = `${progressPercent}%`;
    
    const optionsHtml = question.options.map((option, index) => `
        <button class="option-button ${answers[question.id] === option.id ? 'selected' : ''}" 
                onclick="selectAnswer(${question.id}, ${option.id}, ${index})">
            <strong>${String.fromCharCode(65 + index)}.</strong> ${option.optionText}
        </button>
    `).join('');
    
    container.innerHTML = `
        <div class="question-number">Question ${currentQuestion + 1}</div>
        <div class="question-text">${question.question_text}</div>
        <div class="options-list">
            ${optionsHtml}
        </div>
    `;
    
    document.getElementById('prev-btn').disabled = currentQuestion === 0;
    
    if (currentQuestion === questions.length - 1) {
        document.getElementById('next-btn').style.display = 'none';
        document.getElementById('submit-btn').style.display = 'block';
    } else {
        document.getElementById('next-btn').style.display = 'block';
        document.getElementById('submit-btn').style.display = 'none';
    }
}

function selectAnswer(questionId, optionId, optionIndex) {
    answers[questionId] = optionId;
    
    const buttons = document.querySelectorAll('.option-button');
    buttons.forEach((btn, idx) => {
        if (idx === optionIndex) {
            btn.classList.add('selected');
        } else {
            btn.classList.remove('selected');
        }
    });
}

function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        displayQuestion();
    }
}

function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        displayQuestion();
    }
}

async function submitQuiz() {
    const unanswered = questions.filter(q => !answers[q.id]);
    if (unanswered.length > 0) {
        if (!confirm(`You have ${unanswered.length} unanswered question(s). Submit anyway?`)) {
            return;
        }
    }
    
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    const answersArray = questions.map(q => ({
        questionId: q.id,
        selectedOptionId: answers[q.id] || null
    })).filter(a => a.selectedOptionId !== null);
    
    try {
        const response = await fetch(`${API_URL}/student/quiz/${attemptId}/submit`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ answers: answersArray })
        });
        
        if (response.ok) {
            const data = await response.json();
            alert(`Quiz submitted!\n\nScore: ${data.score.toFixed(1)}%\nCorrect: ${data.correctAnswers}/${data.totalQuestions}`);
            window.location.href = `/quiz-results.html?attempt=${attemptId}`;
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to submit quiz');
        }
    } catch (error) {
        console.error('Submit quiz error:', error);
        alert('Network error. Please try again.');
    }
}

function logout() {
    if (confirm('Exit quiz? Progress will be lost.')) {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        localStorage.clear();
        window.location.href = '/student_dashboard';
    }
}

window.selectAnswer = selectAnswer;
window.nextQuestion = nextQuestion;
window.previousQuestion = previousQuestion;
window.submitQuiz = submitQuiz;

window.addEventListener('beforeunload', (e) => {
    if (attemptId && timerInterval) {
        e.preventDefault();
        e.returnValue = '';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadQuiz();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});