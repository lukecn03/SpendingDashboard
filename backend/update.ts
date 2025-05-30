import fetch from 'node-fetch';
import * as dotenv from 'dotenv';
import { BankingStats, initBankingStats } from './types/banking-stats.js';
import { encryptStats } from './utils/encryption.js';
import admin from 'firebase-admin';
const { credential } = admin;

dotenv.config();

// Environment variables
const testing: boolean = process.env.TESTING === 'true' || false;
const API_BASE_URL = process.env.INVESTEC_HOST!;
const API_KEY = process.env.INVESTEC_API_KEY!;
const CLIENT_ID = process.env.INVESTEC_CLIENT_ID!;
const CLIENT_SECRET = process.env.INVESTEC_CLIENT_SECRET!;
const TRANSACTIONAL_ACCOUNT_ID = process.env.TRANSACTIONAL_ACCOUNT_ID!;
const ENCRYPTION_PASSWORD = process.env.ENCRYPTION_PASSWORD!;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT!;
const DATABASE_URL = process.env.DATABASE_URL!;
const SAVINGS_ACCOUNT_TRANSACTION_DESCRIPTION = process.env.SAVINGS_ACCOUNT_TRANSACTION_DESCRIPTION!;
const MONTHLY_BUDGET = Number(process.env.MONTHLY_BUDGET!);


const salaryDescription = process.env.SALARY_DESCRIPTION!;
let exclusionKeywords: string[] = [];
try {
    exclusionKeywords = JSON.parse(process.env.EXCLUSION_CATEGORIES!);
    if (!Array.isArray(exclusionKeywords)) {
        throw new Error('EXCLUSION_CATEGORIES must be a JSON array');
    }
} catch (error) {
    console.error('\x1b[31m%s\x1b[0m', 'Error parsing EXCLUSION_CATEGORIES:', error.message);
    process.exit(0);
}

const transactionTypes = ['CardPurchases', 'OnlineBankingPayments', 'DebitOrders', 'CashWithdrawal', 'VASTransactions', 'FeesAndInterest', 'FasterPay'];

interface Transaction {
    accountId: string;
    type: string;
    transactionType: string;
    status: string;
    description: string;
    cardNumber: string;
    postedOrder: number;
    postingDate: string;
    valueDate: string;
    actionDate: string;
    transactionDate: string;
    amount: number;
    runningBalance: number;
    uuid: string;
}


function setupFirebase () {
    let serviceAccount;
    try {
        serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    } catch (error) {
        console.error('Error parsing Firebase service account:', error);
        throw new Error('Invalid Firebase service account configuration');
    }
    
    try {
        admin.initializeApp({
            credential: credential.cert(serviceAccount),
            databaseURL: DATABASE_URL
        });
    } catch (error) {
        console.error('Firebase initialization error:', error);
        throw error;
    }
}

async function getBearerToken(): Promise<string> {
    const url = `${API_BASE_URL}/identity/v2/oauth2/token`;
    const headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'x-api-key': API_KEY,
    };
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: body.toString(),
    });

    const data: any = await response.json();
    return data.access_token;
}

async function getTransactions(token: string, fromDate: string, toDate: string): Promise<Transaction[]> {
    const url = new URL(`${API_BASE_URL}/za/pb/v1/accounts/${TRANSACTIONAL_ACCOUNT_ID}/transactions`);
    url.searchParams.append('fromDate', fromDate);
    url.searchParams.append('toDate', toDate);

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url.toString(), { headers });
    const data: any = await response.json();
    return data.data.transactions;
}

async function getSalaryTransactionDate(token: string): Promise<string> {
    const today = new Date();
    const fromDate = new Date(today);
    fromDate.setMonth(fromDate.getMonth() - 1); 
    const formattedFromDate = fromDate.toISOString().split('T')[0];
    const formattedToDate = today.toISOString().split('T')[0];

    const transactions = await getTransactions(token, formattedFromDate, formattedToDate);
    const salaryTransaction = transactions.find(transaction => transaction.description.includes(salaryDescription));

    if (salaryTransaction) {
        return salaryTransaction.transactionDate;
    } else {
        // If no salary transaction found, return 21st of previous month
        const prevMonth = new Date();
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        prevMonth.setDate(21);
        return prevMonth.toISOString().split('T')[0];
    }
}

