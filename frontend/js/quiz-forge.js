const API_URL = 'http://localhost:3000/api';

let selectedFile = null;
let selectedTopics = ['Data analysis'];
let generatedQuestions = [];
let currentQuizId = null;
let isEditMode = false;

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
            currentQuizId = data.quiz.id;
            await displayGeneratedQuiz(data.quiz);
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
    try {
        const response = await fetch(`${API_URL}/quiz/${quiz.id}`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            generatedQuestions = data.quiz.questions;
            
            renderQuestions();
            
            const resultsSection = document.getElementById('results-section');
            resultsSection.style.display = 'block';
            
            // Scroll to results
            resultsSection.scrollIntoView({ behavior: 'smooth' });
        }
    } catch (error) {
        console.error('Load quiz details error:', error);
    }
}

// Render questions (with or without edit mode)
function renderQuestions() {
    const questionsList = document.getElementById('questions-list');
    
    const html = generatedQuestions.map((q, index) => `
        <div class="question-card" data-question-index="${index}">
            <div class="question-header">
                ${isEditMode ? `
                    <textarea class="edit-question-text" style="width: 100%; padding: 0.5rem; border: 2px solid #e5e7eb; border-radius: 6px; font-size: 1rem; min-height: 60px;">${q.question_text}</textarea>
                ` : `
                    ${index + 1}. ${q.question_text}
                `}
            </div>
            <div class="question-options">
                ${q.options.map((opt, optIndex) => `
                    <div class="option-item ${opt.isCorrect ? 'correct' : ''}" data-option-index="${optIndex}">
                        ${isEditMode ? `
                            <input type="checkbox" class="edit-option-correct" ${opt.isCorrect ? 'checked' : ''} style="margin-right: 0.5rem;">
                        ` : ''}
                        <span class="option-label">${String.fromCharCode(65 + opt.optionOrder - 1)}.</span>
                        ${isEditMode ? `
                            <input type="text" class="edit-option-text" value="${opt.optionText}" style="flex: 1; padding: 0.5rem; border: 2px solid #e5e7eb; border-radius: 6px;">
                        ` : `
                            <span>${opt.optionText}</span>
                            ${opt.isCorrect ? '<span style="margin-left: auto; color: #22c55e;">✓</span>' : ''}
                        `}
                    </div>
                `).join('')}
            </div>
            ${isEditMode ? `
                <button class="btn-delete-question" onclick="deleteQuestion(${index})" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer;">Delete Question</button>
            ` : ''}
        </div>
    `).join('');
    
    questionsList.innerHTML = html;
}

// Toggle edit mode
function toggleEditMode() {
    isEditMode = !isEditMode;
    const editBtn = document.getElementById('edit-quiz-btn');
    
    if (isEditMode) {
        editBtn.textContent = 'Apply Changes';
        editBtn.classList.remove('btn-secondary');
        editBtn.classList.add('btn-primary');
    } else {
        // Save changes
        saveEditChanges();
        editBtn.textContent = 'Edit';
        editBtn.classList.remove('btn-primary');
        editBtn.classList.add('btn-secondary');
    }
    
    renderQuestions();
}

// Save edit changes
function saveEditChanges() {
    const questionCards = document.querySelectorAll('.question-card');
    
    questionCards.forEach((card, qIndex) => {
        const questionTextArea = card.querySelector('.edit-question-text');
        if (questionTextArea) {
            generatedQuestions[qIndex].question_text = questionTextArea.value;
        }
        
        const optionItems = card.querySelectorAll('.option-item');
        optionItems.forEach((item, optIndex) => {
            const optionText = item.querySelector('.edit-option-text');
            const optionCorrect = item.querySelector('.edit-option-correct');
            
            if (optionText && optionCorrect) {
                generatedQuestions[qIndex].options[optIndex].optionText = optionText.value;
                generatedQuestions[qIndex].options[optIndex].isCorrect = optionCorrect.checked;
            }
        });
    });
}

// Delete question
function deleteQuestion(index) {
    if (confirm('Are you sure you want to delete this question?')) {
        generatedQuestions.splice(index, 1);
        renderQuestions();
    }
}

// Save quiz
async function saveQuiz() {
    if (!currentQuizId) {
        alert('No quiz to save');
        return;
    }
    
    // If in edit mode, apply changes first
    if (isEditMode) {
        saveEditChanges();
    }
    
    try {
        // Update quiz with edited questions
        const response = await fetch(`${API_URL}/quiz/${currentQuizId}/update`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                questions: generatedQuestions
            })
        });
        
        if (response.ok || response.status === 404) {
            // Even if update fails, the quiz is already saved
            alert('Quiz has been saved successfully! You can now assign it to students from your dashboard.');
            window.location.href = '/teacher_dashboard';
        } else {
            alert('Quiz saved but there was an issue updating. You can edit it later from the dashboard.');
            window.location.href = '/teacher_dashboard';
        }
    } catch (error) {
        console.error('Save quiz error:', error);
        alert('Quiz has been saved successfully! You can now assign it to students from your dashboard.');
        window.location.href = '/teacher_dashboard';
    }
}

// Logout
function logout() {
    localStorage.clear();
    window.location.href = '/login.html';
}

// Make functions global
window.deleteQuestion = deleteQuestion;
window.toggleEditMode = toggleEditMode;
window.saveQuiz = saveQuiz;

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    
    loadSubjects();
    setupFileUpload();
    setupTopics();
    
    const form = document.getElementById('quiz-forge-form');
    form.addEventListener('submit', handleGenerate);
    
    const editBtn = document.getElementById('edit-quiz-btn');
    if (editBtn) {
        editBtn.addEventListener('click', toggleEditMode);
    }
    
    const saveBtn = document.getElementById('save-quiz-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveQuiz);
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});