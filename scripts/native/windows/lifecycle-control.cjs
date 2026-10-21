// Diagnostic build only: NativeScript-Vue PR #1178's disposal change.
// Never enabled by the router package or the normal demo.
module.exports = function (source) {
  const start = source.indexOf('        const disposeCallback = (args) => {')
  const end = source.indexOf('        const reloadPage = () => {', start)
  if (
    start < 0 ||
    end < 0 ||
    !source.slice(start, end).includes('if (!isReloading && view)')
  )
    throw new Error(
      'Lifecycle control requires the published immediate-disposal implementation',
    )
  return (
    source.slice(0, start) +
    `        const disposeCallback = (args) => {
            const page = args.object;
            const nativeWindow = frame.getNativeWindow?.();
            void nextTick(() => {
                if (isReloading || !view || view.nativeView !== page) return;
                const retained = frame.currentPage === page ||
                    frame.backStack.some((entry) => entry.resolvedPage === page);
                const hostRetained = nativeWindow
                    ? nativeWindow.state !== 'closed' && frame.getNativeWindow?.() === nativeWindow
                    : frame._isInFrameStack !== false;
                if (retained && hostRetained) return;
                page.off(ViewBase.disposeNativeViewEvent, disposeCallback);
                view.unmount();
                view = null;
            });
        };
` +
    source.slice(end)
  )
}
