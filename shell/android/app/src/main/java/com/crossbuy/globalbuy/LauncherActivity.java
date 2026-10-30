package com.crossbuy.globalbuy;

import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;
import androidx.browser.trusted.TrustedWebActivityIntentBuilder;

/**
 * TWA 启动页：优先以 Trusted Web Activity（全屏无地址栏）打开站点；
 * 站点校验未通过或 TWA 会话失败时回退 Custom Tab（带地址栏，功能一致）。
 * 网页内 pwa.js 的在线升级提示与下载中心在两种模式下均自动生效。
 */
public class LauncherActivity extends AppCompatActivity {

    // 站点地址：CI 可通过 -PappUrl 或环境变量覆盖，正式域名切换只改这里
    private static final String START_URL =
        System.getenv("CROSSBUY_START_URL") != null
            ? System.getenv("CROSSBUY_START_URL")
            : "http://47.85.202.149/";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri url = Uri.parse(START_URL);
        if (getIntent() != null && getIntent().getData() != null) {
            url = getIntent().getData();
        }

        try {
            new TrustedWebActivityIntentBuilder(url)
                .build(this)
                .run(this, null);
        } catch (Exception e) {
            CustomTabsIntent intent = new CustomTabsIntent.Builder()
                .setShowTitle(true)
                .build();
            intent.launchUrl(this, url);
        }
        finish();
    }
}
