package org.nativescript.dropinspector;

import android.app.Activity;
import android.app.Instrumentation;
import android.app.UiAutomation;
import android.graphics.Rect;
import android.os.Bundle;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONArray;
import org.json.JSONObject;

/** Read-only public instrumentation. Keeps TalkBack and the app process running. */
public final class DropInspector extends Instrumentation {
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); start(); }
    private void visit(AccessibilityNodeInfo node, JSONArray nodes) throws Exception {
        if (node == null) return;
        Rect bounds = new Rect(); node.getBoundsInScreen(bounds);
        nodes.put(new JSONObject()
            .put("text", node.getText() == null ? "" : node.getText().toString())
            .put("description", node.getContentDescription() == null ? "" : node.getContentDescription().toString())
            .put("package", String.valueOf(node.getPackageName()))
            .put("bounds", new JSONArray(new int[]{bounds.left,bounds.top,bounds.right,bounds.bottom}))
            .put("visible", node.isVisibleToUser()).put("enabled", node.isEnabled())
            .put("clickable", node.isClickable()).put("accessibilityFocused", node.isAccessibilityFocused()));
        for (int i = 0; i < node.getChildCount(); i++) visit(node.getChild(i), nodes);
        node.recycle();
    }
    @Override public void onStart() {
        Bundle result = new Bundle();
        try {
            UiAutomation ui = getUiAutomation(UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
            ui.waitForIdle(300, 10000);
            AccessibilityNodeInfo root = ui.getRootInActiveWindow();
            if (root == null) throw new IllegalStateException("No active window");
            JSONArray nodes = new JSONArray(); visit(root, nodes);
            result.putString("nodes", nodes.toString());
            result.putString("result", "DROP_INSPECTOR_OK");
            finish(Activity.RESULT_OK, result);
        } catch (Throwable error) {
            result.putString("error", error.toString());
            finish(Activity.RESULT_CANCELED, result);
        }
    }
}
