/**
 * Cloudflare Turnstile token validation service
 */

export async function verifyTurnstileToken(
  token?: string,
  remoteIp?: string
): Promise<{ success: boolean; error?: string }> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  // If secret key is not set yet in .env, log a warning and don't block the request
  if (!secretKey || secretKey.trim() === '') {
    console.warn('[Turnstile] TURNSTILE_SECRET_KEY is empty in .env. Skipping verification.');
    return { success: true };
  }

  if (!token || token.trim() === '') {
    return {
      success: false,
      error: 'Please complete the Cloudflare verification challenge.',
    };
  }

  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey.trim());
    formData.append('response', token.trim());
    if (remoteIp) {
      formData.append('remoteip', remoteIp);
    }

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const data = (await response.json()) as {
      success: boolean;
      'error-codes'?: string[];
      challenge_ts?: string;
      hostname?: string;
    };

    if (data.success) {
      return { success: true };
    }

    console.error('[Turnstile Verification Failed]', data['error-codes']);
    return {
      success: false,
      error: 'Human verification failed. Please try again.',
    };
  } catch (error: any) {
    console.error('[Turnstile Error]', error);
    return {
      success: false,
      error: 'Failed to verify security token with Cloudflare. Please try again.',
    };
  }
}
