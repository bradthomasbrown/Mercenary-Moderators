(() => {
  "use strict";
  const FORMAT = "mm.personal-data/v1", PREFIX = "mmUserDataV2:", endpoint = "https://mm.bradthomasbrown.com/api/extension/tag-market/listings";
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const validIdentity = value => object(value) && /^tagger_[a-f0-9]{32}$/u.test(value.tagger) && /^[a-f0-9]{64}$/u.test(value.key);
  const tag = value => typeof value === "string" && value.length > 0 && value.length <= 80 && value === value.trim().replace(/\s+/gu, " ");
  const scope = value => typeof value === "string" && /^[a-z0-9]+\/[1-9][0-9]*$/u.test(value);
  const regularProfiles = ["1" ];
  const profile = value => {
    if (regularProfiles.includes(value)) return value;
    
    throw new Error("invalid_profile");
  };
  const validRecord = item => object(item) && typeof item.id === "string" && /^\S{1,512}$/u.test(item.id) && ["created", "acquired"].includes(item.origin) && /^[a-z0-9]+$/u.test(item.board) && /^[1-9][0-9]*$/u.test(item.thread) && /^[1-9][0-9]*$/u.test(item.post) && tag(item.tag);
  const validate = value => {
    if (!object(value) || value.format !== FORMAT || !validIdentity(value.identity) || !Array.isArray(value.records) || value.records.length > 10000 || !value.records.every(validRecord) || new Set(value.records.map(item => item.id)).size !== value.records.length) throw new Error("invalid_backup_data");
    if (!object(value.filters) || !Object.entries(value.filters).every(([key, tags]) => scope(key) && Array.isArray(tags) && tags.length <= 80 && tags.every(tag))) throw new Error("invalid_backup_data");
    if (!Array.isArray(value.dismissed) || !value.dismissed.every(id => typeof id === "string" && id.length <= 512)) throw new Error("invalid_backup_data");
    if (!object(value.overrides) || !Object.entries(value.overrides).every(([key, values]) => scope(key) && object(values) && Object.entries(values).every(([id, hidden]) => /^[1-9][0-9]*$/u.test(id) && typeof hidden === "boolean"))) throw new Error("invalid_backup_data");
    if (JSON.stringify(value).length > 2_000_000) throw new Error("backup_too_large");
    return value;
  };
  const payload = state => ({ format: FORMAT, identity: state.identity, records: state.records, filters: state.filters, dismissed: state.dismissed, overrides: state.overrides });
  const create = ({ chrome, codec, fetcher = (...args) => fetch(...args) }) => {
    let tail = Promise.resolve(); const timers = new Map(), uploading = new Map();
    const serial = task => { const result = tail.then(task, task); tail = result.catch(() => {}); return result; };
    const key = id => PREFIX + profile(id);
    const read = async id => (await chrome.storage.local.get([key(id)]))[key(id)] ?? null;
    const write = async (id, state) => { validate(payload(state)); await chrome.storage.local.set({ [key(id)]: state }); return JSON.parse(JSON.stringify(state)); };
    const make = data => ({ ...data, epoch: crypto.randomUUID(), revision: 1, backup: { enabled: false } });
    const load = async id => {
      const current = await read(id);
      if (current) { validate(payload(current)); if (!current.epoch || !Number.isSafeInteger(current.revision)) throw new Error("recovery_required"); return current; }
      let suffix = ""; 
      const keys = ["mmTagMarketV1" + suffix, "mmTaggerIdentityV1" + suffix, "mmTaggerManagementKeyV1" + suffix];
      const legacy = await chrome.storage.local.get(null), market = legacy[keys[0]], identity = { tagger: legacy[keys[1]] ?? market?.taggerIdentity, key: legacy[keys[2]] };
      if (keys.every(name => legacy[name] === undefined)) return null;
      if (!validIdentity(identity)) throw new Error("recovery_required");
      const overrides = Object.fromEntries(Object.entries(legacy).filter(([name]) => name.startsWith(`mmPostOverridesV1:${id}:`)).map(([name, values]) => [name.slice(`mmPostOverridesV1:${id}:`.length), values]));
      return write(id, make(validate({ format: FORMAT, identity, records: market?.records ?? [], filters: market?.filters ?? {}, dismissed: market?.dismissed ?? [], overrides })));
    };
    const cloud = async (action, code, input = {}) => {
      const { id, auth } = await codec.derive(code);
      const response = await fetcher(endpoint + "?recovery=1", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "recovery-" + action, id, auth, ...input }), signal: AbortSignal.timeout(20000) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error || "backup_unavailable"); return result;
    };
    const schedule = id => {
      if (!regularProfiles.includes(id) || timers.has(id) || uploading.has(id)) return;
      timers.set(id, setTimeout(() => { timers.delete(id); void upload(id); }, 5000));
      try { chrome.alarms?.create("mm-backup-" + id, { delayInMinutes: 1 }); } catch {}
    };
    const upload = id => {
      if (uploading.has(id)) return uploading.get(id);
      const operation = (async () => { let captured;
      try {
        captured = await serial(() => read(id));
        if (!captured?.backup?.enabled || captured.backup.savedRevision === captured.revision) return;
        const envelope = await codec.seal(payload(captured), captured.backup.code);
        const result = await cloud("put", captured.backup.code, { envelope, expectedRevision: captured.backup.remoteRevision ?? 0 });
        await serial(async () => {
          const state = await read(id);
          if (state?.epoch !== captured.epoch || state.backup.code !== captured.backup.code) return;
          state.backup = { ...state.backup, savedRevision: captured.revision, remoteRevision: result.revision, savedAt: result.savedAt, error: null };
          await write(id, state);
        });
      } catch (error) {
        if (captured) await serial(async () => { const state = await read(id); if (state?.epoch === captured.epoch) { state.backup.error = error.message === "backup_conflict" ? "backup_conflict" : "backup_unavailable"; await write(id, state); } }).catch(() => {});
      } finally {
        const latest = await serial(() => read(id)).catch(() => null);
        uploading.delete(id);
        if (latest?.backup?.enabled && !latest.backup.error && latest.backup.savedRevision !== latest.revision) schedule(id);
        if (latest?.backup?.enabled && latest.backup.error === "backup_unavailable") { try { chrome.alarms?.create("mm-backup-" + id, { delayInMinutes: 1 }); } catch {} }
      }
      })();
      uploading.set(id, operation); return operation;
    };
    const privileged = sender => {
      if (sender?.url) return sender.url === chrome.runtime.getURL("recovery.html");
      // Internal onMessage only: WebKit can omit extension-page sender metadata.
      // There is no external listener/connectable entry; content-tab calls stay excluded.
      return !!sender && !sender.tab && !sender.origin;
    };
    const status = state => state ? { present: true, tagger: state.identity.tagger, epoch: state.epoch, revision: state.revision, records: state.records.length, filters: Object.keys(state.filters).length, backup: { enabled: state.backup.enabled, savedAt: state.backup.savedAt ?? null, pending: state.backup.enabled && state.backup.savedRevision !== state.revision, error: state.backup.error ?? null } } : { present: false, epoch: null, revision: null };
    const handle = async (message, sender) => {
      try {
        if (typeof sender?.id === "string" && sender.id !== chrome.runtime.id) throw new Error("sender_mismatch");
        const id = profile(message.profile ?? "1"), action = message.type.slice("user-data.".length);
        if (!["get", "change"].includes(action) && !privileged(sender)) throw new Error("recovery_page_required");
        if (action === "preview") {
          const remote = message.envelope ? null : await cloud("get", message.code);
          const envelope = message.envelope ?? remote.envelope, data = validate(await codec.open(envelope, message.code));
          const current = await serial(() => read(id));
          return { ok: true, preview: { tagger: data.identity.tagger, records: data.records.length, filters: Object.keys(data.filters).length, overrides: Object.values(data.overrides).reduce((sum, posts) => sum + Object.keys(posts).length, 0), currentEpoch: current?.epoch ?? null, currentRevision: current?.revision ?? null }, envelope, remoteRevision: remote?.revision ?? null };
        }
        if (action === "restore") {
          const data = validate(await codec.open(message.envelope, message.code));
          return await serial(async () => {
            const current = await read(id);
            if ((current?.epoch ?? null) !== message.currentEpoch || (current?.revision ?? null) !== message.currentRevision) throw new Error("data_changed_preview_again");
            const state = make(data); state.backup = { enabled: false, code: codec.code(message.code) };
            // Restoring never writes an older file over an automatic backup.
            if (Number.isSafeInteger(message.remoteRevision) && message.remoteRevision > 0) state.backup = { ...state.backup, enabled: true, remoteRevision: message.remoteRevision, savedRevision: state.revision, savedAt: Date.now() };
            await write(id, state); return { ok: true, status: status(state) };
          });
        }
        if (action === "export") {
          const state = await serial(async () => { const state = await load(id); if (!state) throw new Error("setup_required"); if (!state.backup.code) { state.backup.code = codec.generate(); await write(id, state); } return state; });
          return { ok: true, code: state.backup.code, envelope: await codec.seal(payload(state), state.backup.code) };
        }
        if (action === "backup-now") { await upload(id); return { ok: true, status: status(await serial(() => read(id))) }; }
        const result = await serial(async () => {
          let state = await load(id);
          if (action === "status") return { ok: true, status: status(state) };
          if (action === "create" || (action === "get" && !state && regularProfiles.includes(id))) {
            if (state) throw new Error("identity_already_exists");
            state = make({ format: FORMAT, identity: { tagger: "tagger_" + crypto.randomUUID().replaceAll("-", ""), key: codec.generate() }, records: [], filters: {}, dismissed: [], overrides: {} });
            await write(id, state);
            if (action === "create") return { ok: true, status: status(state) };
          }
          
          if (!state) throw new Error("setup_required");
          if (action === "get") return { ok: true, state };
          if (action === "backup-code") return { ok: true, code: state.backup.code ?? null };
          if (action === "backup-enable") {
            if (!regularProfiles.includes(id)) throw new Error("invalid_profile");
            state.backup = { ...state.backup, code: state.backup.code ?? codec.generate(), enabled: true, error: null };
            await write(id, state); return { ok: true, code: state.backup.code, status: status(state) };
          }
          if (action === "backup-disable") { state.backup.enabled = false; await write(id, state); return { ok: true, status: status(state) }; }
          if (action !== "change") throw new Error("unsupported_message");
          if (message.epoch !== state.epoch) throw new Error("identity_changed_reload");
          const change = message.change;
          if (!object(change)) throw new Error("invalid_change");
          if (change.kind === "add") {
            if (!Array.isArray(change.records) || !change.records.every(validRecord)) throw new Error("invalid_change");
            for (const item of change.records) {
              if (change.fromSync && state.dismissed.includes(item.listingId)) continue;
              const existing = state.records.findIndex(record => record.id === item.id);
              if (existing < 0) state.records.push(item);
              // Record order supplies recent suggestions without a second history.
              // Reusing a tag promotes its existing record, preserving listing data;
              // passive sync must never turn an old acquisition into a recent use.
              else if (!change.fromSync) state.records.push(state.records.splice(existing, 1)[0]);
            }
          } else if (change.kind === "remove") {
            const removed = state.records.find(item => item.id === change.id);
            if (removed?.origin === "acquired" && removed.listingId && !state.dismissed.includes(removed.listingId)) state.dismissed.push(removed.listingId);
            state.records = state.records.filter(item => item.id !== change.id);
            if (removed && !state.records.some(item => item.board === removed.board && item.thread === removed.thread && item.tag === removed.tag)) state.filters[`${removed.board}/${removed.thread}`] = (state.filters[`${removed.board}/${removed.thread}`] ?? []).filter(tag => tag !== removed.tag);
          } else if (change.kind === "listed") {
            const record = state.records.find(item => item.id === change.id);
            if (record) Object.assign(record, { listed: true, price: change.price, visibility: change.visibility, listingId: change.listingId, tagger: state.identity.tagger });
          } else if (change.kind === "reveal") {
            for (const item of state.records) if (item.listingId === change.listingId) item.visibility = "revealed";
          } else if (change.kind === "filter") {
            if (!scope(change.scope) || !tag(change.tag)) throw new Error("invalid_change");
            const active = new Set(state.filters[change.scope] ?? []); if (active.has(change.tag)) active.delete(change.tag); else active.add(change.tag); state.filters[change.scope] = [...active];
          } else if (change.kind === "override") {
            if (!scope(change.scope) || !/^[1-9][0-9]*$/u.test(change.post) || typeof change.value !== "boolean") throw new Error("invalid_change");
            state.overrides[change.scope] = { ...state.overrides[change.scope], [change.post]: change.value };
          } else throw new Error("invalid_change");
          state.revision++; await write(id, state); return { ok: true, state };
        });
        if (["get", "change", "backup-enable"].includes(action)) schedule(id);
        return result;
      } catch (error) {
        const reasons = ["sender_mismatch", "recovery_page_required", "setup_required", "recovery_required", "invalid_profile", "invalid_change", "invalid_backup_data", "invalid_backup", "backup_too_large", "invalid_recovery_code", "backup_code_mismatch", "backup_not_found", "backup_unavailable", "backup_conflict", "identity_already_exists", "identity_changed_reload", "data_changed_preview_again"];
        return { ok: false, reason: reasons.includes(error.message) ? error.message : "storage_unavailable" };
      }
    };
    chrome.alarms?.onAlarm?.addListener(alarm => { if (regularProfiles.some(id => alarm.name === "mm-backup-" + id)) void upload(alarm.name.slice(-1)); });
    // Persisted dirty revisions survive worker suspension; the next wake retries.
    for (const id of regularProfiles) void read(id).then(state => { if (state?.backup?.enabled && state.backup.savedRevision !== state.revision) schedule(id); }).catch(() => {});
    return Object.freeze({ handle, validate, upload });
  };
  globalThis.MMUserDataWorker = Object.freeze({ create, validate });
})();
