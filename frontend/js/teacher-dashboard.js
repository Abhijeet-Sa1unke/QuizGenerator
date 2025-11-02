const API_URL = 'http://localhost:3000/api';

// Get auth token
function getAuthToken() {
    return localStorage.getItem('token');
}

// Check authentication
function checkAuth() {
    const token = getAuthToken();
    const role = localStorage.getItem('userRole');
    
    if (!token || role !== 'teacher') {
        window.location.href = '/login.html';
        return false;
    }
    return true;
}

// Load teacher dashboard
async function loadDashboard() {
    if (!checkAuth()) return;
    
    try {
        const response = await fetch(`${API_URL}/teacher/dashboard`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayDashboard(data);
        } else if (response.status === 401) {
            logout();
        } else {
            showError('Failed to load dashboard');
        }
    } catch (error) {
        console.error('Dashboard load error:', error);
        showError('Network error. Please try again.');
    }
}

// Display dashboard data
function displayDashboard(data) {
    // Update stats
    if (data.stats) {
        const stats = data.stats;
        document.getElementById('total-quizzes').textContent = stats.total_quizzes || 0;
        document.getElementById('avg-performance').textContent = 
            `${Math.round(stats.average_performance || 0)}%`;
        
        const subtitle = `You have ${stats.active_students || 0} active students across ${stats.subjects_taught || 0} subjects`;
        document.getElementById('teacher-stats').textContent = subtitle;
    }
    
    // Display class overview
    if (data.classOverview && data.classOverview.length > 0) {
        displayClassOverview(data.classOverview);
    }
    
    // Display recent quizzes
    if (data.recentQuizzes && data.recentQuizzes.length > 0) {
        displayRecentQuizzes(data.recentQuizzes);
    } else {
        document.getElementById('recent-quizzes').innerHTML = 
            '<tr><td colspan="4" style="text-align: center;">No quizzes created yet. <a href="/quiz-forge.html">Create your first quiz</a></td></tr>';
    }
}

