import React, { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback?: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

interface TurnstileWidgetProps {
  siteKey?: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'flexible';
  resetTrigger?: number | string;
}

const DEFAULT_SITE_KEY =
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAFjRW6k22J4ael3n';

export const TurnstileWidget: React.FC<TurnstileWidgetProps> = ({
  siteKey = DEFAULT_SITE_KEY,
  onVerify,
  onExpire,
  onError,
  theme = 'auto',
  size = 'normal',
  resetTrigger,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const renderWidget = () => {
      if (isCancelled || !containerRef.current || !window.turnstile) return;

      // Clean up previous widget instance if it exists
      if (widgetIdRef.current) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore cleanup error
        }
        widgetIdRef.current = null;
      }

      containerRef.current.innerHTML = '';

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          size,
          callback: (token: string) => {
            if (!isCancelled) onVerify(token);
          },
          'expired-callback': () => {
            if (!isCancelled && onExpire) onExpire();
          },
          'error-callback': () => {
            if (!isCancelled && onError) onError();
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.error('[Turnstile] Render error:', err);
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      // Poll until the Turnstile script finishes loading
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);

      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 8000);

      return () => {
        isCancelled = true;
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }

    return () => {
      isCancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Ignore
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme, size]);

  // Handle explicit reset triggers (e.g. on form submission error)
  useEffect(() => {
    if (resetTrigger !== undefined && widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        // Ignore
      }
    }
  }, [resetTrigger]);

  return (
    <div className="turnstile-container min-h-[65px] flex items-center justify-center">
      <div ref={containerRef} />
    </div>
  );
};
