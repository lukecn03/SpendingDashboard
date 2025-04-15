# SpendingDashboard - Automated Banking Management System

## 📊 Overview

**SpendingDashboard** is a banking automation system powered by Investec's Open Banking APIs. It provides:

1. **Overdraft Protection**: Automatically transfers funds from savings to prevent overdraft interest.
2. **Spending Insights**: Tracks and categorizes transactions.
3. **Interactive Dashboard**: Visualizes your financial activity using charts and graphs.

This monorepo includes both the backend automation service and the frontend dashboard.

<p align="center">
  <img src="./screenshots/Login_example.png" alt="Dashboard Overview" width="300"/>
</p>
<p align="center">
  <img src="./screenshots/Desktop_example.png" alt="Dashboard Overview" width="800"/>
</p>




The **Financial Overview Dashboard** provides a comprehensive snapshot of a user's financial activity and health. It includes the following components:

### 🏦 Card Spending Budget
- **Spent:** Shows the total card spending for the current month.
- **Budget:** The user's predefined monthly budget.
- **Remaining:** The leftover balance after spending.
- A progress bar visualizes how much of the budget has been used.

### 🔁 Daily Transactions
- Displays the number of:
  - **Debits**
  - **Credits**
  - **Pending** transactions  
This gives a quick look at daily financial activity.

### 📈 Spending by Category
- A donut chart that categorizes spending into:
  - **Rent**
  - **Card Purchases**
  - **Car Payment**
  - **School Fees**
  - **Medical Aid**
  - **Tax-Free Savings**
  - **Insurance**
  - **Online Banking Fees**
  - **VAST Transactions**, etc.  
This helps users see which areas they spend most on.

### 📘 Monthly Spending Summary
- **Total Spending:** Sum of all expenditures for the month.
- **Discretionary:** All uncategorized spending
- **Fixed Expenses:** Recurring and necessary payments that are categorized in the .env.
- **Pending Transactions:** Amounts yet to be processed.
- **Card Spending:** Total charged to the user's card, includes pending.

### 💸 Last Topped-up Amount
- Displays the most recent deposit or top-up made the last time the script ran.

### 👨‍💼 Salary Information
- Shows the date of the last salary payment received. After next salary eveyrthing will be reset to 0.

## Why It's Useful

- 🛡 **Avoid overdraft interest** by automatically topping up your account
- 📊 **Track financial activity** with categorized spending and visual analytics
- 🧠 **Gain budget awareness** by separating fixed and discretionary expenses
- 🔒 **Security-focused** with AES-256 encryption and OAuth 2.0 authorization
- ⚙️ **Fully automated** backend using GitHub Actions
- 📱 Scalable and responsive design—works seamlessly on desktop and mobile
- 🚪 No need to log in to your banking app to view account status or trigger overdraft top-up


---



## API Access Requirements

To use this application, you'll need Investec Programmable Banking API credentials:

