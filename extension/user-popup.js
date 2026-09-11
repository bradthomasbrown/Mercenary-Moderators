(() => {
  "use strict";
  const enabled = document.querySelector("#enabled"), state = document.querySelector("#state");
  document.querySelector("#version").textContent = `Version ${chrome.runtime.getManifest().version}`;
  enabled.disabled = true;
  const render = () => { state.textContent = enabled.checked ? "Ready on 4chan threads." : "Tags and market are paused."; };
  void chrome.storage.local.get(["mmPackagedRulesEnabled"]).then(value => {
    enabled.checked = value.mmPackagedRulesEnabled !== false; enabled.disabled = false; render();
  }, error => { void globalThis.MMErrorTrace.record("settings", "storage_unavailable", error, { phase: "storage" }); state.textContent = "Could not load settings. Reopen this menu to retry."; });
  enabled.addEventListener("change", async () => {
    enabled.disabled = true;
    try { await chrome.storage.local.set({ mmPackagedRulesEnabled: enabled.checked }); render(); }
    catch (error) { void globalThis.MMErrorTrace.record("settings", "storage_unavailable", error, { phase: "storage" }); enabled.checked = !enabled.checked; state.textContent = "Could not save settings. Try again."; }
    finally { enabled.disabled = false; }
  });
  const output = document.querySelector("#trace-output"), traceStatus = document.querySelector("#trace-status"), copy = document.querySelector("#trace-copy"), clear = document.querySelector("#trace-clear");
  const refreshTrace = async () => {
    const trace = await globalThis.MMErrorTrace.read();
    output.value = JSON.stringify(trace, null, 2);
    document.querySelector("#trace-count").textContent = `(${trace.events.length})`;
    clear.disabled = trace.events.length === 0;
    traceStatus.textContent = !trace.storageAvailable ? "Trace storage is unavailable. Only errors still in memory may appear." : trace.events.length ? "Ready to copy. You can also select and copy the trace text." : "No errors recorded since installation or the last clear.";
  };
  copy.addEventListener("click", async () => {
    output.focus(); output.select(); output.setSelectionRange(0, output.value.length);
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(output.value);
      else if (!document.execCommand("copy")) throw new Error("Clipboard unavailable");
      traceStatus.textContent = "Trace copied. Paste it in your message to the developer.";
    } catch {
      traceStatus.textContent = "Trace selected. Use your device’s Copy command to share it.";
    }
  });
  clear.addEventListener("click", async () => {
    clear.disabled = true;
    try { await globalThis.MMErrorTrace.clear(); await refreshTrace(); traceStatus.textContent = "Trace cleared. New errors will be recorded."; }
    catch { clear.disabled = false; traceStatus.textContent = "Could not clear the trace. Reopen this menu to retry."; }
  });
  chrome.storage.onChanged?.addListener((changes, area) => { if (area === "local" && globalThis.MMErrorTrace.keys.some(key => key in changes)) void refreshTrace(); });
  void refreshTrace();
})();
