import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatSignupNotification,
  sendSignupTelegramNotification,
} from './telegramNotifications.js';

test('signup notification includes a masked phone number, Manila timestamp, and referral code', () => {
  const message = formatSignupNotification({
    phoneNumber: '+639171234567',
    createdAt: '2026-10-18T06:30:00.000Z',
    referralCode: 'NT123456',
  });

  assert.match(message, /Welcome Message \(STEPORA MOVEMENT \| STEPM \| MOVE TO EARN\)/);
  assert.match(message, /Phone number: \*\*\*\*4567/);
  assert.doesNotMatch(message, /\+639171234567/);
  assert.match(message, /Created at: Oct 18, 2026, 2:30:00 PM/);
  assert.match(message, /Referral Code: NT123456/);
});

test('Telegram delivery failures do not fail account signup', async () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;

  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  process.env.TELEGRAM_GROUP_CHAT_ID = '-1001234567890';
  globalThis.fetch = () => Promise.reject(new Error('Telegram unavailable'));
  console.error = () => {};

  try {
    await assert.doesNotReject(sendSignupTelegramNotification({
      phoneNumber: '+639171234567',
      createdAt: '2026-10-18T06:30:00.000Z',
      referralCode: 'NT123456',
    }));
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousChatId === undefined) delete process.env.TELEGRAM_GROUP_CHAT_ID;
    else process.env.TELEGRAM_GROUP_CHAT_ID = previousChatId;
  }
});

test('Telegram API rejection logs its error description without exposing the bot token', async () => {
  const previousToken = process.env.TELEGRAM_BOT_TOKEN;
  const previousChatId = process.env.TELEGRAM_GROUP_CHAT_ID;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  const loggedErrors: unknown[][] = [];

  process.env.TELEGRAM_BOT_TOKEN = 'private-test-token';
  process.env.TELEGRAM_GROUP_CHAT_ID = '-1001234567890';
  globalThis.fetch = () => Promise.resolve(new Response(JSON.stringify({
    ok: false,
    error_code: 400,
    description: 'Bad Request: chat not found',
  }), { status: 400 }));
  console.error = (...args: unknown[]) => loggedErrors.push(args);

  try {
    await sendSignupTelegramNotification({
      phoneNumber: '+639171234567',
      createdAt: '2026-10-18T06:30:00.000Z',
      referralCode: 'NT123456',
    });
    assert.match(String(loggedErrors[0]?.[1]), /Bad Request: chat not found/);
    assert.doesNotMatch(JSON.stringify(loggedErrors), /private-test-token/);
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
    if (previousToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = previousToken;
    if (previousChatId === undefined) delete process.env.TELEGRAM_GROUP_CHAT_ID;
    else process.env.TELEGRAM_GROUP_CHAT_ID = previousChatId;
  }
});
