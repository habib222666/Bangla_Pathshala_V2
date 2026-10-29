package com.banglapathshala.app;

import android.app.Activity;
import android.os.Build;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.util.Log;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;

public class MainActivity extends Activity {

    private WebView webView;
    private TextToSpeech textToSpeech;
private OnBackInvokedCallback backCallback;

    private static final String TAG = "BanglaPathshala";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            backCallback = () -> handleBackPressed();
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                    backCallback
            );
        }

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);

        // Always load the latest live GitHub Pages version.
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        webView.clearHistory();
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);

        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {
            public boolean onConsoleMessage(ConsoleMessage cm) {
                Log.e(TAG,
                        cm.message() + " -- line " + cm.lineNumber());
                return true;
            }
        });

        webView.addJavascriptInterface(new TTSBridge(), "Android");

        textToSpeech = new TextToSpeech(this, status -> {

            if (status == TextToSpeech.SUCCESS) {

                Log.d(TAG, "Google TTS initialized");

                Locale banglaLocale = new Locale("bn", "BD");

                int result = textToSpeech.setLanguage(banglaLocale);

                if (result == TextToSpeech.LANG_MISSING_DATA ||
                        result == TextToSpeech.LANG_NOT_SUPPORTED) {

                    result = textToSpeech.setLanguage(new Locale("bn"));
                }

                if (result != TextToSpeech.LANG_MISSING_DATA &&
                        result != TextToSpeech.LANG_NOT_SUPPORTED) {

                    try {

                        for (Voice voice : textToSpeech.getVoices()) {

                            if (voice == null) {
                                continue;
                            }

                            Locale locale = voice.getLocale();

                            if (locale == null) {
                                continue;
                            }

                            String language = locale.getLanguage();

                            String voiceName = voice.getName()
                                    .toLowerCase(Locale.ROOT);

                            if ("bn".equals(language) &&
                                    voiceName.contains("female")) {

                                textToSpeech.setVoice(voice);

                                Log.d(TAG,
                                        "Bengali Female Voice Selected: "
                                                + voice.getName());

                                break;
                            }
                        }

                    } catch (Exception e) {

                        Log.e(TAG,
                                "Voice selection error", e);
                    }
                }

            } else {

                Log.e(TAG,
                        "Google TTS initialization failed");
            }
        });

        // Cache-busting URL so WebView requests the latest deployed web source.
        webView.loadUrl(
                "https://habib222666.github.io/BanglaPathshala/?v="
                        + System.currentTimeMillis()
        );
    }


    private class TTSBridge {

        private String[] lines = new String[0];
        private int currentLine = 0;
        private boolean paused = false;
        private boolean speaking = false;


        @JavascriptInterface
        public boolean isViewer() {
            return BuildConfig.FLAVOR.equals("viewer");
        }

        @JavascriptInterface
        public void speak(String text) {

            if (textToSpeech == null) {
                Log.e(TAG, "TTS is not ready");
                return;
            }

            if (text == null) {
                return;
            }

            lines = text.split("\\n");
            currentLine = 0;
            paused = false;
            speaking = true;

            textToSpeech.stop();

            textToSpeech.setOnUtteranceProgressListener(
                    new UtteranceProgressListener() {

                        @Override
                        public void onStart(String utteranceId) {
                            Log.d(TAG,
                                    "Speaking started: "
                                            + utteranceId);
                        }

                        @Override
                        public void onDone(String utteranceId) {

                            if (!speaking) {
                                return;
                            }

                            if (!paused &&
                                    currentLine < lines.length - 1) {

                                currentLine++;
                                speakCurrentLine();

                            } else if (
                                    currentLine >= lines.length - 1) {

                                speaking = false;

                                Log.d(TAG,
                                        "Speaking finished");
                            }
                        }

                        @Override
                        public void onError(String utteranceId) {

                            Log.e(TAG,
                                    "TTS error: "
                                            + utteranceId);
                        }
                    });

            speakCurrentLine();
        }


        private void speakCurrentLine() {

            if (!speaking ||
                    paused ||
                    currentLine >= lines.length) {

                return;
            }

            String line = lines[currentLine].trim();

            if (line.isEmpty()) {

                currentLine++;

                speakCurrentLine();

                return;
            }

            Log.d(TAG,
                    "Speaking line "
                            + currentLine
                            + ": "
                            + line);

            textToSpeech.speak(
                    line,
                    TextToSpeech.QUEUE_FLUSH,
                    null,
                    "BanglaPathshalaLine_" + currentLine
            );
        }


        @JavascriptInterface
        public void pause() {

            if (textToSpeech != null &&
                    speaking) {

                paused = true;

                textToSpeech.stop();

                Log.d(TAG,
                        "TTS paused");
            }
        }


        @JavascriptInterface
        public void resume() {

            if (textToSpeech != null &&
                    speaking &&
                    paused) {

                paused = false;

                Log.d(TAG,
                        "TTS resumed");

                speakCurrentLine();
            }
        }


        @JavascriptInterface
        public void stop() {

            if (textToSpeech != null) {
                textToSpeech.stop();
            }

            speaking = false;
            paused = false;
            currentLine = 0;
            lines = new String[0];

            Log.d(TAG,
                    "TTS stopped");
        }
    }


    @Override
    protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
            backCallback = null;
        }



        if (textToSpeech != null) {

            textToSpeech.stop();
            textToSpeech.shutdown();
            textToSpeech = null;
        }

        if (webView != null) {

            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }


    private void handleBackPressed() {
        if (webView == null) {
            finish();
            return;
        }

        webView.evaluateJavascript(
                "(function() {" +
                "var reader=document.getElementById('reader');" +
                "var contents=document.getElementById('contents');" +
                "var library=document.getElementById('library');" +
                "if(reader && !reader.classList.contains('hidden')) {" +
                "var b=document.getElementById('back');" +
                "if(b) { b.click(); return true; }" +
                "}" +
                "if(contents && !contents.classList.contains('hidden')) {" +
                "if(typeof showHome === 'function') { showHome(); return true; }" +
                "}" +
                "if(library && !library.classList.contains('hidden')) {" +
                "if(typeof showHome === 'function') { showHome(); return true; }" +
                "}" +
                "return false;" +
                "})()",
                result -> {
                    if ("false".equals(result)) {
                        finish();
                    }
                }
        );
    }

    @Override
    public void onBackPressed() {
        handleBackPressed();
    }
}
