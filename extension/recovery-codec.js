(() => {
  "use strict";
  const format = "mm.encrypted-backup/v1", encoder = new TextEncoder(), decoder = new TextDecoder("utf-8", { fatal: true });
  const hex = bytes => [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
  const code = value => {
    const normalized = String(value || "").toLowerCase().replace(/[\s-]/gu, "");
    if (!/^[a-f0-9]{64}$/u.test(normalized)) throw new Error("invalid_recovery_code");
    return normalized;
  };
  const encode = bytes => { let result = ""; for (let i = 0; i < bytes.length; i += 8192) result += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(result); };
  const decode = value => {
    if (typeof value !== "string" || value.length > 3_000_000 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(value)) throw new Error("invalid_backup");
    return Uint8Array.from(atob(value), character => character.charCodeAt(0));
  };
  const derive = async value => {
    const normalized = code(value), secret = Uint8Array.from(normalized.match(/../gu), byte => parseInt(byte, 16));
    const material = await crypto.subtle.importKey("raw", secret, "HKDF", false, ["deriveBits"]);
    const bits = async purpose => new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: encoder.encode(format), info: encoder.encode(purpose) }, material, 256));
    return { id: hex(await bits("lookup")), auth: hex(await bits("authorization")), key: await crypto.subtle.importKey("raw", await bits("encryption"), "AES-GCM", false, ["encrypt", "decrypt"]) };
  };
  const seal = async (payload, value) => {
    const plaintext = encoder.encode(JSON.stringify(payload)); if (plaintext.length > 2_000_000) throw new Error("backup_too_large");
    const keys = await derive(value), nonce = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce, additionalData: encoder.encode(format + ":" + keys.id) }, keys.key, plaintext);
    return { format, id: keys.id, nonce: encode(nonce), ciphertext: encode(new Uint8Array(ciphertext)) };
  };
  const open = async (envelope, value) => {
    const keys = await derive(value);
    if (!envelope || envelope.format !== format || envelope.id !== keys.id) throw new Error("backup_code_mismatch");
    const nonce = decode(envelope.nonce), ciphertext = decode(envelope.ciphertext);
    if (nonce.length !== 12 || ciphertext.length < 16 || ciphertext.length > 2_000_016) throw new Error("invalid_backup");
    try { return JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: encoder.encode(format + ":" + keys.id) }, keys.key, ciphertext))); }
    catch { throw new Error("backup_code_mismatch"); }
  };
  globalThis.MMRecoveryCodec = Object.freeze({ code, derive, seal, open, generate: () => hex(crypto.getRandomValues(new Uint8Array(32))) });
})();
