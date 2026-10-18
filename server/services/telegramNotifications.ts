interface SignupNotification {
  phoneNumber: string;
  steporaId: string;
  createdAt: string;
  referralCode: string;
}

let configurationWarningLogged = false;

export function formatSignupNotification({
  phoneNumber,
  steporaId,
  createdAt,
  referralCode,
}: SignupNotification): string {
  const formattedCreatedAt = new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Manila',
  }).format(new Date(createdAt));

  return [
    '🎉 NEW USER SIGN-UP!',
    '',
    '🚀 Welcome to STEPORA MOVEMENT | STEPM!',
    '',
    `👤 New Member: ****${phoneNumber.slice(-4)}`,
    `🆔 User ID: ${steporaId}`,
    `📧 Referral: ${referralCode}`,
    `📅 Registered: ${formattedCreatedAt}`,
    '',
    '💚 A new member has joined the STEPM | MOVE TO EARN community!',
    '',
    "👟 Another mover has entered the movement. Let's keep growing and moving forward together!",
    '',
    'signup now at: https://stepm.fun/',
    '',
    '🔥 STEPORA MOVEMENT',
    '💰 MOVE TO EARN | EVERY STEP COUNTS 🚀',
  ].join('\n');
}

export async function sendSignupTelegramNotification(
  signup: SignupNotification
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const groupChatId = process.env.TELEGRAM_GROUP_CHAT_ID?.trim();
  const topicIdValue = process.env.TELEGRAM_SIGNUP_TOPIC_ID?.trim();
  const topicId = topicIdValue && /^\d+$/.test(topicIdValue)
    ? Number(topicIdValue)
    : null;

  if (!botToken || !groupChatId || !topicId || !Number.isSafeInteger(topicId)) {
    if (!configurationWarningLogged) {
      const message = 'Set TELEGRAM_BOT_TOKEN, TELEGRAM_GROUP_CHAT_ID, and a valid TELEGRAM_SIGNUP_TOPIC_ID to enable signup notifications.';
      if (botToken || groupChatId || topicIdValue) {
        console.error(`[Telegram] Incomplete signup notification configuration. ${message}`);
      } else {
        console.warn(`[Telegram] Signup notifications are disabled. ${message}`);
      }
      configurationWarningLogged = true;
    }
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: groupChatId,
        message_thread_id: topicId,
        text: formatSignupNotification(signup),
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(5000),
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
        `Telegram sendMessage failed with HTTP ${response.status}.${errorDetails ? ` ${errorDetails}` : ''}`
      );
    }
  } catch (error) {
    console.error('[Telegram] Failed to send signup notification:', error);
  }
}
