import * as crypto from 'crypto';
import { BankingStats } from '../types/banking-stats';

export async function encryptStats(stats: BankingStats, password: string): Promise<string> {
    const iv = crypto.randomBytes(16);
    const salt = 'salt'; 
    
    const key = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey);
        });
    });
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    // Properly handle the string encoding
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(stats), 'utf8'), 
        cipher.final()
    ]);
    
    // Combine IV and encrypted data as binary Buffer
    const combined = Buffer.concat([iv, encrypted]);
    
    // Return as base64
    return combined.toString('base64');
}