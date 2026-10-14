import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {
  decryptTotpSecret,
  encodeBase32,
  encryptTotpSecret,
  findValidTotpCounter,
  generateTotpSecret,
  TOTP_PERIOD_SECONDS,
} from './totp.js';

function decodeBase32(value: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let buffer = 0;
  const bytes: number[] = [];
  for (const character of value) {
    buffer = (buffer << 5) | alphabet.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bytes.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function codeAt(secret: string, counter: number): string {
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = crypto.createHmac('sha1', decodeBase32(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1] & 15;
  const value = (
    ((digest[offset] & 127) << 24) |
    ((digest[offset + 1] & 255) << 16) |
    ((digest[offset + 2] & 255) << 8) |
    (digest[offset + 3] & 255)
  ) % 1_000_000;
  return String(value).padStart(6, '0');
}

test('Base32 encoding matches the RFC 4648 test vector', () => {
  assert.equal(encodeBase32(Buffer.from('foo')), 'MZXW6');
  assert.equal(decodeBase32(generateTotpSecret()).length, 20);
});

test('TOTP secrets encrypt and decrypt, and reject tampering', () => {
  const secret = generateTotpSecret();
  const encrypted = encryptTotpSecret(secret, 'test-key-material');
  assert.equal(decryptTotpSecret(encrypted, 'test-key-material'), secret);

  const payload = Buffer.from(encrypted, 'base64');
  payload[payload.length - 1] ^= 1;
  assert.throws(() => decryptTotpSecret(payload.toString('base64'), 'test-key-material'));
});

test('a valid TOTP counter can only be used once', () => {
  const secret = generateTotpSecret();
  const counter = Math.floor(Date.now() / 1000 / TOTP_PERIOD_SECONDS);
  const code = codeAt(secret, counter);
  const matchedCounter = findValidTotpCounter(secret, code);

  assert.notEqual(matchedCounter, null);
  assert.equal(findValidTotpCounter(secret, code, matchedCounter!), null);
});

test('malformed TOTP codes are rejected', () => {
  assert.equal(findValidTotpCounter(generateTotpSecret(), '12345'), null);
  assert.equal(findValidTotpCounter(generateTotpSecret(), 'abcdef'), null);
});
