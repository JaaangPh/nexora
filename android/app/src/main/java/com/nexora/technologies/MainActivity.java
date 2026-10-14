package com.nexora.technologies;

import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.os.PowerManager;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private static final int MIDNIGHT_NAVY = Color.rgb(11, 23, 49);
    private static final int WARNING_RED = Color.rgb(239, 20, 28);
    private static final int RETRY_BLUE = Color.rgb(33, 150, 243);

    private PowerManager.WakeLock wakeLock;
    private FrameLayout offlineView;
    private Button retryButton;
    private WebView appWebView;
    private boolean retryInProgress;
    private boolean retryFailed;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Nexora::WorkoutGpsLock");
                wakeLock.acquire();
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onStart() {
        super.onStart();
        if (bridge == null || bridge.getWebView() == null) return;

        WebView webView = bridge.getWebView();
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = webView.getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setGeolocationEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setDomStorageEnabled(true);

        if (webView != appWebView) {
            appWebView = webView;
            installOfflineHandling(webView);
        }
    }

    private void installOfflineHandling(WebView webView) {
        ViewGroup parent = (ViewGroup) webView.getParent();
        if (parent == null) return;

        offlineView = createOfflineView();
        parent.addView(offlineView, new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onPageCommitVisible(WebView view, String url) {
                super.onPageCommitVisible(view, url);
                if (!retryInProgress || retryFailed) return;
                retryInProgress = false;
                hideOfflineView();
            }

            @Override
            public void onReceivedError(
                    WebView view,
                    android.webkit.WebResourceRequest request,
                    android.webkit.WebResourceError error
            ) {
                super.onReceivedError(view, request, error);
                if (request.isForMainFrame()) {
                    retryFailed = retryInProgress;
                    showOfflineView();
                }
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                retryFailed = retryInProgress;
                showOfflineView();
            }
        });
    }

    private FrameLayout createOfflineView() {
        FrameLayout overlay = new FrameLayout(this);
        overlay.setBackgroundColor(MIDNIGHT_NAVY);
        overlay.setClickable(true);
        overlay.setFocusable(true);
        overlay.setVisibility(View.GONE);

        LinearLayout message = new LinearLayout(this);
        message.setOrientation(LinearLayout.VERTICAL);
        message.setGravity(Gravity.CENTER_HORIZONTAL);

        TextView warningIcon = new TextView(this);
        warningIcon.setText("!");
        warningIcon.setTextColor(WARNING_RED);
        warningIcon.setTextSize(94);
        warningIcon.setTypeface(Typeface.DEFAULT, Typeface.NORMAL);
        warningIcon.setGravity(Gravity.CENTER);
        warningIcon.setContentDescription("Warning");
        GradientDrawable circle = new GradientDrawable();
        circle.setShape(GradientDrawable.OVAL);
        circle.setColor(Color.TRANSPARENT);
        circle.setStroke(dp(6), WARNING_RED);
        warningIcon.setBackground(circle);
        message.addView(warningIcon, new LinearLayout.LayoutParams(dp(150), dp(150)));

        TextView title = new TextView(this);
        title.setText("No Internet connection");
        title.setTextColor(Color.WHITE);
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = dp(52);
        message.addView(title, titleParams);

        FrameLayout.LayoutParams messageParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
        );
        messageParams.leftMargin = dp(20);
        messageParams.rightMargin = dp(20);
        overlay.addView(message, messageParams);

        retryButton = new Button(this);
        retryButton.setText("Try again");
        retryButton.setTextColor(Color.WHITE);
        retryButton.setTextSize(16);
        retryButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        retryButton.setAllCaps(false);
        retryButton.setBackground(roundRect(RETRY_BLUE, dp(8)));
        retryButton.setOnClickListener(view -> {
            retryInProgress = true;
            retryFailed = false;
            retryButton.setEnabled(false);
            retryButton.setText("Connecting...");
            if (appWebView != null) appWebView.reload();
            retryButton.postDelayed(() -> {
                if (offlineView != null && offlineView.getVisibility() == View.VISIBLE) {
                    retryButton.setText("Try again");
                    retryButton.setEnabled(true);
                }
            }, 3000);
        });

        FrameLayout.LayoutParams buttonParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(60),
                Gravity.BOTTOM
        );
        buttonParams.leftMargin = dp(20);
        buttonParams.rightMargin = dp(20);
        buttonParams.bottomMargin = dp(28);
        overlay.addView(retryButton, buttonParams);

        return overlay;
    }

    private GradientDrawable roundRect(int color, int radius) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void showOfflineView() {
        runOnUiThread(() -> {
            if (offlineView != null) {
                if (retryInProgress) retryFailed = true;
                retryButton.setText("Try again");
                retryButton.setEnabled(true);
                offlineView.setVisibility(View.VISIBLE);
                offlineView.bringToFront();
            }
        });
    }

    private void hideOfflineView() {
        runOnUiThread(() -> {
            if (offlineView != null) offlineView.setVisibility(View.GONE);
        });
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
    }
}
