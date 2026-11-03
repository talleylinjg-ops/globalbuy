package com.crossbuy.globalbuy;

import android.content.ComponentName;
import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsClient;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.customtabs.CustomTabsServiceConnection;
import androidx.browser.customtabs.CustomTabsSession;

// CrossBuy Android 壳入口：CustomTabs 会话隐藏地址栏（准全屏）。
// assetlinks.json 已按 release.keystore 指纹预置，后续升级 TWA 全屏可直接使用。
public class LauncherActivity extends AppCompatActivity {

    private static final String START_URL =
        System.getenv("CROSSBUY_START_URL") != null
            ? System.getenv("CROSSBUY_START_URL")
            : "https://crossbuy.cn/";

    private CustomTabsSession mSession;
    private boolean mLaunched = false;

    private final CustomTabsServiceConnection mConnection = new CustomTabsServiceConnection() {
        @Override
        public void onCustomTabsServiceConnected(ComponentName name, CustomTabsClient client) {
            client.warmup(0);
            mSession = client.newSession(null);
            launch();
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            mSession = null;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        String pkg = CustomTabsClient.getPackageName(this, null);
        if (pkg != null) {
            try {
                CustomTabsClient.bindCustomTabsService(this, pkg, mConnection);
                return;
            } catch (SecurityException ignored) {
            }
        }
        launch();
    }

    private void launch() {
        if (mLaunched) return;
        mLaunched = true;
        Uri url = Uri.parse(START_URL);
        if (getIntent() != null && getIntent().getData() != null) {
            url = getIntent().getData();
        }
        CustomTabsIntent intent = new CustomTabsIntent.Builder(mSession)
            .setShowTitle(true)
            .setUrlBarHidingEnabled(true)
            .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
            .build();
        intent.launchUrl(this, url);
        finish();
    }
}