1. **Client ID, Client Secret, and API Key**  
   Generate these from the [Developer Community Wiki](https://investec.gitbook.io/programmable-banking-community-wiki/get-started/api-quick-start-guide/how-to-get-your-api-keys)

2. **Profile ID and Account IDs**  
   Retrieve these by calling the GetAccounts API. Documentation:  
   [Investec API Docs](https://developer.investec.com/za/api-products/documentation/SA_PB_Account_Information#operation/accounts)

Next, you'll need to fork the repository and configure your GitHub Secrets as follows.

### 🔐 GitHub Secrets Configuration

After forking the repo, navigate to your GitHub project settings → Secrets → Actions, and add the following secrets:

```env
INVESTEC_HOST=https://openapi.investec.com
INVESTEC_CLIENT_ID=your-client-id
INVESTEC_CLIENT_SECRET=your-client-secret
INVESTEC_API_KEY=your-api-key
TRANSACTIONAL_ACCOUNT_ID=your-transactional-account-id
PRIME_SAVER_ACCOUNT_ID=your-savings-account-id
PROFILE_ID=your-profile-id
ENCRYPTION_PASSWORD=your-encryption-password  # Password used for login
MONTHLY_BUDGET=your-monthly-budget-for-card-spending

# Firebase credentials
FIREBASE_SERVICE_ACCOUNT={"type": "","project_id": "-stats","private_key_id": "","private_key": "-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n","client_email": "","client_id": "","auth_uri": "","token_uri": "","auth_provider_x509_cert_url": "","client_x509_cert_url": "","universe_domain": ""}
DATABASE_URL=your-firebase-realtime-db-url

# Categorization
EXCLUSION_CATEGORIES=["CLARITY", "RENT", "TAX FREE SAVINGS", "CAR PAYMENT", "GYM", "CHARITY"]
SALARY_DESCRIPTION=description-of-salary-transaction
SAVINGS_ACCOUNT_TRANSACTION_DESCRIPTION=description-of-savings-transfers
# INVESTEC_CARD_KEY=optional-if-needed
```

> **Note:** The backend uses **Firebase Realtime Database** to store all transaction and budget data securely.

---


## Tech Stack

### Backend
- **Node.js v20+**
- `node-fetch`, `firebase-admin`, `dotenv`
- **Hosted via** GitHub Actions (cron jobs)

### Frontend
- **Vanilla JS** with Vite
- **Bootstrap 5**, **Chart.js**
- **Hosted via** GitHub Pages

### Shared
- **Data Storage**: Firebase Realtime Database
- **Encryption**: AES-256 for all sensitive data

---

## Spending Categories

- **Discretionary Spending**: All transaction categories **not listed** in your `EXCLUSION_CATEGORIES` (e.g., entertainment, food, travel).
- **Non-Discretionary / Fixed Expenses**: All transactions **from categories listed** in `EXCLUSION_CATEGORIES`.

These categories are used throughout the app for budgeting and analytics.

---

## Automation Schedule

The backend script runs automatically via **GitHub Actions** at the following times daily:

| Time (SAST) | Time (UTC) | Purpose |
|-------------|------------|---------|
| 06:00       | 04:00 UTC  | Budget sync & balance check |
| 09:00       | 07:00 UTC  | Spending update |
| 12:00       | 10:00 UTC  | Midday sync |
| 15:00       | 13:00 UTC  | Afternoon snapshot |
| 18:00       | 16:00 UTC  | Pre-evening updates |
| 21:00       | 19:00 UTC  | End-of-day check |
| 23:30       | 21:30 UTC  | Final update before interest calculation |

---

## Monorepo Structure

```
SpendingDashboard/
├── backend/              # Automation service
│   ├── src/              # TypeScript source files
│   ├── package.json      # Backend dependencies
│   └── tsconfig.json     # TypeScript config
├── frontend/             # Dashboard UI
│   ├── src/              # Application code
│   ├── vite.config.js    # Vite config
│   └── package.json      # Frontend dependencies
├── .github/
│   └── workflows/
│       ├── backend.yml   # Backend automation cron job
│       └── frontend.yml  # Frontend deployment
└── package.json          # Root project config
```

---

## Local Setup Instructions

### 1. Prerequisites
- Node.js v20+
- Git
- Firebase Project with Realtime Database
- Investec Programmable Banking API Access

### 2. Clone and Setup

```bash
git clone https://github.com/your-username/SpendingDashboard.git
cd SpendingDashboard
```

#### Backend

```bash
cd backend
cp example.env .env  # Fill out the variables
npm install
npm run dev  # Runs in test mode (no transfers)
```

#### Frontend

```bash
cd ../frontend
cp example.env .env
npm install
npm run dev
```

---

## Deployment

- **Backend**: Deployed and executed via GitHub Actions on a scheduled basis.
- **Frontend**: Automatically deployed to GitHub Pages using GitHub Actions.

---

## Security Notes

- All banking data is encrypted before being stored in Firebase
- Environment variables (API keys, credentials) are kept in GitHub Secrets
- Pin protected
- Initial FaceId usage is also pin protected
- Secure OAuth 2.0 is used for Investec API authentication

---

## License

MIT License — provided as-is. Ensure you follow Investec’s API usage policies and handle all financial data responsibly.

--- 
