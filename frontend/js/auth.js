const API_URL = 'http://localhost:3000/api';

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    
    loginBtn.disabled = true;
    loginBtn.textContent = 'Signing in...';
    
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('userRole', data.user.role);
            localStorage.setItem('userName', data.user.fullName);
            
            // Redirect based on role
            if (data.user.role === 'student') {
                window.location.href = '/student_dashboard';
            } else if (data.user.role === 'teacher') {
                window.location.href = '/teacher_dashboard';
            }
        } else {
            showError(data.error || 'Login failed');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    } catch (error) {
        console.error('Login error:', error);
        showError('Network error. Please try again.');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Sign In';
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const role = document.getElementById('role').value;
    const registerBtn = document.getElementById('register-btn');
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }
    
    registerBtn.disabled = true;
    registerBtn.textContent = 'Creating account...';
    
    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullName, email, password, role })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token and user data
            localStorage.setItem('token', data.token);
            localStorage.setItem('userRole', data.user.role);
            localStorage.setItem('userName', data.user.fullName);
            
            // Redirect based on role
            if (data.user.role === 'student') {
                window.location.href = '/student_dashboard';
            } else if (data.user.role === 'teacher') {
                window.location.href = '/teacher_dashboard';
            }
        } else {
            showError(data.error || 'Registration failed');
            registerBtn.disabled = false;
            registerBtn.textContent = 'Create Account';
        }
    } catch (error) {
        console.error('Registration error:', error);
        showError('Network error. Please try again.');
        registerBtn.disabled = false;
        registerBtn.textContent = 'Create Account';
    }
}

// Handle Google login
function handleGoogleLogin() {
    window.location.href = `${API_URL}/auth/google`;
}

// Check if user is already logged in
function checkAuth() {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    
    if (token && role) {
        if (role === 'student') {
            window.location.href = '/student_dashboard';
        } else if (role === 'teacher') {
            window.location.href = '/teacher_dashboard';
        }
    }
}

// Run auth check on page load
if (window.location.pathname === '/login.html' || window.location.pathname === '/register.html') {
    checkAuth();
}