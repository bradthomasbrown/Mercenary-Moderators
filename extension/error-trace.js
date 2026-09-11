(() => {
  "use strict";
  if (globalThis.MMErrorTrace) return;
  const source = typeof document === "undefined" ? "worker" : location.protocol === "https:" ? "page" : "menu";
  const lanes = ["worker", "page", "menu"].map(name => `mmErrorTraceV1:${name}`), key = `mmErrorTraceV1:${source}`, clearKey = "mmErrorTraceV1:clearedAt", keys = [...lanes, clearKey];
  const limit = 20, memory = [], queued = [];
  let pending = null, storageAvailable = true;
  const operations = new Set(["initialization", "retrieve", "mine", "list", "reveal", "acquire", "sync", "offer", "subscribe", "wallet", "faucet", "message", "settings", "trace", "unhandled", "other"]);
  const codes = new Set(["sender_mismatch", "network_unavailable", "request_timeout", "server_bridge_unavailable", "storage_unavailable", "invalid_response", "api_error", "unauthorized", "rate_limited", "invalid_input", "island_unavailable", "thread_closed", "insufficient_funds", "price_changed", "resource_busy", "resource_limit", "not_found", "unexpected_error", "clipboard_unavailable"]);
  const phases = new Set(["send", "fetch", "response", "http", "storage", "runtime", "clipboard"]);
  const filenames = "(?:error-trace|user-worker|market-worker|market-component|tagging-component|native-hiding|native-popup|persistent-rules|packaged-rules|user-popup)\\.js";
  const frames = value => [...String(value || "").matchAll(new RegExp(`(${filenames}:\\d+(?::\\d+)?)`, "g"))].slice(0, 3).map(match => match[1]);
  function errorInfo(error) {
    if (!error) return {};
    const name = ["Error", "TypeError", "SyntaxError", "AbortError", "TimeoutError", "SecurityError", "NotAllowedError", "QuotaExceededError", "InvalidStateError", "ReferenceError"].includes(error.name) ? error.name : "Error";
    const message = String(error.message || "");
    // Preserve recognized browser failure meanings, never arbitrary messages,
    // request URLs, response bodies, account keys, page text or identifiers.
    const patterns = [
      [/receiving end does not exist|could not establish connection/i, "No extension message receiver."],
      [/message (?:port|channel) closed|port.*disconnected/i, "Extension message channel closed before its reply."],
      [/context invalidated/i, "Extension context was invalidated."],
      [/failed to fetch|load failed|networkerror|network request failed/i, "Browser network request failed."],
      [/timed? ?out|timeout/i, "Browser request timed out."],
      [/abort/i, "Browser request was aborted."],
      [/quota/i, "Browser storage quota was exceeded."],
      [/not allowed|denied|permission/i, "Browser permission was denied."],
      [/json|unexpected token|unexpected end/i, "Response was not valid JSON."],
      [/AbortSignal\.timeout.*not a function/i, "Browser does not provide AbortSignal.timeout."],
    ];
    return { name, message: patterns.find(([, known]) => known === message)?.[1] || patterns.find(([pattern]) => pattern.test(message))?.[1] || "Unrecognized browser error; raw detail omitted.", frames: frames(error.stack || (Array.isArray(error.frames) ? error.frames.slice(0, 3).join("\n") : "")) };
  }
  function clean(event) {
    const result = { at: typeof event?.at === "string" && /^\d{4}-\d\d-\d\dT[\d:.]+Z$/u.test(event.at) ? event.at : new Date().toISOString(), source: ["worker", "page", "menu"].includes(event?.source) ? event.source : source, operation: operations.has(event?.operation) ? event.operation : "other", code: codes.has(event?.code) ? event.code : "unexpected_error" };
    if (phases.has(event?.phase)) result.phase = event.phase;
    if (Number.isInteger(event?.status) && event.status >= 100 && event.status <= 599) result.status = event.status;
    if (Number.isFinite(event?.durationMs)) result.durationMs = Math.min(60_000, Math.max(0, Math.round(event.durationMs)));
    if (["present", "missing", "mismatch"].includes(event?.senderId)) result.senderId = event.senderId;
    if (event?.error) result.error = errorInfo(event.error);
    return result;
  }
  const bounded = rows => Array.isArray(rows) ? rows.slice(-limit).map(clean) : [];
  const remember = event => { memory.push(event); if (memory.length > limit) memory.shift(); };
  const sinceClear = (events, saved) => events.filter(event => event.at > (typeof saved[clearKey] === "string" ? saved[clearKey] : ""));
  const flush = () => {
    if (pending) return pending;
    pending = (async () => {
      while (queued.length) {
        const batch = queued.splice(0);
        try {
          const saved = await chrome.storage.local.get([key, clearKey]);
          const events = sinceClear([...bounded(saved[key]), ...batch], saved).slice(-limit);
          await chrome.storage.local.set({ [key]: events }); storageAvailable = true;
        } catch { storageAvailable = false; }
      }
    })().finally(() => { pending = null; if (queued.length) void flush(); });
    return pending;
  };
  const record = (operation, code, error, extra = {}) => {
    const event = clean({ ...extra, at: new Date().toISOString(), source, operation, code, error });
    remember(event);
    queued.push(event); if (queued.length > limit) queued.shift();
    return flush();
  };
  const read = async () => {
    await pending;
    let events = [], saved = {};
    try { saved = await chrome.storage.local.get(keys); events = lanes.flatMap(name => bounded(saved[name])); storageAvailable = true; }
    catch { storageAvailable = false; }
    for (const event of memory) if (!events.some(saved => JSON.stringify(saved) === JSON.stringify(event))) events.push(event);
    events = sinceClear(events, saved);
    events.sort((a, b) => a.at.localeCompare(b.at));
    return { format: "mm.error-trace/v1", capturedAt: new Date().toISOString(), extensionVersion: chrome.runtime.getManifest().version, browser: typeof navigator === "object" ? navigator.userAgent.slice(0, 240) : "unavailable", storageAvailable, events: events.slice(-limit * lanes.length) };
  };
  const clear = async () => {
    await pending;
    await chrome.storage.local.set({ ...Object.fromEntries(lanes.map(name => [name, []])), [clearKey]: new Date().toISOString() });
    memory.length = 0;
  };
  globalThis.MMErrorTrace = Object.freeze({ record, read, clear, keys });
  globalThis.addEventListener?.("error", event => {
    if (source === "page" && !frames(event.filename + ":" + event.lineno + ":" + event.colno).length && !frames(event.error?.stack).length) return;
    void record("unhandled", "unexpected_error", event.error, { phase: "runtime" });
  });
  globalThis.addEventListener?.("unhandledrejection", event => {
    if (source === "page" && !frames(event.reason?.stack).length) return;
    void record("unhandled", "unexpected_error", event.reason, { phase: "runtime" });
  });
})();
