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
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(stats), 'utf8'),
        cipher.final()
    ]);
    
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export async function decryptStats(encryptedData: string, password: string): Promise<BankingStats> {
    const [ivHex, encryptedHex] = encryptedData.split(':');
    if (!ivHex || !encryptedHex) {
        throw new Error('Invalid encrypted data format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const salt = 'salt';
    
    const key = await new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(password, salt, 100000, 32, 'sha256', (err, derivedKey) => {
            if (err) return reject(err);
            resolve(derivedKey);
        });
    });
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([
        decipher.update(encrypted),
        decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
}