// Display class overview
function displayClassOverview(classData) {
    const container = document.getElementById('class-overview');
    
    const icons = {
        'Mathematics': '➕',
        'Science': '🔬',
        'Technology': '💻'
    };
    
    const html = classData.map(subject => `
        <div class="class-card">
            <div style="font-size: 2rem; margin-bottom: 1rem;">${icons[subject.name] || '📚'}</div>
            <h3>${subject.name}</h3>
            <div style="margin-top: 1rem;">
                <p style="color: #6b7280; font-size: 0.9rem;">
                    ${subject.student_count || 0} students • 
                    ${subject.quiz_count || 0} quizzes
                </p>
                <p style="margin-top: 0.5rem; font-weight: 600; color: #667eea;">
                    ${Math.round(subject.avg_performance || 0)}% avg performance
                </p>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// Display recent quizzes
function displayRecentQuizzes(quizzes) {
    const tbody = document.getElementById('recent-quizzes');
    
    const html = quizzes.map(quiz => `
        <tr>
            <td>
                <strong>${quiz.title}</strong><br>
                <small style="color: #6b7280;">${quiz.subject_name}</small>
            </td>
            <td>${quiz.students_assigned || 0}</td>
            <td>${Math.round(quiz.avg_score || 0)}%</td>
            <td>
                <button class="btn-link" onclick="viewQuizAnalytics(${quiz.id})">
                    View Details
                </button>
                <button class="btn-link" onclick="assignQuiz(${quiz.id})" style="margin-left: 1rem;">
                    Assign
                </button>
            </td>
        </tr>
    `).join('');
    
    tbody.innerHTML = html;
}

// View quiz analytics
async function viewQuizAnalytics(quizId) {
    try {
        const response = await fetch(`${API_URL}/teacher/quiz/${quizId}/analytics`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayQuizAnalytics(data);
        } else {
            showError('Failed to load analytics');
        }
    } catch (error) {
        console.error('Analytics error:', error);
        showError('Network error');
    }
}

// Display quiz analytics modal
function displayQuizAnalytics(data) {
    // Create modal to show analytics
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 800px; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h2>${data.quiz.title}</h2>
                <button onclick="this.closest('div').parentElement.remove()" style="border: none; background: none; font-size: 1.5rem; cursor: pointer;">×</button>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem;">
                <div style="padding: 1rem; background: #f9fafb; border-radius: 8px;">
                    <div style="color: #6b7280; font-size: 0.875rem;">Students</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${data.stats.total_students}</div>
                </div>
                <div style="padding: 1rem; background: #f9fafb; border-radius: 8px;">
                    <div style="color: #6b7280; font-size: 0.875rem;">Completed</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${data.stats.completed_count}</div>
                </div>
                <div style="padding: 1rem; background: #f9fafb; border-radius: 8px;">
                    <div style="color: #6b7280; font-size: 0.875rem;">Avg Score</div>
                    <div style="font-size: 1.5rem; font-weight: 700;">${Math.round(data.stats.average_score)}%</div>
                </div>
            </div>
            
            <h3 style="margin-bottom: 1rem;">Student Performance</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="background: #f9fafb;">
                        <th style="padding: 0.75rem; text-align: left;">Student</th>
                        <th style="padding: 0.75rem; text-align: left;">Status</th>
                        <th style="padding: 0.75rem; text-align: left;">Score</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.studentPerformance.map(student => `
                        <tr style="border-bottom: 1px solid #e5e7eb;">
                            <td style="padding: 0.75rem;">${student.full_name}</td>
                            <td style="padding: 0.75rem;">${student.status}</td>
                            <td style="padding: 0.75rem;">${student.score ? Math.round(student.score) + '%' : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    document.body.appendChild(modal);
}

// Assign quiz
async function assignQuiz(quizId) {
    // Load students and show assignment modal
    try {
        const response = await fetch(`${API_URL}/teacher/students`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            showAssignmentModal(quizId, data.students);
        }
    } catch (error) {
        console.error('Load students error:', error);
        showError('Failed to load students');
    }
}

// Show assignment modal
function showAssignmentModal(quizId, students) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 2rem; border-radius: 12px; max-width: 500px; width: 90%;">
            <h2 style="margin-bottom: 1.5rem;">Assign Quiz to Students</h2>
            <form id="assign-form">
                <div style="max-height: 300px; overflow-y: auto; margin-bottom: 1rem;">
                    ${students.map(student => `
                        <label style="display: block; padding: 0.75rem; cursor: pointer;">
                            <input type="checkbox" name="students" value="${student.id}" style="margin-right: 0.5rem;">
                            ${student.full_name} (${student.email})
                        </label>
                    `).join('')}
                </div>
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem;">Due Date (Optional)</label>
                    <input type="datetime-local" name="dueDate" style="width: 100%; padding: 0.5rem; border: 1px solid #e5e7eb; border-radius: 6px;">
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button type="button" onclick="this.closest('div').parentElement.parentElement.remove()" style="flex: 1; padding: 0.75rem; border: 1px solid #e5e7eb; background: white; border-radius: 6px; cursor: pointer;">Cancel</button>
                    <button type="submit" style="flex: 1; padding: 0.75rem; border: none; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 6px; cursor: pointer; font-weight: 600;">Assign</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    document.getElementById('assign-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const studentIds = formData.getAll('students');
        const dueDate = formData.get('dueDate');
        
        if (studentIds.length === 0) {
            alert('Please select at least one student');
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/quiz/${quizId}/assign`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${getAuthToken()}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    studentIds,
                    dueDate: dueDate || null
                })
            });
            
            if (response.ok) {
                alert('Quiz assigned successfully!');
                modal.remove();
                loadDashboard();
            } else {
                alert('Failed to assign quiz');
            }
        } catch (error) {
            console.error('Assign error:', error);
            alert('Network error');
        }
    });
}

// Export data
async function exportData() {
    try {
        const response = await fetch(`${API_URL}/teacher/export/students`, {
            headers: {
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            downloadCSV(data.data);
        }
    } catch (error) {
        console.error('Export error:', error);
        showError('Failed to export data');
    }
}

// Download CSV
function downloadCSV(data) {
    const csv = convertToCSV(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

// Convert to CSV
function convertToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = data.map(row => 
        headers.map(header => JSON.stringify(row[header] || '')).join(',')
    );
    
    return [headers.join(','), ...rows].join('\n');
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
    
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    const statusBtn = document.getElementById('status-btn');
    if (statusBtn) {
        statusBtn.textContent = 'Online';
        statusBtn.classList.remove('offline');
        statusBtn.style.background = '#22c55e';
    }
});