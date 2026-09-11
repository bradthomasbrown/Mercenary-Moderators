(() => {
  "use strict";
  const $ = id => document.getElementById(id); let profiles = { value: "1", disabled: false }; let status = null, preview = null, objectURL = null, busy = false;
  
  const messages = {
    setup_required: "Create or restore an identity to continue.", recovery_required: "The saved identity is incomplete. Restore a backup; no replacement identity has been created.",
    storage_unavailable: "Saved data is unavailable. Reopen this page and retry.", invalid_recovery_code: "Enter all 64 characters of your recovery code.",
    backup_code_mismatch: "This code could not unlock the backup. Check the code and file.", backup_not_found: "No automatic backup was found for that code. You can also select a saved file.",
    invalid_backup: "This file is not a supported encrypted backup.", invalid_backup_data: "The backup contains unsupported data. Nothing was replaced.",
    backup_too_large: "This backup is too large to save.", backup_unavailable: "Automatic backup could not complete. Your local data is saved; retry when connected.",
    backup_conflict: "A newer backup exists. Restore the latest automatic backup before continuing automatic uploads.",
    data_changed_preview_again: "This profile changed while you were reviewing. Review the backup again before restoring.", identity_already_exists: "This profile already has an identity."
  };
  const query = (action, input = {}) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("backup_unavailable")), 30000);
    try { chrome.runtime.sendMessage({ type: "user-data." + action, profile: profiles.value, ...input }, result => { clearTimeout(timer); if (chrome.runtime.lastError || !result?.ok) reject(new Error(result?.reason || "storage_unavailable")); else resolve(result); }); }
    catch { clearTimeout(timer); reject(new Error("storage_unavailable")); }
  });
  const render = value => {
    status = value; $("new-identity").hidden = value.present; $("current").hidden = !value.present;
    if (!value.present) return;
    $("identity").textContent = value.tagger; $("counts").textContent = `${value.records} saved tags · ${value.filters} thread filter sets`;
    $("enable").hidden = value.backup.enabled; $("disable").hidden = !value.backup.enabled; $("backup-now").hidden = !value.backup.enabled;
    $("backup-status").textContent = value.backup.error ? messages[value.backup.error] : value.backup.pending ? "Changes saved locally. Automatic backup pending." : value.backup.enabled ? `Backed up ${new Date(value.backup.savedAt).toLocaleString()}.` : "Automatic backup is off.";
  };
  const refresh = async () => { render((await query("status")).status); };
  const showCode = code => { $("saved-code").value = code.match(/.{1,8}/gu).join("-"); $("code-panel").hidden = false; };
  const invalidate = () => { preview = null; $("preview-panel").hidden = true; };
  const run = async (button, task) => {
    if (busy) return; busy = true; button.disabled = true; profiles.disabled = true; $("status").textContent = "Working…";
    try { await task(); }
    catch (error) { $("status").textContent = messages[error.message] || "Could not finish. Retry; your saved data has not been replaced."; }
    finally { busy = false; button.disabled = false; profiles.disabled = false; }
  };
  const bind = (id, task) => $(id).addEventListener("click", () => run($(id), task));
  bind("create", async () => { const result = await query("create"); render(result.status); $("status").textContent = "Identity created. You can now enable backup and reload your threads."; });
  bind("enable", async () => { const result = await query("backup-enable"); showCode(result.code); render(result.status); const finished = await query("backup-now"); render(finished.status); $("status").textContent = finished.status.backup.error ? messages[finished.status.backup.error] : "Automatic backup enabled. Save your recovery code."; });
  bind("backup-now", async () => { const result = await query("backup-now"); render(result.status); $("status").textContent = result.status.backup.error ? messages[result.status.backup.error] : "Backup is up to date."; });
  bind("disable", async () => { render((await query("backup-disable")).status); $("status").textContent = "Automatic backup is off. The last encrypted server backup remains available."; });
  bind("show-code", async () => { const result = await query("export"); showCode(result.code); $("status").textContent = "Save this recovery code to restore your identity."; });
  bind("export", async () => {
    const result = await query("export"); showCode(result.code); if (objectURL) URL.revokeObjectURL(objectURL);
    objectURL = URL.createObjectURL(new Blob([JSON.stringify(result.envelope)], { type: "application/json" }));
    $("download").href = objectURL; $("download").download = `mm-encrypted-backup-${new Date().toISOString().slice(0,10)}.json`; $("download").hidden = false;
    $("status").textContent = "Backup file prepared. Download it and save your recovery code separately.";
  });
  bind("copy-code", async () => { try { await navigator.clipboard.writeText($("saved-code").value); $("status").textContent = "Recovery code copied."; } catch { $("saved-code").focus(); $("saved-code").select(); $("status").textContent = "Select and copy the recovery code."; } });
  bind("preview", async () => {
    invalidate(); const file = $("restore-file").files[0]; let envelope;
    if (file) { if (file.size > 3_000_000) throw new Error("backup_too_large"); try { envelope = JSON.parse(await file.text()); } catch { throw new Error("invalid_backup"); } }
    const code = $("restore-code").value, result = await query("preview", { code, envelope });
    preview = { ...result, code }; const p = result.preview;
    $("preview-summary").textContent = `${p.tagger} · ${p.records} tags · ${p.filters} thread filter sets · ${p.overrides} hide/unhide choices.`;
    $("preview-panel").hidden = false; $("status").textContent = "Backup verified. Review it before restoring.";
  });
  bind("restore", async () => {
    if (!preview) return;
    const result = await query("restore", { code: preview.code, envelope: preview.envelope, remoteRevision: preview.remoteRevision, currentEpoch: preview.preview.currentEpoch, currentRevision: preview.preview.currentRevision });
    render(result.status); invalidate(); $("restore-code").value = ""; $("status").textContent = "Identity and local data restored. Reload your open threads.";
  });
  $("restore-code").addEventListener("input", invalidate); $("restore-file").addEventListener("change", invalidate);
  
  chrome.storage.onChanged?.addListener((changes, area) => { if (area === "local" && changes["mmUserDataV2:" + profiles.value] && !busy) void refresh().catch(() => {}); });
  $("version").textContent = `Version ${chrome.runtime.getManifest().version}`;
  void (async () => {  await refresh(); $("status").textContent = status.present ? "Saved identity loaded." : "Open a thread to start tagging, or restore a backup."; })().catch(error => { $("status").textContent = messages[error.message] || "Saved data is unavailable. Try reopening this page."; });
})();