async function getTransactionalAccountBalance(token: string): Promise<number> {
    const url = `${API_BASE_URL}/za/pb/v1/accounts/${TRANSACTIONAL_ACCOUNT_ID}/balance`;
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    try {
        const response = await fetch(url, { headers });
        const data: any = await response.json();
        return data.data.availableBalance;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error fetching transactional account balance:', error.message);
        return -1;
    }
}

async function getPendingTransactions(token: string): Promise<Transaction[]> {
    const url = `${API_BASE_URL}/za/pb/v1/accounts/${TRANSACTIONAL_ACCOUNT_ID}/pending-transactions`;
    const headers = {
        Authorization: `Bearer ${token}`,
    };

    const response = await fetch(url, { headers });
    const data: any = await response.json();
    return data.data.transactions;
}

async function calculateSpending(transactions: Transaction[], pendingTransactions: Transaction[], stats: BankingStats): Promise<void> {
    for (const transaction of transactions) {
        const isInternalTransfer = transaction.description.includes(SAVINGS_ACCOUNT_TRANSACTION_DESCRIPTION);
        
        if (isInternalTransfer) {
            continue; 
        }

        if (transaction.type !== 'DEBIT') {
            continue;
        }

        const isExcluded = exclusionKeywords.some(keyword => 
            transaction.description.includes(keyword)
        );
        const amount = transaction.amount;

        if (transaction.type === 'DEBIT') {
            stats.spending.monthly.total += amount;

            if (isExcluded) {
                stats.spending.monthly.nonDiscretionary += amount;
                exclusionKeywords.forEach(keyword => {
                    if (transaction.description.includes(keyword)) {
                        stats.spending.monthly.byExclusion[keyword] = 
                            (stats.spending.monthly.byExclusion[keyword] || 0) + amount;
                    }
                });
            } else {
                stats.spending.monthly.discretionary += amount;
                stats.spending.byCategory[transaction.transactionType] = 
                    (stats.spending.byCategory[transaction.transactionType] || 0) + amount;
            }
        }
    }

    let pendingTotal = 0;
    for (const pendingTransaction of pendingTransactions) {
        if (pendingTransaction.type === 'DEBIT') {
            pendingTotal += pendingTransaction.amount;
            
            if (pendingTransaction.description.includes("CARD")) {
                stats.spending.byCategory["CardPurchases"] = 
                    (stats.spending.byCategory["CardPurchases"] || 0) + pendingTransaction.amount;
            }
        }
    }

    stats.spending.monthly.pendingTransactionsTotal = pendingTotal;
    stats.spending.totalCardSpent = stats.spending.byCategory["CardPurchases"] + stats.spending.monthly.pendingTransactionsTotal;

    stats.spending.monthly.total += stats.spending.monthly.pendingTransactionsTotal;

    stats.spending.monthly.total = parseFloat(stats.spending.monthly.total.toFixed(2));
    stats.spending.monthly.discretionary = parseFloat(stats.spending.monthly.discretionary.toFixed(2));
    stats.spending.monthly.nonDiscretionary = parseFloat(stats.spending.monthly.nonDiscretionary.toFixed(2));
    stats.spending.monthly.pendingTransactionsTotal = parseFloat(stats.spending.monthly.pendingTransactionsTotal.toFixed(2));
    stats.spending.totalCardSpent = parseFloat(stats.spending.totalCardSpent.toFixed(2));
    
    for (const key in stats.spending.byCategory) {
        stats.spending.byCategory[key] = parseFloat(stats.spending.byCategory[key].toFixed(2));
    }
    
    for (const key in stats.spending.monthly.byExclusion) {
        stats.spending.monthly.byExclusion[key] = parseFloat(stats.spending.monthly.byExclusion[key].toFixed(2));
    }
}

