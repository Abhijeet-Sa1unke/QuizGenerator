const API_URL = 'http://localhost:3000/api';

let selectedFile = null;
let selectedTopics = ['Data analysis'];
let generatedQuestions = [];

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    
    if (!token || role !== 'teacher') {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Get auth token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Load subjects
async function loadSubjects() {
    try {
        const response = await fetch(`${API_URL}/subjects`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const select = document.getElementById('subject');
            
            data.subjects.forEach(subject => {
                if (subject.name !== 'Daily Challenge') {
                    const option = document.createElement('option');
                    option.value = subject.id;
                    option.textContent = subject.name;
                    select.appendChild(option);
                }
            });
        }
    } catch (error) {
        console.error('Load subjects error:', error);
    }
}

// Setup file upload
function setupFileUpload() {
    const fileUploadArea = document.getElementById('file-upload-area');
    const fileInput = document.getElementById('pdf-file');
    const fileInfo = document.getElementById('file-info');
    const removeBtn = document.getElementById('remove-file');
    
    fileUploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            document.getElementById('file-name').textContent = file.name;
            fileUploadArea.style.display = 'none';
            fileInfo.style.display = 'flex';
        } else {
            alert('Please select a PDF file');
        }
    });
    
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedFile = null;
        fileInput.value = '';
        fileUploadArea.style.display = 'block';
        fileInfo.style.display = 'none';
    });
    
    // Drag and drop
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = '#667eea';
    });
    
    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.style.borderColor = '#cbd5e1';
    });
    
    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.style.borderColor = '#cbd5e1';
        
        const file = e.dataTransfer.files[0];
        if (file && file.type === 'application/pdf') {
            selectedFile = file;
            fileInput.files = e.dataTransfer.files;
            document.getElementById('file-name').textContent = file.name;
            fileUploadArea.style.display = 'none';
            fileInfo.style.display = 'flex';
        } else {
            alert('Please select a PDF file');
        }
    });
}

// Setup topic selection
function setupTopics() {
    const topicPills = document.querySelectorAll('.topic-pill');
    const topicsDisplay = document.getElementById('topics-display');
    
    topicPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const topic = pill.dataset.topic;
            
            if (topic === 'All') {
                topicPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                selectedTopics = ['All'];
            } else {
                const allPill = document.querySelector('[data-topic="All"]');
                allPill.classList.remove('active');
                
                if (pill.classList.contains('active')) {
                    pill.classList.remove('active');
                    selectedTopics = selectedTopics.filter(t => t !== topic);
                } else {
                    pill.classList.add('active');
                    selectedTopics.push(topic);
                }
                
                if (selectedTopics.length === 0) {
                    selectedTopics = ['Data analysis'];
                    topicPills[0].classList.add('active');
                }
            }
            
            topicsDisplay.value = selectedTopics.join(', ');
        });
    });
    
    // Set initial value
    topicsDisplay.value = selectedTopics.join(', ');
}

// Handle quiz generation
async function handleGenerate(e) {
    e.preventDefault();
    
    if (!selectedFile) {
        alert('Please upload a PDF file');
        return;
    }
    
    const numQuestions = document.getElementById('num-questions').value;
    const difficulty = document.getElementById('difficulty').value;
    const subjectId = document.getElementById('subject').value;
    
    if (!subjectId) {
        alert('Please select a subject');
        return;
    }
    
    const generateBtn = document.getElementById('generate-btn');
    const btnText = generateBtn.querySelector('.btn-text');
    const btnLoader = generateBtn.querySelector('.btn-loader');
    
    generateBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-block';
    
    try {
        const formData = new FormData();
        formData.append('pdf', selectedFile);
        formData.append('numQuestions', numQuestions);
        formData.append('difficulty', difficulty);
        formData.append('subjectId', subjectId);
        formData.append('topics', JSON.stringify(selectedTopics));
        
        const response = await fetch(`${API_URL}/quiz/generate`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            displayGeneratedQuiz(data.quiz);
        } else {
            const error = await response.json();
            alert(error.error || 'Failed to generate quiz');
        }
    } catch (error) {
        console.error('Generate error:', error);
        alert('Network error. Please try again.');
    } finally {
        generateBtn.disabled = false;
        btnText.style.display = 'inline-block';
        btnLoader.style.display = 'none';
    }
}

// Display generated quiz
async function displayGeneratedQuiz(quiz) {
    // Fetch full quiz details including questions
    try {
        const response = await fetch(`${API_URL}/quiz/${quiz.id}`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            generatedQuestions = data.quiz.questions;
            
            const resultsSection = document.getElementById('results-section');
            const questionsList = document.getElementById('questions-list');
            
            const html = generatedQuestions.map((q, index) => `
                <div class="question-card">
                    <div class="question-header">
                        ${index + 1}. ${q.question_text}
                    </div>
                    <div class="question-options">
                        ${q.options.map(opt => `
                            <div class="option-item ${opt.isCorrect ? 'correct' : ''}">
                                <span class="option-label">${String.fromCharCode(65 + opt.optionOrder - 1)}.</span>
                                <span>${opt.optionText}</span>
                                ${opt.isCorrect ? '<span style="margin-left: auto; color: #22c55e;">✓</span>' : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');
            
            questionsList.innerHTML = html;
            resultsSection.style.display = 'block';
            
            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Load quiz details error:', error);
    }
}

// Save quiz
async function saveQuiz() {
    alert('Quiz has been saved successfully! You can now assign it to students from your dashboard.');
    window.location.href = '/teacher_dashboard';
}

// Logout
function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    loadSubjects();
    setupFileUpload();
    setupTopics();
    
    const form = document.getElementById('quiz-forge-form');
    form.addEventListener('submit', handleGenerate);
    
    const saveBtn = document.getElementById('save-quiz-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveQuiz);
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});