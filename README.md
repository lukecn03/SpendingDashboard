# SpendingDashboard - Automated Banking Management System

## Overview

SpendingDashboard leverages Investec's Open Banking APIs to provide a comprehensive banking automation system that helps users:
1. Prevent overdraft interest by automatically transferring funds from savings to cover negative balances
2. Track monthly spending with detailed categorization
3. Visualize financial data through an interactive dashboard

This monorepo contains both the backend automation service and frontend dashboard, designed to work together seamlessly.

## API Access Requirements

To use this application, you'll need Investec Programmable Banking API credentials:

1. **Client ID, Client Secret, and API Key**  
   Generate these from the [Developer Community Wiki](https://investec.gitbook.io/programmable-banking-community-wiki/get-started/api-quick-start-guide/how-to-get-your-api-keys)

2. **Profile ID and Account IDs**  
   Retrieve these by calling the GetAccounts API. Documentation:  
   [Investec API Docs](https://developer.investec.com/za/api-products/documentation/SA_PB_Account_Information#operation/accounts)

## Why It's Useful

- **Avoids costly overdraft fees**: Automatically covers negative balances before interest is calculated
- **Financial awareness**: Provides detailed insights into spending patterns
- **Budget tracking**: Helps stay on top of discretionary vs. fixed expenses
- **Security-focused**: All sensitive data is encrypted
- **Automated**: Runs frequently without manual intervention
- **Open Banking**: Leverages Investec's APIs for real-time financial data

## Tech Stack

### Backend
- **Runtime**: Node.js (v20+)
- **Dependencies**: 
  - `node-fetch` for API calls
  - `firebase-admin` for data storage
  - `dotenv` for environment management
- **Hosting**: GitHub Actions (scheduled frequent execution)

### Frontend
- **Framework**: Vanilla JS with Vite
- **UI Libraries**: 
  - Bootstrap 5 for styling
  - Chart.js for data visualization
- **Dependencies**: 
  - Firebase SDK for data retrieval
- **Hosting**: GitHub Pages

### Shared Infrastructure
- **Data Storage**: Firebase Realtime Database
- **Security**: AES-256 encryption for all sensitive data

## Monorepo Structure

```
SpendingDashboard/
├── backend/              # Automation service
│   ├── src/              # TypeScript source files
│   ├── package.json      # Backend dependencies
│   └── tsconfig.json     # TypeScript config
├── frontend/             # Dashboard UI
│   ├── src/              # Application code
│   ├── vite.config.js/   # Vite config
│   └── package.json      # Frontend dependencies
├── .github/
│   └── workflows/        # GitHub Actions configs
│       ├── backend.yml   # Backend scheduled job
│       └── frontend.yml  # Frontend deployment
└── package.json          # Root project config
```

## Setup Instructions

### 1. Prerequisites

- Node.js v20 or higher
- Git
- Investec Programmable Banking access
- Firebase project with Realtime Database

### 2. Clone the Repository

```bash
git clone https://github.com/lukecn03/SpendingDashboard.git
cd SpendingDashboard
```

### 3. Environment Setup

#### Backend Configuration

1. Create a `.env` file in the `backend` directory:

Use example.env as reference

2. Install backend dependencies:

```bash
cd backend
npm install
```

#### Frontend Configuration

1. Create a `.env` file in the `frontend` directory:

Use example.env as reference

2. Install frontend dependencies:

```bash
cd ../frontend
npm install
```

### 4. Running the System

#### Backend (Manual Execution)

```bash
cd backend
npm start  # Production mode
npm run dev  # Test mode (no actual transfers)
```

#### Frontend (Development)

```bash
cd frontend
npm run dev
```

### 5. Deployment

#### Backend Automation

The backend is configured to run automatically via GitHub Actions every day at 7 PM UTC (9 PM SAST). No manual deployment is needed after initial setup.

#### Frontend Dashboard

The frontend is configured to run automatically via GitHub Actions every day at 8 PM UTC (10 PM SAST). No manual deployment is needed after initial setup.

## Security Notes

1. All sensitive banking data is encrypted before storage
2. The dashboard requires authentication to view financial data
3. API keys and credentials should never be committed to the repository
4. Consider using GitHub Secrets for production deployment
5. Uses Investec's OAuth 2.0 implementation for secure API access

## Maintenance

- The system will automatically update at 06:00, 09:00, 12:00, 15:00, 18:00, 21:00, and 23:30 SAST daily
- To modify behavior, edit the backend code in `backend/src/`
- To update the dashboard UI, edit the frontend code in `frontend/src/`

## License

This project is provided as-is under the MIT License. Use at your own discretion and ensure compliance with Investec's API terms of service.

---

