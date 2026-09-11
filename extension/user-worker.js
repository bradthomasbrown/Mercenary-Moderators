importScripts("error-trace.js");
importScripts("market-worker.js");
importScripts("recovery-codec.js");
importScripts("user-data-worker.js");
(() => {
  "use strict";
  const userData = globalThis.MMUserDataWorker.create({ chrome, codec: globalThis.MMRecoveryCodec });
  let pending = Promise.resolve();
  chrome.runtime.onMessage.addListener((message, sender, send) => {
    // onMessage is the internal extension channel (external callers use
    // onMessageExternal). Some browsers omit the optional MessageSender.id.
    if (typeof sender?.id === "string" && typeof chrome.runtime.id === "string" && sender.id !== chrome.runtime.id) {
      void globalThis.MMErrorTrace.record("message", "sender_mismatch", null, { phase: "runtime", senderId: "mismatch" });
      return false;
    }
    if (message?.type === "recovery.open") {
      void chrome.tabs.create({ url: chrome.runtime.getURL("recovery.html") }).then(() => send({ ok: true }), () => send({ ok: false, reason: "recovery_unavailable" }));
      return true;
    }
    if (message?.type?.startsWith("user-data.")) {
      void userData.handle(message, sender).then(send);
      return true;
    }
    if (message?.type?.startsWith("tag-market.")) {
      void globalThis.MMMarketRequest(message, { senderId: typeof sender?.id === "string" ? "present" : "missing" }).then(send);
      return true;
    }
    if (message?.type !== "post-override.set") return false;
    const operation = async () => {
      if (!/^mmPostOverridesV1:1:[a-z0-9]+\/[1-9][0-9]*$/u.test(message.key) || !/^[1-9][0-9]*$/u.test(message.post) || typeof message.value !== "boolean") return { ok: false, reason: "invalid_override" };
      const old = (await chrome.storage.local.get([message.key]))[message.key] || {};
      await chrome.storage.local.set({ [message.key]: { ...old, [message.post]: message.value } });
      return { ok: true };
    };
    pending = pending.then(operation, operation).then(send, () => send({ ok: false, reason: "storage_unavailable" }));
    return true;
  });
})();
