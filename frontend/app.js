import { decryptStats } from './decryption.js';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

let database;

const BIOMETRIC_STORAGE_KEY = 'biometric_auth';
const envSalt = process.env.FIREBASE_PROJECT_ID;

document.addEventListener('DOMContentLoaded', async () => {
    const authScreen = document.getElementById('auth-screen');
    const dashboard = document.getElementById('dashboard');
    const pinInput = document.getElementById('pin-input');
    const unlockBtn = document.getElementById('unlock-btn');
    const faceIdBtn = document.getElementById('face-id-btn');
    const pinError = document.createElement('div');
    pinError.className = 'text-danger mt-2';
    pinInput.parentNode.appendChild(pinError);

    document.getElementById('demo-btn').addEventListener('click', () => {
        const demoData = {
            "lastUpdated": new Date().toISOString(),
            "accountBalances": {
              "current": 4450.10,
              "overdraftAmount": 5000,
              "monthlyBudget": 12000
            },
            "salaryInfo": {
              "lastSalaryDate": "2025-03-25"
            },
            "dailyTransactions": {
              "count": 4,
              "debitCount": 3,
              "creditCount": 1,
              "pendingCount": 1
            },
            "spending": {
              "byCategory": { // the amounts in exclusion is not included here
                "CardPurchases": 6650.23,
                "VASTransactions": 540.20,
                "FeesAndInterest": 110.50,
                "OnlineBankingPayments": 220.00
              },
              "monthly": {
                "total": 38264.72,
                "discretionary": 8021.13, // Sum of categories + pending
                "nonDiscretionary": 30243.59, // Sum of exclusion
                "byExclusion": { // Created based on description of the payment
                  "RENT": 12320.53,
                  "Car INSURANCE": 1200,
                  "SCHOOL FEES": 4101.98,
                  "CAR PAYMENT": 6010.21,
                  "MEDICAL AID": 3610.87,
                  "TAX FREE SAVINGS": 3000
                },
                "pendingTransactionsTotal": 500.20
              },
              "totalCardSpent": 7150.43
            }
          };
        
        displayStats(demoData);
        authScreen.classList.add('d-none');
        dashboard.classList.remove('d-none');
        
        const banner = document.createElement('div');
        banner.className = 'alert alert-info text-center mb-4';
        banner.innerHTML = '<strong>DEMO MODE</strong> - Showing sample data. Enter your PIN to view real data.';
        dashboard.prepend(banner);
    });

    const encryptForStorage = (data) => {
        try {
            let result = '';
            const salt = envSalt + envSalt; 
            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
                result += String.fromCharCode(charCode);
            }
            return btoa(result);
        } catch (e) {
            console.error('Encryption failed:', e);
            return null;
        }
    };

    const decryptFromStorage = (encryptedData) => {
        try {
            const decoded = atob(encryptedData);
            let result = '';
            const salt = envSalt + envSalt;
            for (let i = 0; i < decoded.length; i++) {
                const charCode = decoded.charCodeAt(i) ^ salt.charCodeAt(i % salt.length);
                result += String.fromCharCode(charCode);
            }
            return result;
        } catch (e) {
            console.error('Decryption failed:', e);
            return null;
        }
    };

    pinInput.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        
        if (e.target.value.length === 4) {
            unlockBtn.removeAttribute('disabled');
        } else {
            unlockBtn.setAttribute('disabled', 'disabled');
        }
    });

    unlockBtn.setAttribute('disabled', 'disabled');

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

    const envPin = process.env.ENCRYPTION_PASSWORD;
    const monthlyBudget = process.env.MONTHLY_BUDGET;
    let encryptedStats = null;
    
    if (!envPin) {
        console.error('No encryption password set in environment variables');
        showAuthScreen('Configuration error. Please contact support.');
        return;
    }
    
    let biometricAvailable = false;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (window.PublicKeyCredential) {
        try {
            biometricAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            if (!biometricAvailable) {
                faceIdBtn.classList.add('d-none');
            } else {
                if (isMobile) {
                    if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
                        faceIdBtn.textContent = 'Use Face ID';
                        faceIdBtn.innerHTML = '<i class="fas fa-face-viewfinder"></i> Use Face ID';
                    } else {
                        faceIdBtn.textContent = 'Use Biometric Auth';
                        faceIdBtn.innerHTML = '<i class="fas fa-fingerprint"></i> Use Biometric Auth';
                    }
                }
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
        pinError.textContent = errorMessage;

        pinInput.focus();
    };

    const tryLoadDashboard = async (pin) => {
        try {
            if (pin !== envPin) {
                throw new Error('Incorrect PIN');
            }

            await loadDashboard(pin);
            authScreen.classList.add('d-none');
            dashboard.classList.remove('d-none');
            pinError.textContent = '';
        } catch (e) {
            console.error('Authentication failed:', e);
            showAuthScreen('Invalid PIN. Please try again.');
            pinInput.value = '';
            unlockBtn.setAttribute('disabled', 'disabled');
        }
    };


    showAuthScreen();

    const isBiometricRegistered = () => {
        const stored = localStorage.getItem(BIOMETRIC_STORAGE_KEY);
        if (!stored) return false;
        
        const decrypted = decryptFromStorage(stored);
        return decrypted === 'registered';
    };

    const setBiometricRegistered = () => {
        const encrypted = encryptForStorage('registered');
        if (encrypted) {
            localStorage.setItem(BIOMETRIC_STORAGE_KEY, encrypted);
        }
    };

    async function authenticateWithBiometrics() {
        try {
            const storedPinValid = sessionStorage.getItem('pin_validated');
            
            if (isBiometricRegistered() && !storedPinValid) {
                const pin = prompt('Please enter your PIN to use biometric authentication');
                if (!pin || pin !== envPin) {
                    throw new Error('PIN required for biometric authentication');
                }
                sessionStorage.setItem('pin_validated', 'true');
            }

            const credential = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rpId: window.location.hostname,
                    userVerification: 'required',
                    timeout: 60000
                }
            });

            if (!isBiometricRegistered()) {
                const pin = prompt('Please enter your PIN to register biometric authentication');
                if (!pin || pin !== envPin) {
                    throw new Error('Valid PIN required to register biometric authentication');
                }
                
                const userId = new Uint8Array(16);
                crypto.getRandomValues(userId);

                await navigator.credentials.create({
                    publicKey: {
                        challenge: new Uint8Array(32),
                        rp: {
                            name: "Secure Dashboard",
                            id: window.location.hostname
                        },
                        user: {
                            id: userId,
                            name: "user@secure.com",
                            displayName: "Secure User"
                        },
                        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
                        authenticatorSelection: {
                            authenticatorAttachment: "platform",
                            userVerification: "required"
                        },
                        timeout: 60000
                    }
                });

                setBiometricRegistered();
                sessionStorage.setItem('pin_validated', 'true');
            }

            console.log('Biometric authentication successful');
            tryLoadDashboard(envPin);

        } catch (authError) {
            console.error('Biometric authentication failed:', authError);
            let errorMessage = 'Biometric authentication failed';
            
            if (authError.message.includes('PIN')) {
                errorMessage = authError.message;
            } else if (authError.name === 'NotAllowedError') {
                errorMessage = 'Authentication cancelled by user';
            }
            
            showAuthScreen(errorMessage);
            pinInput.focus();
        }
    }
    

    unlockBtn.addEventListener('click', () => {
        const pin = pinInput.value;
        if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
            tryLoadDashboard(pin);
        } else {
            pinError.textContent = 'Please enter a 4-digit PIN';
        }
    });

    pinInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const pin = pinInput.value;
            if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
                tryLoadDashboard(pin);
            } else {
                pinError.textContent = 'Please enter a 4-digit PIN';
            }
        }
    });

    faceIdBtn.addEventListener('click', authenticateWithBiometrics);

    async function loadDashboard(pin) {
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
            
            const stats = await decryptStats(encryptedStats, pin);
            displayStats(stats);
            return true;
        } catch (e) {
            console.error('Error:', e);
            throw new Error('Failed to load dashboard data');
        }
    }

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    function displayStats(stats) {
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
        
        const cardBudget = stats.accountBalances.monthlyBudget;
        const cardSpent = stats.spending.totalCardSpent;
        const remainingBudget = cardBudget - cardSpent;
        
        document.getElementById('card-spent').textContent = formatCurrency(cardSpent);
        document.getElementById('card-budget').textContent = formatCurrency(cardBudget);
        
        const budgetBar = document.getElementById('budget-bar');
        const percentage = Math.min((cardSpent / cardBudget) * 100, 100);
        budgetBar.style.width = `${percentage}%`;
        budgetBar.textContent = `${percentage.toFixed(2)}%`;
        
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
        const legendContainer = document.getElementById('chart-legend');
        
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
        
        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false // We'll use our custom legend
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
        
        // Generate custom legend
        legendContainer.innerHTML = '';
        chart.data.datasets.forEach((dataset, i) => {
            dataset.data.forEach((value, j) => {
                const legendItem = document.createElement('div');
                legendItem.className = 'chart-legend-item';
                
                const colorBox = document.createElement('div');
                colorBox.className = 'chart-legend-color';
                colorBox.style.backgroundColor = dataset.backgroundColor[j];
                
                const labelText = document.createElement('span');
                labelText.textContent = `${chart.data.labels[j]}: ${new Intl.NumberFormat('en-ZA', {
                    style: 'currency',
                    currency: 'ZAR'
                }).format(value)}`;
                
                legendItem.appendChild(colorBox);
                legendItem.appendChild(labelText);
                legendContainer.appendChild(legendItem);
            });
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