(() => {
  "use strict";
  if (globalThis.MMNativeHiding) return;
  let storageKey = null, overrides = {}, enabled = false, filtered = new Set(), observer = null;
  const states = new Map();
  const menuActions = new Map();
  const nativeActions = new Set();

  // A listing editor may defer filtering without writing a manual Unhide override.
  const filterHolds = new Map();
  const holdPost = id => {
    const token = {};
    filterHolds.set(token, id);
    return () => { if (filterHolds.delete(token)) apply(); };
  };

  const hidden = node => (node.className || "").split(/\s+/u).includes("post-hidden");
  const setHidden = (node, id, value) => {
    if (hidden(node) !== value) node.className = [...(node.className || "").split(/\s+/u).filter(name => name && name !== "post-hidden"), ...(value ? ["post-hidden"] : [])].join(" ");
    const arrow = document.getElementById(`sa${id}`);
    if (arrow) { if (value && !arrow.hasAttribute("data-hidden")) arrow.setAttribute("data-hidden", id); else if (!value) arrow.removeAttribute("data-hidden"); }
  };
  const saveOverride = (id, value) => {
    overrides[id] = value;

    if (globalThis.MMDataStoreClient) {
      const scope = storageKey.slice(storageKey.lastIndexOf(":") + 1);
      void globalThis.MMDataStoreClient.change({ kind: "override", scope, post: id, value }).catch(() => { overrides = globalThis.MMDataStoreClient.overrides(scope); apply(); });
      return;
    }

    // The worker serializes read/modify/write across tabs. No browsing data leaves the device.
    chrome.runtime?.sendMessage?.({ type: "post-override.set", key: storageKey, post: id, value });
  };
  const updateMenu = () => {
    for (const [item] of menuActions) if (!item.isConnected) menuActions.delete(item);
    const menu = document.querySelector('#post-menu > ul'); if (!menu) return;
    const source = [...menu.querySelectorAll('[data-id]')].find(item => !item.hasAttribute('data-mm-post-toggle'));
    const id = source?.getAttribute('data-id') || source?.dataset.id;
    if (!id || source.hasAttribute('data-board')) return;
    const node = document.getElementById(`pc${id}`) || document.getElementById(`p${id}`); if (!node) return;
    let action = menu.querySelector('[data-cmd="hide-r"]') || menu.querySelector('[data-mm-post-toggle]');
    if (!action) {
      action = document.createElement('li'); action.setAttribute('role', 'menuitem'); action.setAttribute('data-mm-post-toggle', id);
      menuActions.set(action, {created:true}); menu.append(action);
    } else if (!action.hasAttribute('data-mm-post-toggle') && ( !document.getElementById(`sa${id}`))) {
      // Preserve the host menu item, but handle this action locally when the host
      // has no reply-hiding state or the scenario must not write live storage.
      menuActions.set(action, {created:false,command:action.getAttribute('data-cmd'),label:action.textContent,id});
      action.removeAttribute('data-cmd'); action.setAttribute('data-mm-post-toggle', id);
    }
    const label = hidden(node) ? 'Unhide post' : 'Hide post';
    if (action.textContent !== label) action.textContent = label;
  };
  const readingAnchor = () => {
    if (!globalThis.scrollBy || !globalThis.innerHeight) return null;
    for (const node of document.querySelectorAll('.postContainer')) {
      const box=node.getBoundingClientRect();
      if(box.bottom>0 && box.top<globalThis.innerHeight)return {node,top:box.top};
    }
    return null;
  };
  const apply = () => {
    if (!enabled) return;
    const anchor=readingAnchor();
    for (const post of document.querySelectorAll(".post")) {
      const id = /^p([1-9][0-9]*)$/u.exec(post.id || "")?.[1]; if (!id) continue;
      if (nativeActions.has(id)) continue;
      const node = document.getElementById(`pc${id}`) || post;
      if (node.dataset.mmHiding !== 'true') node.dataset.mmHiding = 'true';
      let state = states.get(id);
      if (!state || state.node !== node) { state = { node, owned: node.dataset.mmTagFiltered === "true", last: hidden(node) }; states.set(id, state); }
      // Native Unhide also covers recursive unhiding and controls supplied by the host.
      if (state.last && !hidden(node)) { state.owned = false; saveOverride(id, true); }
      if (overrides[id] === true) { setHidden(node, id, false); state.owned = false; }
      else if (overrides[id] === false) { setHidden(node, id, true); state.owned = false; }
      else if (filtered.has(id)  && ![...filterHolds.values()].includes(id) ) {
        if (!hidden(node)) { state.owned = true; setHidden(node, id, true); }
      } else if (state.owned) { setHidden(node, id, false); state.owned = false; }
      const managed = state.owned && hidden(node);
      if (managed && node.dataset.mmTagFiltered !== "true") node.dataset.mmTagFiltered = "true";
      else if (!managed && node.dataset.mmTagFiltered) delete node.dataset.mmTagFiltered;
      state.last = hidden(node);
    }
    if(anchor?.node.isConnected){const delta=anchor.node.getBoundingClientRect().top-anchor.top;if(Math.abs(delta)>0.5){const before=globalThis.pageYOffset;globalThis.scrollBy({top:delta,left:0,behavior:'instant'});const moved=globalThis.pageYOffset-before;for(const popup of document.querySelectorAll('.mm-tag-popup')){const top=parseFloat(popup.style.top);if(Number.isFinite(top))popup.style.top=`${top+moved}px`;}}}
    // Remove fallback header links from a restored/cloned older post as well.
    for (const link of document.querySelectorAll('[data-mm-native-unhide]')) link.remove();
    updateMenu();
    for (const [id, state] of states) if (state.node.isConnected === false) states.delete(id);
  };
  const nativeClick = event => {
    const fallback = event.target?.closest?.('[data-mm-post-toggle]');
    if (fallback) {
      if (!fallback.closest('#post-menu')) return;
      const id = fallback.getAttribute("data-mm-post-toggle"), node = document.getElementById(`pc${id}`) || document.getElementById(`p${id}`);
      if (!node) return;
      // Let the event reach the host's menu closer. There is no host command to run.
      event.preventDefault();
      const show = hidden(node); saveOverride(id, show);
      const state = states.get(id); if (state) { state.owned = false; state.last = !show; }
      setHidden(node, id, !show); apply(); return;
    }
    const action = event.target?.closest?.('[data-cmd="hide-r"]');
    const id = action?.getAttribute("data-id"); if (!id) return;
    const node = document.getElementById(`pc${id}`); if (!node) return;
    const showing = hidden(node);
    
    nativeActions.add(id);
    // Let the native toggle finish before applying storage notifications or filters.
    // Otherwise an early notification can invert the state the host is about to toggle.
    setTimeout(() => {
      nativeActions.delete(id);
      const state = states.get(id); if (state) { state.owned = false; state.last = hidden(node); }
      saveOverride(id, showing); apply();
    }, 0);
  };
  const init = async (profile, route) => {
    if (!route) return;
    storageKey = `mmPostOverridesV1:${profile}:${route.key}`;
     if (globalThis.MMDataStoreClient) { overrides = globalThis.MMDataStoreClient.overrides(route.key); return; }
    overrides = (await chrome.storage.local.get([storageKey]))[storageKey] || {};
    chrome.storage.onChanged?.addListener((changes, area) => {
      if (area === "local" && changes[storageKey]) { overrides = changes[storageKey].newValue || {}; apply(); }
    });
  };
  const mount = () => {
    enabled = true; document.addEventListener("click", nativeClick, true);
    if (!observer && globalThis.MutationObserver) { observer = new globalThis.MutationObserver(apply); observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] }); }
    apply();
  };
  const cleanup = () => {
     filterHolds.clear();
    enabled = false; observer?.disconnect(); observer = null; document.removeEventListener("click", nativeClick, true);
    for (const [id, state] of states) { if (state.owned) setHidden(state.node, id, false); delete state.node.dataset.mmTagFiltered; delete state.node.dataset.mmHiding; }
    for (const [item, original] of menuActions) {
      if (original.created) item.remove();
      else {
        const node=document.getElementById(`pc${original.id}`) || document.getElementById(`p${original.id}`);
        item.setAttribute('data-cmd', original.command); item.removeAttribute('data-mm-post-toggle'); item.textContent=node ? hidden(node) ? 'Unhide post' : 'Hide post' : original.label;
      }
    }
    menuActions.clear();
    for (const link of document.querySelectorAll('[data-mm-native-unhide]')) link.remove(); states.clear();
  };
  globalThis.MMNativeHiding = Object.freeze({ init, mount, apply: ids => { filtered = new Set(ids); apply(); }, cleanup,  holdPost, setOverrides: value => { overrides = value; apply(); },  });
})();
