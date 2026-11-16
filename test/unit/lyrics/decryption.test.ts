import { describe, expect, it } from 'vitest';
import { krcDecrypt } from '@/utils/lyrics/krcDecrypt';

// test/unit/lyrics/decryption.test.ts

async function compressDeflate(text: string): Promise<Uint8Array> {
    const cs = new CompressionStream('deflate');
    const writer = cs.writable.getWriter();
    void writer.write(new TextEncoder().encode(text));
    void writer.close();
    const response = new Response(cs.readable);
    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
}

describe('krc decryption', () => {
    it('decrypts KRC XOR format correctly', async () => {
        const originalText = '[00:10.00]Hello KRC lyrics';
        const compressed = await compressDeflate(originalText);
        const key = new Uint8Array([
            64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105,
        ]);
        const encrypted = new Uint8Array(4 + compressed.length);
        encrypted[0] = 107;
        encrypted[1] = 114;
        encrypted[2] = 99;
        encrypted[3] = 49;
        for (let i = 0; i < compressed.length; i += 1) {
            encrypted[4 + i] = compressed[i] ^ key[i % key.length];
        }
        expect(await krcDecrypt(encrypted)).toBe(originalText);
    });
});
