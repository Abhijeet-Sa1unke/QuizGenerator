const API_URL = 'http://localhost:3000/api';

// Get auth token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Check authentication
function checkAuth() {
    const token = getAuthToken();
    const role = localStorage.getItem('userRole');
    
    if (!token || role !== 'student') {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Load student dashboard
async function loadDashboard() {
    if (!checkAuth()) return;
    
    try {
        console.log('Fetching dashboard data...'); // Debug
        const response = await fetch(`${API_URL}/student/dashboard`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        console.log('Dashboard response status:', response.status); // Debug
        
        if (response.ok) {
            const data = await response.json();
            console.log('Dashboard data received:', data); // Debug
            displayDashboard(data);
        } else if (response.status === 401) {
            logout();
        } else {
            const errorData = await response.json();
            console.error('Dashboard error:', errorData); // Debug
            showError('Failed to load dashboard');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        showError('Network error. Please try again.');
    }
}

// Display dashboard data
function displayDashboard(data) {
    // Set student name
    const studentName = localStorage.getItem('userName') || 'Student';
    document.getElementById('student-name').textContent = studentName;
    
    // Update subjects with actual data
    if (data.subjects && data.subjects.length > 0) {
        updateSubjectsDisplay(data.subjects);
    }
    
    // Display assigned quizzes
    if (data.quizzes && data.quizzes.length > 0) {
        displayQuizzes(data.quizzes);
    } else {
        document.getElementById('quizzes-list').innerHTML = '<p class="no-data">No quizzes assigned yet.</p>';
    }
    
    // Display daily challenge
    if (data.dailyChallenge) {
        displayDailyChallenge(data.dailyChallenge);
    }
}

// Update subjects display with real data
function updateSubjectsDisplay(subjects) {
    const icons = {
        'Mathematics': '➕',
        'Science': '🔬',
        'Technology': '💻',
        'Daily Challenge': '🏆'
    };
    
    const colors = {
        'Mathematics': 'red',
        'Science': 'green',
        'Technology': 'blue',
        'Daily Challenge': 'yellow'
    };
    
    subjects.forEach((subject, index) => {
        const cards = document.querySelectorAll('.subject-card');
        if (cards[index]) {
            const percentage = subject.average_score || 0;
            const completed = subject.quizzes_completed || 0;
            const total = subject.total_quizzes || 0;
            
            // Update progress circle
            const circle = cards[index].querySelector('circle:last-child');
            if (circle) {
                const circumference = 339.292;
                const offset = circumference - (circumference * percentage / 100);
                circle.setAttribute('stroke-dashoffset', offset);
            }
            
            // Update text
            const progressText = cards[index].querySelector('.progress-text');
            if (progressText) {
                progressText.textContent = `${Math.round(percentage)}%`;
            }
        }
    });
}

// Display quizzes list
function displayQuizzes(quizzes) {
    const quizzesList = document.getElementById('quizzes-list');
    
    console.log('All quizzes received:', quizzes); // Debug: see all quiz data
    
    // Clear the list first
    quizzesList.innerHTML = '';
    
    // Create quiz items with proper event listeners
    quizzes.forEach((quiz, index) => {
        console.log(`Quiz ${index}:`, quiz); // Debug: see individual quiz
        
        const quizItem = document.createElement('div');
        quizItem.className = 'quiz-item';
        
        const quizInfo = document.createElement('div');
        quizInfo.className = 'quiz-info';
        quizInfo.innerHTML = `
            <h3>${quiz.title}</h3>
            <p class="quiz-meta">
                ${quiz.subject_name} • ${quiz.total_questions} questions • 
                ${quiz.duration_minutes} minutes
            </p>
        `;
        
        const quizActions = document.createElement('div');
        quizActions.className = 'quiz-actions';
        
        if (quiz.status === 'completed') {
            quizActions.innerHTML = `<span class="quiz-status completed">Completed - ${Math.round(quiz.score)}%</span>`;
        } else {
            const startBtn = document.createElement('button');
            startBtn.className = 'btn-start';
            startBtn.textContent = quiz.status === 'in_progress' ? 'Continue' : 'Start';
            
            // Use event listener instead of inline onclick
            startBtn.addEventListener('click', () => {
                console.log('Button clicked for quiz:', quiz); // Debug
                console.log('Assignment ID:', quiz.id); // Debug
                startQuiz(quiz.id);
            });
            
            quizActions.appendChild(startBtn);
        }
        
        quizItem.appendChild(quizInfo);
        quizItem.appendChild(quizActions);
        quizzesList.appendChild(quizItem);
    });
}

// Start quiz - FIX: This now receives assignment_id
function startQuiz(assignmentId) {
    console.log('Starting quiz with assignment ID:', assignmentId); // Debug log
    // Store assignment ID and redirect to quiz page
    localStorage.setItem('currentQuizAssignment', assignmentId);
    window.location.href = `/take-quiz.html?assignment=${assignmentId}`;
}

// Display daily challenge
function displayDailyChallenge(challenge) {
    // Implementation for daily challenge display
    console.log('Daily challenge:', challenge);
}

// Logout
function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

// Show error
function showError(message) {
    alert(message);
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    const statusBtn = document.getElementById('status-btn');
    if (statusBtn) {
        statusBtn.textContent = 'Online';
        statusBtn.classList.remove('offline');
        statusBtn.style.background = '#22c55e';
    }
});