import android.app.UiAutomation;
import android.os.HandlerThread;
import android.os.Looper;
import android.graphics.Rect;
import android.view.accessibility.AccessibilityNodeInfo;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;

public final class ConsumerTree {
  static String clickLabel;
  static boolean clicked;
  static void visit(AccessibilityNodeInfo node, JSONArray nodes) throws Exception {
    if (node == null) return;
    if (clickLabel != null && node.isVisibleToUser() &&
        (clickLabel.equalsIgnoreCase(String.valueOf(node.getText())) ||
         (clickLabel.equalsIgnoreCase(String.valueOf(node.getContentDescription())) ||
         String.valueOf(node.getContentDescription()).startsWith(clickLabel + ". ")))) {
      clicked = node.performAction(AccessibilityNodeInfo.ACTION_CLICK);
    }
    Rect b = new Rect(); node.getBoundsInScreen(b);
    JSONObject item = new JSONObject();
    item.put("text", node.getText() == null ? "" : node.getText().toString());
    item.put("description", node.getContentDescription() == null ? "" : node.getContentDescription().toString());
    item.put("bounds", new JSONArray(new int[]{b.left,b.top,b.right,b.bottom}));
    item.put("accessibilityFocused",node.isAccessibilityFocused());
    item.put("visible",node.isVisibleToUser());
    nodes.put(item);
    for(int i=0;i<node.getChildCount();i++) visit(node.getChild(i), nodes);
  }
  public static void main(String[] args) throws Exception {
    Looper.prepareMainLooper();
    HandlerThread thread=new HandlerThread("consumer-tree");thread.start();
    Class<?> iface=Class.forName("android.app.IUiAutomationConnection");
    Object connection=Class.forName("android.app.UiAutomationConnection").getConstructor().newInstance();
    UiAutomation ui=(UiAutomation)UiAutomation.class.getConstructor(Looper.class,iface).newInstance(thread.getLooper(),connection);
    try {
      UiAutomation.class.getMethod("connect",int.class).invoke(ui,UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES);
      System.out.println("{\"ready\":true}");
      BufferedReader input = new BufferedReader(new InputStreamReader(System.in));
      String line;
      while ((line = input.readLine()) != null && !line.equals("quit")) {
        try {
          clickLabel = line.isEmpty() ? null : line;
          clicked = false;
          AccessibilityNodeInfo root=ui.getRootInActiveWindow();
          if (root == null || !"org.nativescript.routerrc3validation".contentEquals(root.getPackageName()))
            throw new IllegalStateException("Consumer is not the active window");
          JSONArray nodes=new JSONArray();visit(root,nodes);
          if (clickLabel != null && !clicked) throw new IllegalStateException("Cannot activate " + clickLabel);
          System.out.println(new JSONObject().put("nodes", nodes));
        } catch (Exception error) {
          System.out.println(new JSONObject().put("error", error.toString()));
        }
      }

    } finally {
      UiAutomation.class.getMethod("disconnect").invoke(ui);thread.quitSafely();
      System.exit(0);
    }
  }
}
