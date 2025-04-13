export async function decryptStats(base64Data, password) {
    try {
        // 1. Decode from base64 to binary data
        const binaryString = atob(base64Data);
        const binaryData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            binaryData[i] = binaryString.charCodeAt(i);
        }
        
        // 2. Extract IV (first 16 bytes) and encrypted data
        const iv = binaryData.slice(0, 16);
        const encrypted = binaryData.slice(16);
        
        // 3. Derive the key
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        const aesKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: new TextEncoder().encode('salt'),
                iterations: 100000, 
                hash: 'SHA-256' 
            },
            keyMaterial,
            { name: 'AES-CBC', length: 256 },
            false,
            ['decrypt']
        );
        
        // 4. Decrypt
        const decrypted = await crypto.subtle.decrypt(
            {
                name: 'AES-CBC',
                iv: iv
            },
            aesKey,
            encrypted
        );
        
        return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data - Password used to encrypt differs from password used to decrypt or corrupted data');
    }
}