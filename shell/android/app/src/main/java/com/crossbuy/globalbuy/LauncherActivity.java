package com.crossbuy.globalbuy;

import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.browser.customtabs.CustomTabsIntent;

/**
 * 站点启动页：以 Custom Tab 打开（Chrome 内核渲染，可隐藏地址栏）。
 * 当前为 IP 站点，TWA 数字资产校验需 https + 正式域名；
 * 域名就绪后可切 TrustedWebActivityIntentBuilder 全屏模式。
 * 网页内 pwa.js 的在线升级提示与下载中心在此模式下自动生效。
 */
public class LauncherActivity extends AppCompatActivity {

    // 站点地址：CI 可通过环境变量覆盖，正式域名切换只改这里
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

        CustomTabsIntent intent = new CustomTabsIntent.Builder()
            .setShowTitle(true)
            .setUrlBarHidingEnabled(true)
            .setShareState(CustomTabsIntent.SHARE_STATE_OFF)
            .build();
        intent.launchUrl(this, url);
        finish();
    }
}
