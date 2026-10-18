import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { displayedNexoraId } from './marathonRules.js';

interface RunnerPurchaseNotification {
  userId: string;
  referralCode?: string;
  runnerId: string;
  serial: string;
  price: number;
  purchasedAt: number;
}

const RUNNER_DETAILS: Record<string, { name: string; image: string }> = {
  'snk-1': { name: 'Cyber Aero Walker', image: 'sneaker_cyan.jpg' },
  'snk-2': { name: 'Bio Surge Trainer', image: 'sneaker_green.jpg' },
  'snk-3': { name: 'Cobalt Aero Jogger', image: 'sneaker_blue.jpg' },
  'snk-4': { name: 'Vortex Blaze Sprint', image: 'sneaker_orange.jpg' },
};

let configurationWarningLogged = false;

function formatPurchaseDate(purchasedAt: number): string {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(new Date(purchasedAt));
}

export function formatRunnerPurchaseNotification({
  userId,
  referralCode,
  runnerId,
  serial,
  price,
  purchasedAt,
}: RunnerPurchaseNotification): string {
  const runner = RUNNER_DETAILS[runnerId];
  if (!runner) {
    throw new Error(`Unsupported runner purchase notification: ${runnerId}`);
  }

  return [
    '🎊 Purchase Successful!',
    '',
    `👤 User ID: ${displayedNexoraId(referralCode, userId)}`,
    `👟 Runner: ${runner.name}#${serial}`,
    `💰 Price: ₱${price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    `📅 Purchase Date: ${formatPurchaseDate(purchasedAt)}`,
    '',
    '🎊 Congratulations! Your new runner is ready to go!',
    '',
    'Thank you for being part of the Move-to-Earn community. Keep moving, keep earning, and enjoy every step! 🏃💙',
  ].join('\n');
}

export async function sendMarketplacePurchaseTelegramNotification(
  purchase: RunnerPurchaseNotification
): Promise<void> {
  const botToken = process.env.TELEGRAM_MARKETPLACE_BOT_TOKEN?.trim();
  const groupChatId = process.env.TELEGRAM_MARKETPLACE_CHAT_ID?.trim();
  const topicIdValue = process.env.TELEGRAM_MARKETPLACE_TOPIC_ID?.trim();
  const topicId = topicIdValue && /^\d+$/.test(topicIdValue)
    ? Number(topicIdValue)
    : null;

  if (!botToken || !groupChatId || !topicId || !Number.isSafeInteger(topicId)) {
    if (!configurationWarningLogged) {
      console.warn(
        '[Telegram Marketplace] Purchase notification skipped: configure TELEGRAM_MARKETPLACE_BOT_TOKEN, TELEGRAM_MARKETPLACE_CHAT_ID, and a valid TELEGRAM_MARKETPLACE_TOPIC_ID.'
      );
      configurationWarningLogged = true;
    }
    return;
  }

  const runner = RUNNER_DETAILS[purchase.runnerId];
  if (!runner) {
    console.error(`[Telegram Marketplace] No image configured for runner ${purchase.runnerId}.`);
    return;
  }

  try {
    const imageBytes = await readFile(path.resolve(process.cwd(), 'public', 'images', runner.image));
    const formData = new FormData();
    formData.append('chat_id', groupChatId);
    formData.append('message_thread_id', String(topicId));
    formData.append('caption', formatRunnerPurchaseNotification(purchase));
    formData.append(
      'photo',
      new Blob([new Uint8Array(imageBytes)], { type: 'image/jpeg' }),
      runner.image,
    );

    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });

    const result: unknown = await response.json();
    const errorDetails =
      result && typeof result === 'object'
        ? [
            'error_code' in result && typeof result.error_code === 'number'
              ? `Telegram error ${result.error_code}`
              : null,
            'description' in result && typeof result.description === 'string'
              ? result.description
              : null,
          ].filter(Boolean).join(': ')
        : '';
    if (
      !response.ok ||
      !result ||
      typeof result !== 'object' ||
      !('ok' in result) ||
      result.ok !== true
    ) {
      throw new Error(
        `Telegram sendPhoto failed with HTTP ${response.status}.${errorDetails ? ` ${errorDetails}` : ''}`
      );
    }
  } catch (error) {
    console.error('[Telegram Marketplace] Failed to send purchase notification:', error);
  }
}
