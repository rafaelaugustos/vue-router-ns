package org.nativescript.router;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

/** Explicit app integration: static shortcuts otherwise clear the app's task. */
public final class ShortcutEntryActivity extends Activity {
    private Intent target;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        Uri destination = getIntent().getData();
        finish();
        if (destination == null || !"vue-router-ns".equals(destination.getScheme())
                || !"shortcut".equals(destination.getHost())) return;
        target = new Intent(Intent.ACTION_VIEW, destination);
        target.setComponent(new ComponentName(this, "com.tns.NativeScriptActivity"));
        target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
    }

    @Override public void onDestroy() {
        super.onDestroy();
        if (target == null) return;
        final Intent destination = target;
        target = null;
        // Let NativeScript retire this temporary Activity's NativeWindow first.
        // The real NativeScriptActivity then becomes primary on a cold launch.
        new Handler(Looper.getMainLooper()).post(() -> getApplicationContext().startActivity(destination));
    }
}
