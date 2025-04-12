import { decryptStats } from './encryption.js';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

let database;

document.addEventListener('DOMContentLoaded', async () => {
    const authScreen = document.getElementById('auth-screen');
    const dashboard = document.getElementById('dashboard');
    const passwordInput = document.getElementById('password-input');
    const unlockBtn = document.getElementById('unlock-btn');
    const faceIdBtn = document.getElementById('face-id-btn');
    const passwordError = document.createElement('div');
    passwordError.className = 'text-danger mt-2';
    passwordInput.parentNode.appendChild(passwordError);

    if (!process.env.FIREBASE_API_KEY || 
        !process.env.FIREBASE_DATABASE_URL || 
        !process.env.FIREBASE_PROJECT_ID) {
        throw new Error('Missing Firebase configuration');
    }
    
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY,
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        projectId: process.env.FIREBASE_PROJECT_ID,
        authDomain: `${process.env.FIREBASE_PROJECT_ID}.firebaseapp.com`
    };
    
    try {
        const app = initializeApp(firebaseConfig);
        database = getDatabase(app);
        console.log('Firebase initialized');
    } catch (error) {
        console.error('Firebase init error:', error);
        throw error;
    }
    
    if (!database) {
        console.error('Firebase not initialized');
        showAuthScreen('System error. Please try again later.');
        return;
    }

    const envPassword = process.env.ENCRYPTION_PASSWORD;
    const monthlyBudget = process.env.MONTHLY_BUDGET;
    let encryptedStats = null;


    if (window.PublicKeyCredential) {
        try {
            const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (!available) {
                faceIdBtn.classList.add('d-none');
            }
        } catch (e) {
            faceIdBtn.classList.add('d-none');
            console.error('WebAuthn check failed:', e);
        }
    } else {
        faceIdBtn.classList.add('d-none');
    }

    const showAuthScreen = (errorMessage = '') => {
        authScreen.classList.remove('d-none');
        dashboard.classList.add('d-none');
        passwordError.textContent = errorMessage;
        passwordInput.focus();
    };

    const tryLoadDashboard = async (password) => {
        try {
            if (envPassword && password !== envPassword) {
                throw new Error('Incorrect password');
            }

            await loadDashboard(password);
            authScreen.classList.add('d-none');
            dashboard.classList.remove('d-none');
            passwordError.textContent = '';
        } catch (e) {
            console.error('Authentication failed:', e);
            showAuthScreen('Invalid password. Please try again.');
        }
    };

    if (!envPassword) {
        console.warn('No environment password set - showing auth screen');
        showAuthScreen();
    } else {
        passwordInput.focus();
    }

    unlockBtn.addEventListener('click', () => {
        const password = passwordInput.value;
        if (password) {
            tryLoadDashboard(password);
        } else {
            passwordError.textContent = 'Please enter a password';
        }
    });

    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const password = passwordInput.value;
            if (password) {
                tryLoadDashboard(password);
            } else {
                passwordError.textContent = 'Please enter a password';
            }
        }
    });

    faceIdBtn.addEventListener('click', async () => {
        try {
            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rpId: window.location.hostname,
                    userVerification: 'required'
                }
            });
            
            const storedPassword = sessionStorage.getItem('dashboard_password');
            if (storedPassword) {
                tryLoadDashboard(storedPassword);
            } else {
                const password = prompt('Please enter your backup password to set up Face ID');
                if (password) {
                    sessionStorage.setItem('dashboard_password', password);
                    tryLoadDashboard(password);
                }
            }
        } catch (e) {
            console.error('Authentication failed:', e);
            showAuthScreen('Face ID authentication failed. Please use password.');
        }
    });

    async function loadDashboard(password) {
        try {
            try {
                const snapshot = await get(ref(database, 'stats'));
                if (snapshot.exists()) {
                    encryptedStats = snapshot.val().data;
                } else {
                    console.error('No data available in Firebase');
                }
            } catch (error) {
                console.error('Error fetching data from Firebase:', error);
            }

            if (!encryptedStats) {
                throw new Error('No encrypted data available');
            }
            
            const stats = await decryptStats(encryptedStats, password);
            displayStats(stats);
            return true;
        } catch (e) {
            console.error('Error:', e);
            throw new Error('Failed to load dashboard data');
        }
    }

    function displayStats(stats) {
        const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString();
        const formatCurrency = (amount) => new Intl.NumberFormat('en-ZA', {
            style: 'currency',
            currency: 'ZAR'
        }).format(amount);
    
        document.getElementById('last-updated').textContent = `Last updated: ${formatDate(stats.lastUpdated)}`;
        document.getElementById('current-balance').textContent = formatCurrency(stats.accountBalances.current);
        
        document.getElementById('last-salary-date').textContent = formatDate(stats.salaryInfo.lastSalaryDate);
        
        document.getElementById('daily-debits').textContent = stats.dailyTransactions.debitCount;
        document.getElementById('daily-credits').textContent = stats.dailyTransactions.creditCount;
        document.getElementById('daily-pending').textContent = stats.dailyTransactions.pendingCount;
        
        document.getElementById('total-spending').textContent = formatCurrency(stats.spending.monthly.total);
        document.getElementById('discretionary-spending').textContent = formatCurrency(stats.spending.monthly.discretionary);
        document.getElementById('fixed-spending').textContent = formatCurrency(stats.spending.monthly.nonDiscretionary);
        document.getElementById('pending-transactions').textContent = formatCurrency(stats.spending.monthly.pendingTransactionsTotal);
        document.getElementById('card-spending').textContent = formatCurrency(stats.spending.totalCardSpent);
        
        const cardBudget = Number(process.env.MONTHLY_BUDGET || 5000);
        const cardSpent = stats.spending.totalCardSpent || 0;
        const remainingBudget = cardBudget - cardSpent;
        
        document.getElementById('card-spent').textContent = formatCurrency(cardSpent);
        document.getElementById('card-budget').textContent = formatCurrency(cardBudget);
        
        const budgetBar = document.getElementById('budget-bar');
        const percentage = Math.min((cardSpent / cardBudget) * 100, 100);
        budgetBar.style.width = `${percentage}%`;
        budgetBar.textContent = `${percentage.toFixed(0)}%`;
        
        if (cardSpent > cardBudget) {
            budgetBar.classList.add('over-budget');
            document.getElementById('budget-over').classList.remove('d-none');
            document.getElementById('budget-remaining').textContent = formatCurrency(0);
        } else {
            budgetBar.classList.remove('over-budget');
            document.getElementById('budget-over').classList.add('d-none');
            document.getElementById('budget-remaining').textContent = formatCurrency(remainingBudget);
        }
        
        renderSpendingChart(stats);
    }

    function renderSpendingChart(stats) {
        const ctx = document.getElementById('spending-chart').getContext('2d');
        
        const lightestSlate = getComputedStyle(document.documentElement)
            .getPropertyValue('--lightest-slate').trim();
        
        const allCategories = {
            ...stats.spending.byCategory,
            ...stats.spending.monthly.byExclusion
        };
        
        const sortedCategories = Object.entries(allCategories)
            .sort((a, b) => b[1] - a[1]);
        
        const topCategories = sortedCategories.slice(0, 10);
        
        const labels = topCategories.map(([name]) => name);
        const data = topCategories.map(([, amount]) => amount);
        
        const backgroundColors = [
            'rgba(54, 162, 235, 0.8)',
            'rgba(255, 99, 132, 0.8)',
            'rgba(75, 192, 192, 0.8)',
            'rgba(153, 102, 255, 0.8)',
            'rgba(255, 159, 64, 0.8)',
            'rgba(199, 199, 199, 0.8)',
            'rgba(83, 102, 255, 0.8)',
            'rgba(255, 99, 71, 0.8)',
            'rgba(60, 179, 113, 0.8)',
            'rgba(238, 130, 238, 0.8)'
        ];
        
        const chartData = {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderWidth: 1
            }]
        };
        
        new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: lightestSlate, 
                            font: {
                                size: 12
                            },
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const formattedValue = new Intl.NumberFormat('en-ZA', {
                                    style: 'currency',
                                    currency: 'ZAR'
                                }).format(value);
                                return `${label}: ${formattedValue}`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }
  
    function renderCategories(stats) {
        const container = document.getElementById('categories-container');
        container.innerHTML = '';
        
        const allCategories = {
            ...stats.spending.byCategory,
            ...stats.spending.monthly.byExclusion
        };
        
        const sortedCategories = Object.entries(allCategories)
            .sort((a, b) => b[1] - a[1]);
        
        sortedCategories.forEach(([name, amount]) => {
            const item = document.createElement('div');
            item.className = 'category-item';
            
            const nameEl = document.createElement('span');
            nameEl.className = 'category-name';
            nameEl.textContent = name;
            
            const amountEl = document.createElement('span');
            amountEl.className = 'category-amount';
            amountEl.textContent = new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR'
            }).format(amount);
            
            item.appendChild(nameEl);
            item.appendChild(amountEl);
            container.appendChild(item);
        });
    }
    
});