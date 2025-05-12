import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

// Environment variables
const testing: boolean = process.env.TESTING === 'true' || false;
const API_BASE_URL = process.env.INVESTEC_HOST!;
const API_KEY = process.env.INVESTEC_API_KEY!;
const CLIENT_ID = process.env.INVESTEC_CLIENT_ID!;
const CLIENT_SECRET = process.env.INVESTEC_CLIENT_SECRET!;
const TRANSACTIONAL_ACCOUNT_ID = process.env.TRANSACTIONAL_ACCOUNT_ID!;
const PRIME_SAVER_ID = process.env.PRIME_SAVER_ACCOUNT_ID!;
const PROFILE_ID = process.env.PROFILE_ID!;
const MONTHLY_BUDGET = Number(process.env.MONTHLY_BUDGET!);


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

async function checkSaverAccountBalance(token: string, amount: number): Promise<boolean> {
    const url = `${API_BASE_URL}/za/pb/v1/accounts/${PRIME_SAVER_ID}/balance`;

    const headers = {
        Authorization: `Bearer ${token}`,
    };

    try {
        const response = await fetch(url, { headers });
        const data: any = await response.json();
        const availableBalance = data.data.availableBalance;
        return availableBalance >= amount;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error fetching saver account balance:', error.message);
        return false;
    }
}

async function transferFunds(token: string, amount: number): Promise<boolean> {

    if (amount > MONTHLY_BUDGET*0.9){
        return false;
    }

    const url = new URL(`${API_BASE_URL}/za/pb/v1/accounts/${PRIME_SAVER_ID}/transfermultiple`);

    const transferList = [{
        beneficiaryAccountId: TRANSACTIONAL_ACCOUNT_ID,
        amount,
        myReference: 'SCRIPT - Top-up',
        theirReference: 'SCRIPT - Top-up'
    }];

    const payload = {
        transferList,
        profileId: `${PROFILE_ID}`
    };

    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        if (testing) {
            console.log(`FAKE PAID R${amount}`);
        } else {
            const response = await fetch(url.toString(), {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            const data: any = await response.json();
            console.log('\x1b[32m%s\x1b[0m', JSON.stringify(data, null, 2));
        }
        return true;
    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Transfer error:', error.message);
        return false;
    }
}


async function main() {
    try {
        console.log('\x1b[32m%s\x1b[0m', '\nSTARTING\n');

        // Fetch Bearer Token
        console.log('\x1b[32m%s\x1b[0m', '1. Fetching bearer token');
        const token = await getBearerToken();

        console.log('\x1b[32m%s\x1b[0m', '2. Checking transactional account balance');
        const balance = await getTransactionalAccountBalance(token);
        let transferAmount = MONTHLY_BUDGET - balance;
        transferAmount = Math.round(transferAmount * 100) / 100; // Rounds to 2 decimal places

        console.log('\x1b[32m%s\x1b[0m', '3. Checking savings account balance and transferring funds');
        if (await checkSaverAccountBalance(token, transferAmount)){
            await transferFunds(token, transferAmount);
        }

    } catch (error) {
        console.error('\x1b[31m%s\x1b[0m', 'Error:', error.message);
    } finally {
        console.log('\x1b[32m%s\x1b[0m', '\nSUCCESSFUL\n');
        process.exit(0);
    }
}
main();