(() => {
  "use strict";
  if (globalThis.MMNativePopup) return;
  const properties = Object.freeze([
    ["background-color", "--mm-native-popup-header-background"], ["color", "--mm-native-popup-header-color"],
    ["font-family", "--mm-native-popup-header-font-family"], ["font-size", "--mm-native-popup-header-font-size"],
    ["font-weight", "--mm-native-popup-header-font-weight"], ["line-height", "--mm-native-popup-header-line-height"],
    ["height", "--mm-native-popup-header-height"], ["margin-top", "--mm-native-popup-header-margin-top"],
    ["margin-right", "--mm-native-popup-header-margin-right"], ["margin-bottom", "--mm-native-popup-header-margin-bottom"],
    ["margin-left", "--mm-native-popup-header-margin-left"], ["padding-top", "--mm-native-popup-header-padding-top"],
    ["padding-right", "--mm-native-popup-header-padding-right"], ["padding-bottom", "--mm-native-popup-header-padding-bottom"],
    ["padding-left", "--mm-native-popup-header-padding-left"], ["border-top-width", "--mm-native-popup-header-border-top-width"],
    ["border-right-width", "--mm-native-popup-header-border-right-width"], ["border-bottom-width", "--mm-native-popup-header-border-bottom-width"],
    ["border-left-width", "--mm-native-popup-header-border-left-width"], ["border-top-color", "--mm-native-popup-header-border-top-color"],
    ["border-right-color", "--mm-native-popup-header-border-right-color"], ["border-bottom-color", "--mm-native-popup-header-border-bottom-color"],
    ["border-left-color", "--mm-native-popup-header-border-left-color"]
  ]);
  const probe = () => {
    const existing = document.getElementById("qrHeader"); if (existing) return { node: existing, shell: document.getElementById("quickReply") ?? existing.closest?.("#quickReply") ?? null, temporary: false };
    const shell = document.createElement("div"); shell.id = "quickReply"; shell.className = "extPanel reply qrWindow";
    const node = document.createElement("div"); node.id = "qrHeader"; node.className = "drag postblock"; node.textContent = "Reply"; shell.append(node);
    shell.style.setProperty("position", "absolute"); shell.style.setProperty("visibility", "hidden"); shell.style.setProperty("pointer-events", "none"); shell.style.setProperty("inset", "-10000px auto auto -10000px");
    document.body.append(shell); return { node, shell, temporary: true };
  };
  const background = node => {
    for (let item = node; item; item = item.parentElement) {
      const style = getComputedStyle(item), value = String(style.backgroundColor || style.getPropertyValue?.("background-color") || "").trim();
      if (value && value !== "transparent" && !/^rgba\([^)]*,\s*0(?:\.0+)?\s*\)$/u.test(value)) return value;
    }
    return "rgb(214, 218, 240)";
  };
  const apply = root => {
    const source = probe();
    try {
      const style = getComputedStyle(source.node); for (const [property, variable] of properties) { const value = String(style.getPropertyValue?.(property) || "").trim(); if (value) root.style.setProperty(variable, value); }
      const surface = source.shell || source.node, surfaceStyle = getComputedStyle(surface);
      root.style.setProperty("--mm-native-popup-background", background(surface));
      const color = surfaceStyle.color || surfaceStyle.getPropertyValue?.("color");
      if (color) root.style.setProperty("--mm-native-popup-color", color);
      if (!source.temporary && source.shell && source.shell.isConnected !== false && source.shell.hidden !== true) {
        const shellStyle = getComputedStyle(source.shell), display = String(shellStyle.getPropertyValue?.("display") || "").trim(), visibility = String(shellStyle.getPropertyValue?.("visibility") || "").trim(), shellWidth = Number(source.shell.getBoundingClientRect?.().width);
        if (display !== "none" && !["hidden", "collapse"].includes(visibility) && Number.isFinite(shellWidth) && shellWidth > 4) root.style.setProperty("--mm-native-popup-content-max-width", `${Math.floor(shellWidth - 4)}px`);
      }
    }
    finally { if (source.temporary) source.shell.remove(); }
  };
  globalThis.MMNativePopup = Object.freeze({ apply, background });
})();