async function saveToFirebase(encryptedData: string) {
    try {
        const db = admin.database();
        await db.ref('stats').set({
            data: encryptedData,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error saving to Firebase:', error);
        throw error;
    }
}

function removeMatchingDebitCreditPairs(transactions: Transaction[]): Transaction[] {
    console.log('\x1b[36m%s\x1b[0m', `\nTotal transactions: ${transactions.length}`);
    
    // Separate transactions into different types
    const debits = transactions.filter(t => t.type === 'DEBIT');
    const credits = transactions.filter(t => t.type === 'CREDIT');
    const others = transactions.filter(t => t.type !== 'DEBIT' && t.type !== 'CREDIT');

    console.log('\x1b[36m%s\x1b[0m', `Debits: ${debits.length}, Credits: ${credits.length}, Others: ${others.length}`);

    // Create a map to track credits by their amount (rounded to 2 decimals)
    // Exclude credits that are in exclusion categories OR are script top-ups
    const creditMap = new Map<number, Transaction[]>();
    credits.forEach(credit => {
        const isExcluded = exclusionKeywords.some(keyword => 
            credit.description.includes(keyword)
        );
        const isScriptTopUp = credit.description.includes("SCRIPT - TOP-UP");
        if (!isExcluded && !isScriptTopUp) {
            const amount = parseFloat(credit.amount.toFixed(2));
            if (!creditMap.has(amount)) {
                creditMap.set(amount, []);
            }
            creditMap.get(amount)!.push(credit);
        }
    });

    // Process debits to find matches
    const filteredDebits: Transaction[] = [];
    const usedCredits = new Set<string>(); // Track which credits we've already matched
    const removedPairs: {debit: Transaction, credit: Transaction}[] = [];
    
    debits.forEach(debit => {
        // Skip if this debit is in exclusion categories
        const isExcluded = exclusionKeywords.some(keyword => 
            debit.description.includes(keyword)
        );
        if (isExcluded) {
            filteredDebits.push(debit);
            return;
        }

        const debitAmount = parseFloat(debit.amount.toFixed(2));
        const matchingCredits = creditMap.get(debitAmount);

        if (matchingCredits && matchingCredits.length > 0) {
            // Find first unused matching credit
            const matchingIndex = matchingCredits.findIndex(credit => !usedCredits.has(credit.uuid));
            
            if (matchingIndex !== -1) {
                const matchingCredit = matchingCredits[matchingIndex];
                // Mark this credit as used and skip this debit
                usedCredits.add(matchingCredit.uuid);
                removedPairs.push({
                    debit: debit,
                    credit: matchingCredit
                });
                return;
            }
        }
        
        // No matching credit found - keep this debit
        filteredDebits.push(debit);
    });

    // Collect all credits (both used and unused, including excluded ones and script top-ups)
    const remainingCredits: Transaction[] = [];
    credits.forEach(credit => {
        const isExcluded = exclusionKeywords.some(keyword => 
            credit.description.includes(keyword)
        );
        const isScriptTopUp = credit.description.includes("SCRIPT - TOP-UP");
        if (isExcluded || isScriptTopUp || !usedCredits.has(credit.uuid)) {
            remainingCredits.push(credit);
        }
    });

    console.log('\x1b[36m%s\x1b[0m', `\nTotal pairs removed: ${removedPairs.length}`);
    removedPairs.forEach(pair => {
        console.log('\x1b[36m%s\x1b[0m', `- Debit:  ${pair.debit.description} (${pair.debit.amount})`);
        console.log('\x1b[36m%s\x1b[0m', `  Credit: ${pair.credit.description} (${pair.credit.amount})`);
    });

    console.log('\x1b[36m%s\x1b[0m', `\nFinal counts: Debits: ${filteredDebits.length}, Credits: ${remainingCredits.length}, Others: ${others.length}\n`);

    return [...filteredDebits, ...remainingCredits, ...others];
}

async function main() {
    try {
        console.log('\x1b[32m%s\x1b[0m', '\nSTARTING\n');

        const stats: BankingStats = initBankingStats();
        stats.accountBalances.monthlyBudget = MONTHLY_BUDGET;

        console.log(`\x1b[32m1. Initializing firebase : ${String(!testing)}\x1b[0m`);

        if (!testing){
            setupFirebase();
        }

        // Fetch Bearer Token
        console.log('\x1b[32m%s\x1b[0m', '2. Fetching bearer token');
        const token = await getBearerToken();

        // Fetch the date of the salary transaction
        console.log('\x1b[32m%s\x1b[0m', '3. Fetching salary transaction date');
        stats.salaryInfo.lastSalaryDate = await getSalaryTransactionDate(token);
        if (!stats.salaryInfo.lastSalaryDate) {
            console.error('\x1b[31m%s\x1b[0m', 'Salary transaction not found. Exiting...');
            return;
        }

        // Get today's date in the format YYYY-MM-DD
        const today = new Date();
        stats.lastUpdated = today.toISOString();
        const formattedDate = today.toISOString().split('T')[0];

        // Fetch transactions for the last day
        console.log('\x1b[32m%s\x1b[0m', '4. Fetching transactions for the last day');
        const lastDayTransactions = await getTransactions(token, formattedDate, formattedDate);
        stats.dailyTransactions.count = lastDayTransactions.length;
        stats.dailyTransactions.debitCount = lastDayTransactions.filter(t => t.type === 'DEBIT').length;
        stats.dailyTransactions.creditCount = lastDayTransactions.filter(t => 
            t.type === 'CREDIT' && !t.description.includes("SCRIPT - TOP-UP")
        ).length;
       
        // Fetch pending transactions
        console.log('\x1b[32m%s\x1b[0m', '5. Fetching pending transactions');
        const pendingTransactions = await getPendingTransactions(token);
        stats.dailyTransactions.pendingCount = pendingTransactions.length;

        // Handle overdraft
        console.log('\x1b[32m%s\x1b[0m', '6. Checking account balance');
        stats.accountBalances.current = await getTransactionalAccountBalance(token);

        // Fetch transactions for the last month from the salary date
        console.log('\x1b[32m%s\x1b[0m', '7. Fetching transactions from salary date to today');
        const monthlyTransactions = (await getTransactions(token, stats.salaryInfo.lastSalaryDate, formattedDate))
            .filter(t => new Date(t.transactionDate) >= new Date(stats.salaryInfo.lastSalaryDate));

        console.log('\x1b[32m%s\x1b[0m', '8. Removing matching debit/credit pairs');
        const processedTransactions = removeMatchingDebitCreditPairs(monthlyTransactions);
    

        // Calculate spending for the last month including pending transactions
        console.log('\x1b[32m%s\x1b[0m', '9. Calculating spending for the last month');
        await calculateSpending(processedTransactions, pendingTransactions, stats);

        if (testing){
            console.log('\nFINAL BANKING STATISTICS:');
            console.log(JSON.stringify(stats, null, 2));
        }

        if (!ENCRYPTION_PASSWORD) throw new Error('ENCRYPTION_PASSWORD not set');
        const encryptedData = await encryptStats(stats, ENCRYPTION_PASSWORD);
        
        // Save to Firebase
        console.log(`\x1b[32m10. Saving to firebase : ${String(!testing)}\x1b[0m`);
        if (!testing){
            await saveToFirebase(encryptedData);
        }
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error:', error.message);
    } finally {
        console.log('\x1b[32m%s\x1b[0m', '11. Cleaning up workspace');
        if (!testing){
            await admin.app().delete();
        }
        console.log('\x1b[32m%s\x1b[0m', '\nSUCCESSFUL\n');
        process.exit(0);
    }
}
main();