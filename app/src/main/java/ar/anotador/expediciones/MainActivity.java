package ar.anotador.expediciones;

import android.app.Activity;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;

/** Toda la app vive en assets/ (HTML + JS); esta actividad solo la aloja. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // La hoja se consulta durante toda la partida: que no se apague la pantalla.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0F1619);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // la partida se guarda en localStorage
        s.setTextZoom(100);
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.onAndroidBack && window.onAndroidBack()) ? 1 : 0", handled -> {
            if (!"1".equals(handled)) finish();
        });
    }
}
