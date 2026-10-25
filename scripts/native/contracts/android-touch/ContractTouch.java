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
//
// SystemUI's edge-back recognizer rejects a swipe as a long press when the
// first move is stamped more than gestures.back_timeout (250 ms) after the
// down event. It compares the events' own timestamps, so the gesture runs on a
// planned timeline and is queued without waiting for delivery: a loaded
// emulator can delay dispatch, but can no longer stretch the gesture itself.
public final class ContractTouch extends Instrumentation {
    private static final int STEPS = 20;
    private static final long STEP_MS = 20;
    private Bundle arguments;
    private UiAutomation automation;
    private long downTime;
    private long eventTime;
    private float y;

    @Override public void onCreate(Bundle arguments) {
        super.onCreate(arguments);
        this.arguments = arguments;
        start();
    }

    private void input(int action, float x, boolean sync) {
        MotionEvent event = MotionEvent.obtain(downTime, eventTime, action, x, y, 0);
        event.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            if (!automation.injectInputEvent(event, sync))
                throw new IllegalStateException("System rejected touch event " + action);
        } finally {
            event.recycle();
        }
    }

    // The last step is delivered synchronously so the queue is drained before
    // the caller inspects the screen.
    private void move(float start, float end) {
        for (int step = 1; step <= STEPS; step++) {
            eventTime += STEP_MS;
            long wait = eventTime - SystemClock.uptimeMillis();
            if (wait > 0) SystemClock.sleep(wait);
            input(MotionEvent.ACTION_MOVE, start + (end - start) * step / STEPS, step == STEPS);
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
            eventTime = downTime;
            input(MotionEvent.ACTION_DOWN, 1, false);
            pointerDown = true;
            move(1, width * 0.35f);
            result.putLong("deliveryLagMs", SystemClock.uptimeMillis() - eventTime);
            Bitmap screenshot = automation.takeScreenshot();
            if (screenshot == null) throw new IllegalStateException("No native gesture screenshot");
            try (FileOutputStream output = new FileOutputStream(
                    new File(getTargetContext().getFilesDir(), "gesture.png"))) {
                screenshot.compress(Bitmap.CompressFormat.PNG, 100, output);
            } finally {
                screenshot.recycle();
            }
            float end = commit ? width * 0.85f : 1;
            eventTime = SystemClock.uptimeMillis();
            move(width * 0.35f, end);
            eventTime = SystemClock.uptimeMillis();
            input(MotionEvent.ACTION_UP, end, true);
            pointerDown = false;
            automation.waitForIdle(500, 10000);
            result.putString("result", "CONTRACT_TOUCH_OK");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            if (pointerDown) {
                eventTime = SystemClock.uptimeMillis();
                input(MotionEvent.ACTION_CANCEL, 1, true);
            }
            result.putString("error", error.toString());
            finish(Activity.RESULT_CANCELED, result);
        }
    }
}
