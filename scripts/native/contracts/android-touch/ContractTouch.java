package org.nativescript.contracttouch;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.io.File;
import java.io.FileOutputStream;

// A separate, self-instrumented APK. The NativeScript app stays in its original
// process and receives real system input through the public UiAutomation API.
public final class ContractTouch extends Instrumentation {
    private Bundle arguments;
    private UiAutomation automation;
    private long downTime;
    private float y;

    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        this.arguments = arguments;
        start();
    }

    private void input(int action, float x) {
        MotionEvent event = MotionEvent.obtain(downTime, SystemClock.uptimeMillis(),
                action, x, y, 0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            if (!automation.injectInputEvent(event, true))
                throw new IllegalStateException("System rejected touch event " + action);
        } finally {
            event.recycle();
        }
    }

    private void move(float start, float end) {
        for (int step = 1; step <= 20; step++) {
            SystemClock.sleep(20);
            input(MotionEvent.ACTION_MOVE, start + (end - start) * step / 20f);
        }
    }

    @Override public void onStart() {
        Bundle result = new Bundle();
        boolean pointerDown = false;
        try {
            automation = getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
            automation.waitForIdle(500, 10000);
            AccessibilityNodeInfo root = automation.getRootInActiveWindow();
            if (root == null || !"org.nativescript.vuerouterns".contentEquals(root.getPackageName()))
                throw new IllegalStateException("NativeScript must own the active window before the gesture");
            float width = Float.parseFloat(arguments.getString("width"));
            y = Float.parseFloat(arguments.getString("height")) * 0.5f;
            boolean commit = "commit".equals(arguments.getString("mode"));
            downTime = SystemClock.uptimeMillis();
            input(MotionEvent.ACTION_DOWN, 1);
            pointerDown = true;
            move(1, width * 0.35f);
            Bitmap screenshot = automation.takeScreenshot();
            if (screenshot == null) throw new IllegalStateException("No native gesture screenshot");
            try (FileOutputStream output = new FileOutputStream(
                    new File(getTargetContext().getFilesDir(), "gesture.png"))) {
                screenshot.compress(Bitmap.CompressFormat.PNG, 100, output);
            } finally {
                screenshot.recycle();
            }
            float end = commit ? width * 0.85f : 1;
            move(width * 0.35f, end);
            input(MotionEvent.ACTION_UP, end);
            pointerDown = false;
            automation.waitForIdle(500, 10000);
            result.putString("result", "CONTRACT_TOUCH_OK");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            if (pointerDown) input(MotionEvent.ACTION_CANCEL, 1);
            result.putString("error", error.toString());
            finish(Activity.RESULT_CANCELED, result);
        }
    }
}
