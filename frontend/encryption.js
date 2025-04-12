export async function decryptStats(base64Data, password) {
    try {
        // 1. First decode from base64
        const encryptedData = atob(base64Data); // or use a base64 library
        
        // 2. Then split the IV and encrypted data
        const [ivHex, encryptedHex] = encryptedData.split(':');
        if (!ivHex || !encryptedHex) {
            throw new Error('Invalid encrypted data format');
        }

        // 3. Convert hex strings to Uint8Array
        const iv = hexToUint8Array(ivHex);
        const encrypted = hexToUint8Array(encryptedHex);

        // 4. Derive the key (same as backend)
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

        // 5. Decrypt
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
        throw new Error('Failed to decrypt data - incorrect password or corrupted data');
    }
}

function hexToUint8Array(hexString) {
    return new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}