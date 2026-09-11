(() => {
  "use strict";
  if (globalThis.MMTagMarket) return;

  let STORAGE_KEY = "mmTagMarketV1";
  let IDENTITY_KEY = "mmTaggerIdentityV1";
  let MANAGEMENT_KEY = "mmTaggerManagementKeyV1";
  let managementKey = null;
  let profile = "1";
  const OWNER = "post-tags-v1";
  const POLL_DELAYS_MS = [10000, 15000, 20000, 30000, 60000, 90000, 120000, 180000, 240000, 300000];
  const SEARCH_DELAY_MS = 500;
  const POLL_REQUEST_TIMEOUT_MS = 30000;
  const listeners = new Set();
  let records = [];
  let filters = {};
  let externalListings = [];
  let marketPost = "";
  let marketTagger = "";
  let ownListings = [];
  let ownPage = 1;
  let ownPages = 1;
  let ownLoading = false;
  let ownError = false, ownCache = {}, ownDirty = true, ownRevision = 0, ownPending = 0, ownRequest = null;
  const marketHistory = [];
  let marketQueryRevision = 0;
  let marketPage = 1;
  let marketPages = 1;
  let marketLoading = false;
  let marketPoll = false;
  let pollTimer = null;
  let pollDelayIndex = 0;
  let searchTimer = null;
  let searchField = "post";
  let searchSessionSaved = false;
  let navigationMenu = null;
  let navigationTrigger = null;
  let pollState = "inactive";
  let pollDueAt = 0;

  let taggerIdentity = null;
  let controls = [];
  let panel = null;
  let marketPostPreview = null;
  let panelMode = "market";
  let filterQuery = "";
  let filterPresentation = "visible-enabled";
  let economy = { balance: null, subscriptions: [], plans: [], ownPlan: null, endedAt: null };
  let wallet = null, panelHistory = [], walletRequest = 0, balanceRevision = 0, balanceUnknown = false, walletLoading = false, economyError = "", syncTimer = null, syncing = null, mounted = false, started = false;
  let walletPromise = null, monetaryPending = 0;
  let dismissed = [];
  let subscriptionTagger = "", toast = null;
   let noticeTimer = null; const SUCCESS_NOTICE_MS = 3000;
  const actionTimers = new Map(), actionRestores = new Map();
  const actionInPanel = () => [...actionTimers.keys()].some(button => panel?.contains(button));
  const account = () => ({ tagger: taggerIdentity, key: managementKey });

  const route = (() => {
    try {
      const url = new URL(location.href);
      const match = /^\/([a-z0-9]+)\/thread\/([1-9][0-9]*)(?:\/[^/?#]+)?\/?$/u.exec(url.pathname);
      return url.protocol === "https:" && url.hostname === "boards.4chan.org" && match
        ? Object.freeze({ board: match[1], thread: match[2], key: `${match[1]}/${match[2]}` })
        : null;
    } catch {
      return null;
    }
  })();

  const cleanTag = value => String(value ?? "").trim().replace(/\s+/gu, " ").slice(0, 80);

  const suggestTags = text => {
    const query = cleanTag(text).toLowerCase();
    if (initializationError) return [];
    if (!query) {
      const recent = [], seen = new Set();
      for (let index = records.length - 1; index >= 0 && recent.length < 5; index--) {
        const record = records[index], tag = cleanTag(record.tag), key = tag.toLowerCase();
        if (!["created", "acquired"].includes(record.origin) || !tag || seen.has(key)) continue;
        recent.push(tag); seen.add(key);
      }
      return recent;
    }
    const unique = new Map();
    for (const record of records) {
      if (!["created", "acquired"].includes(record.origin)) continue;
      const tag = cleanTag(record.tag), key = tag.toLowerCase();
      if (key.includes(query) && !unique.has(key)) unique.set(key, tag);
    }
    return [...unique].sort(([a], [b]) => Number(b.startsWith(query)) - Number(a.startsWith(query)) || a.localeCompare(b)).slice(0, 5).map(([, tag]) => tag);
  };

  const solidColor = (value, fallback) => { const text = String(value ?? "").trim(), alpha = /^rgba\([^)]*,\s*([\d.]+)\s*\)$/u.exec(text); return text !== "" && text !== "transparent" && (!alpha || Number(alpha[1]) >= 1) ? text : fallback; };
  const cleanRecord = value => {
    if (!value || typeof value !== "object" || !["created", "acquired"].includes(value.origin)) return null;
    const board = String(value.board ?? ""), thread = String(value.thread ?? ""), post = String(value.post ?? ""), tag = cleanTag(value.tag), id = String(value.id ?? "");
    if (!/^[a-z0-9]+$/u.test(board) || !/^[1-9][0-9]*$/u.test(thread) || !/^[1-9][0-9]*$/u.test(post) || !tag || !/^\S{1,512}$/u.test(id)) return null;
    const tagger = typeof value.tagger === "string" && /^\S.{0,127}$/u.test(value.tagger) ? value.tagger : null;
    return { id, board, thread, post, tag, price: Number(value.price) || 0, acquisitionKind: value.acquisitionKind, origin: value.origin, listed: value.origin === "created" && value.listed === true, visibility: value.visibility === "hidden" ? "hidden" : "revealed", ...(typeof value.listingId === "string" ? { listingId: value.listingId } : {}), ...(tagger ? { tagger } : {}) };
  };
  const snapshot = () => ({ version: 1, taggerIdentity, dismissed, ownCache, ownDirty, balance: balanceUnknown ? null : economy.balance, balanceUnknown, records: records.map(item => ({ ...item })), filters: Object.fromEntries(Object.entries(filters).map(([key, tags]) => [key, [...tags]])) });
  const notify = () => { for (const listener of listeners) listener(); };
  let persist = async () => { await chrome.storage.local.set({ [STORAGE_KEY]: snapshot(), [IDENTITY_KEY]: taggerIdentity }); };

  let dataEpoch = null, dataRevision = 0, initializationError = null, savedOverrides = {}, presentedInitializationError = null, dataContextReady = false, retryingData = null;
  const dataRequest = message => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("storage_unavailable")), 15000);
    try { chrome.runtime.sendMessage({ profile, ...message }, result => { clearTimeout(timer); if (chrome.runtime.lastError || !result?.ok) reject(new Error(result?.reason || "storage_unavailable")); else resolve(result); }); }
    catch { clearTimeout(timer); reject(new Error("storage_unavailable")); }
  });
  const assertData = () => { if (initializationError || !dataEpoch) throw new Error(initializationError || "setup_required"); };
  const openRecovery = event => {
    event.preventDefault(); event.stopPropagation();
    // A host-page anchor cannot navigate to a private extension resource.
    // Open the fixed destination through the worker without exposing it as WAR.
    chrome.runtime.sendMessage({ type: "recovery.open" }, result => { if (chrome.runtime.lastError || !result?.ok) showNotice("Open Identity & backup from the extension menu.", null, "error"); });
  };
  const showInitializationError = () => {
    if (!mounted || !initializationError || presentedInitializationError === initializationError) return;
    // Mount is reconciled after DOM mutations. Replacing this notice on every
    // mount would trigger another mutation and starve the page's event loop.
    presentedInitializationError = initializationError;
    showNotice(errorMessage(initializationError), null, "error");
    const link = document.createElement("a"); link.textContent = "Identity & backup"; link.href = chrome.runtime.getURL("recovery.html"); link.addEventListener("click", openRecovery); toast?.append(link);
  };
  const acceptData = state => {
    if (dataEpoch && state.epoch !== dataEpoch) { initializationError = "identity_changed_reload"; showInitializationError(); return; }
    if (state.revision < dataRevision) return;
    initializationError = null;
    if (presentedInitializationError) { presentedInitializationError = null; dismissNotice(); }
    dataEpoch = state.epoch; dataRevision = state.revision; taggerIdentity = state.identity.tagger; managementKey = state.identity.key;
    records = state.records.map(item => ({ ...item })); filters = Object.fromEntries(Object.entries(state.filters).map(([key, tags]) => [key, [...tags]])); dismissed = [...state.dismissed]; savedOverrides = state.overrides;
    if (route) globalThis.MMNativeHiding?.setOverrides?.(savedOverrides[route.key] ?? {});
    applyFilters(); notify();
  };
  const readData = async () => {
    const message = { type: "user-data.get" };
    
    const result = await dataRequest(message);
    acceptData(result.state);
  };
  const ensureData = async () => {
    await ready;
    if (dataEpoch && !initializationError) return;
    if (!dataContextReady || initializationError === "identity_changed_reload") { assertData(); return; }
    // A transient startup read failure must not disable Add until page reload.
    // The worker still rejects incomplete identities and never replaces them.
    if (!retryingData) retryingData = readData().finally(() => { retryingData = null; });
    await retryingData; assertData();
  };
  const changeData = async change => { await ensureData(); const result = await dataRequest({ type: "user-data.change", epoch: dataEpoch, change }); acceptData(result.state); return result.state; };
  persist = async () => { assertData(); }; // Market caches are disposable; personal data is changed only by the worker.
  globalThis.MMDataStoreClient = Object.freeze({ change: changeData, overrides: key => savedOverrides[key] ?? {} });

  const activeTags = () => route ? new Set(filters[route.key] ?? []) : new Set();
  const currentRecords = () => route ? records.filter(item => item.board === route.board && item.thread === route.thread) : [];
  const displayRecordsForPost = post => {
    const unique = new Map();
    for (const item of currentRecords().filter(record => record.post === post)) {
      const prior = unique.get(item.tag);
      if (!prior || item.origin === "created" && prior.origin !== "created" || item.origin === prior.origin && item.listed && !prior.listed) unique.set(item.tag, item);
    }
    return [...unique.values()];
  };
  const recordId = (origin, post, tag) => `${origin}:${route.board}/${route.thread}/${post}:${encodeURIComponent(tag)}`;

  const applyFilters = () => {
    if (!route) return;
    const active = activeTags();
    const hiddenPosts = new Set(currentRecords().filter(item => active.has(item.tag)).map(item => item.post));
    globalThis.MMNativeHiding?.apply(hiddenPosts);
  };

  const ready = Promise.resolve().then(async () => {
    

    await globalThis.MMNativeHiding?.init(profile, route); dataContextReady = true;
    // Subscribe before reading so creation in another extension page or tab
    // cannot fall between the initial snapshot and subscription.
    chrome.storage.onChanged?.addListener((changes, area) => { if (area === "local" && changes[`mmUserDataV2:${profile}`]?.newValue) acceptData(changes[`mmUserDataV2:${profile}`].newValue); });
    await readData();
    return { canonical: true };

    return chrome.storage.local.get([STORAGE_KEY, IDENTITY_KEY, MANAGEMENT_KEY]);
  }).then(async value => {
     if (value.canonical) return;
    const stored = value[STORAGE_KEY], durableIdentity = value[IDENTITY_KEY];
    managementKey = typeof value[MANAGEMENT_KEY] === "string" && /^[a-f0-9]{64}$/u.test(value[MANAGEMENT_KEY]) ? value[MANAGEMENT_KEY] : crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    taggerIdentity = typeof durableIdentity === "string" && /^tagger_[a-f0-9]{32}$/u.test(durableIdentity) ? durableIdentity : typeof stored?.taggerIdentity === "string" && /^tagger_[a-f0-9]{32}$/u.test(stored.taggerIdentity) ? stored.taggerIdentity : `tagger_${crypto.randomUUID().replaceAll("-", "")}`;
    
    ownCache=stored?.ownCache || {};ownDirty=stored?.ownDirty!==false;
    economy.balance=typeof stored?.balance==='number'?stored.balance:null;balanceUnknown=stored?.balanceUnknown!==false || economy.balance===null;
    dismissed = Array.isArray(stored?.dismissed) ? stored.dismissed.filter(id => typeof id === "string") : [];
    await globalThis.MMNativeHiding?.init(profile, route);
    const seen = new Set();
    records = Array.isArray(stored?.records) ? stored.records.map(cleanRecord).filter(item => item && !seen.has(item.id) && seen.add(item.id)) : [];
    
    filters = stored?.filters && typeof stored.filters === "object" && !Array.isArray(stored.filters)
      ? Object.fromEntries(Object.entries(stored.filters).filter(([key, tags]) => /^[a-z0-9]+\/[1-9][0-9]*$/u.test(key) && Array.isArray(tags)).map(([key, tags]) => [key, [...new Set(tags.map(cleanTag).filter(Boolean))].slice(0, 80)]))
      : {};
    applyFilters();
    await chrome.storage.local.set({ [STORAGE_KEY]: snapshot(), [IDENTITY_KEY]: taggerIdentity, [MANAGEMENT_KEY]: managementKey });
    notify();
  }).catch(error => {
     initializationError = error.message;
    void globalThis.MMErrorTrace?.record("initialization", "storage_unavailable", error, { phase: "storage" });
  });

  

  const create = async (post, tag) => {
    await ready;
    if (!route || !/^[1-9][0-9]*$/u.test(post) || document.getElementById(`p${post}`) === null) throw new Error("post_unavailable");
    const normalized = cleanTag(tag);
    if (!normalized) throw new Error("tag_required");
    const id = recordId("created", post, normalized);

    await changeData({ kind: "add", records: [{ id, board: route.board, thread: route.thread, post, tag: normalized, origin: "created", listed: false }] });
     return records.find(item => item.id === id);

    if (!records.some(item => item.id === id)) records.push({ id, board: route.board, thread: route.thread, post, tag: normalized, origin: "created", listed: false });
    await persist(); applyFilters(); notify();
    
    return records.find(item => item.id === id);
  };
  const remove = async id => {
    await ready;
     await changeData({ kind: "remove", id }); return;
    const removed = records.find(item => item.id === id);
    if (removed?.listingId && removed.origin === "acquired") dismissed.push(removed.listingId);
    records = records.filter(item => item.id !== id);
    if (route && removed && !currentRecords().some(item => item.tag === removed.tag)) filters[route.key] = (filters[route.key] ?? []).filter(tag => tag !== removed.tag);
    await persist(); applyFilters(); notify();
  };
  const requestWorker = message => new Promise(resolve => {
     if (initializationError || !dataEpoch) { resolve({ ok: false, reason: initializationError || "setup_required" }); return; }
    const failed = (reason, error) => { void globalThis.MMErrorTrace?.record(message.managementKey && message.type === "tag-market.retrieve" ? "mine" : message.type?.slice(11), reason, error, { phase: "send" }); resolve({ ok: false, reason }); };
    if (!chrome.runtime?.sendMessage) { failed("server_bridge_unavailable"); return; }
    
    const timer=setTimeout(()=>failed("request_timeout"),POLL_REQUEST_TIMEOUT_MS);
    try {
      chrome.runtime.sendMessage(message, value => {clearTimeout(timer);const error=chrome.runtime.lastError;if(error||!value)failed("server_bridge_unavailable",error);else resolve(value);});
    } catch (error) { clearTimeout(timer); failed("server_bridge_unavailable", error); }
  });
  const retrieve = async (page = marketPage, manual = true) => {
    await ready;
    if (!route || marketLoading) return false;
    if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null;
    marketLoading = true; showPollState("loading", POLL_REQUEST_TIMEOUT_MS); updateMarketControls();
    const requestedRevision = marketQueryRevision;
    let requestTimeout = null;
    const timeout = new Promise(resolve => { requestTimeout = setTimeout(() => resolve({ ok: false, reason: "request_timeout" }), POLL_REQUEST_TIMEOUT_MS); });
    const result = await Promise.race([requestWorker({ type: "tag-market.retrieve", board: route.board, thread: route.thread, post: marketPost, tagger: marketTagger, page, pageSize: 20, account: account(), excludeTaggers: [taggerIdentity] }), timeout]);
    if (requestTimeout !== null) clearTimeout(requestTimeout);
    marketLoading = false;
    if (requestedRevision !== marketQueryRevision) return retrieve(marketPage);
    if (result?.ok !== true) { pollDelayIndex = Math.min(pollDelayIndex + 1, POLL_DELAYS_MS.length - 1); updateMarketControls(); if (marketPoll) schedulePollCycle("retry"); else showPollState("error"); return false; }
    const nextListings = Array.isArray(result.listings) ? result.listings : [], nextPage = Number(result.page) || 1, nextPages = Number(result.pages) || 1;
    const changed = JSON.stringify(nextListings) !== JSON.stringify(externalListings);
    pollDelayIndex = manual || changed ? 0 : Math.min(pollDelayIndex + 1, POLL_DELAYS_MS.length - 1);
    externalListings = nextListings; marketPage = nextPage; marketPages = nextPages; reconcileMarketResults(); updateMarketControls(); if (marketPoll) schedulePollCycle("waiting"); else showPollState("inactive"); return true;
  };
  const retrieveOwn = async (page = ownPage) => {
    await ready;
    if(ownPending){ownLoading=true;renderPollState();return false;}
    if(ownRequest){await ownRequest;return page===ownPage&&!ownDirty?!ownError:retrieveOwn(page);}
    if(!ownDirty&&ownCache[page]){({listings:ownListings,page:ownPage,pages:ownPages}=ownCache[page]);reconcileMarketResults();updateMarketControls();renderPollState();return true;}
    const revision=ownRevision;ownLoading=true;ownError=false;renderPollState();updateMarketControls();
    ownRequest=(async()=>{
      try{
        const result=await requestWorker({type:"tag-market.retrieve",tagger:taggerIdentity,managementKey,page,pageSize:20});
        if(revision!==ownRevision)return false;
        if(!result?.ok)throw new Error('unavailable');
        if(ownDirty)ownCache={};ownDirty=false;ownListings=result.listings||[];ownPage=Number(result.page)||1;ownPages=Number(result.pages)||1;
        ownCache[ownPage]={listings:ownListings,page:ownPage,pages:ownPages,total:result.total??ownListings.length};
        for(const listing of ownListings)for(const item of records)if(item.origin==='created'&&item.board===listing.board&&item.thread===listing.thread&&item.post===listing.post&&item.tag===listing.tag)Object.assign(item,{listed:true,listingId:listing.id,visibility:listing.visibility,price:listing.price,tagger:listing.tagger});
        await persist();notify();return true;
      }catch{ownError=true;return false;}
      finally{ownLoading=false;ownRequest=null;reconcileMarketResults();updateMarketControls();renderPollState();}
    })();return ownRequest;
  };
  const mutateOwn = async (task, created = true) => {
    const known=!ownDirty, revision=++ownRevision;ownPending++;ownDirty=true;ownLoading=true;await persist();renderPollState();
    try{
      const result=await task();if(!result?.ok||!result.listing)throw new Error(result?.reason||'listing_failed');
      if(revision===ownRevision){
        const row={...result.listing,canReveal:result.listing.visibility==='hidden'};
        if(known&&!created){
          for(const cached of Object.values(ownCache))cached.listings=cached.listings.map(item=>item.id===row.id?row:item);
          ownListings=ownCache[ownPage]?.listings||ownListings;ownDirty=false;
        }else if(known&&ownCache[1]){
          const first=ownCache[1],exists=first.listings.some(item=>item.id===row.id);
          const rows=(exists?first.listings.map(item=>item.id===row.id?row:item):[row,...first.listings]).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))||b.id.localeCompare(a.id));
          const total=first.total+(exists?0:1);
          ownCache={1:{listings:rows.slice(0,20),page:1,pages:Math.max(1,Math.ceil(total/20)),total}};ownDirty=false;
          ownListings=ownCache[1].listings;ownPage=1;ownPages=ownCache[1].pages;
        }
        ownError=false;
      }
      return result;
    }finally{ownPending--;ownLoading=ownPending>0;await persist();renderPollState();if(!ownPending&&panelMode==='listings'&&panel)void retrieveOwn();}
  };
  const identity = async () => { if (!taggerIdentity) await retrieve(1); return taggerIdentity; };
  const list = async (id, visibility = "hidden", price = 1) => {
    await ready;
    const item = records.find(record => record.id === id && record.origin === "created");
    if (!item) throw new Error("created_tag_required");
    const result = await mutateOwn(()=>requestWorker({ type: "tag-market.list", board: item.board, thread: item.thread, post: item.post, tag: item.tag, tagger: taggerIdentity, visibility, price, managementKey }));
    if (result?.ok !== true) throw new Error(result?.reason || "listing_failed");
    item.price = result.listing?.price ?? 0; item.listed = true; item.visibility = result.listing?.visibility ?? visibility; item.listingId = result.listing?.id; item.tagger = result.listing?.tagger; taggerIdentity = result.listing?.tagger ?? taggerIdentity;
     await changeData({ kind: "listed", id, price: item.price, visibility: item.visibility, listingId: item.listingId });
    await persist(); notify();
    return { ...item };
  };
  const toggleFilter = async tag => {
    await ready;
    if (!route) return false;
     await changeData({ kind: "filter", scope: route.key, tag: cleanTag(tag) });  return activeTags().has(cleanTag(tag));
    const normalized = cleanTag(tag), active = activeTags();
    if (active.has(normalized)) active.delete(normalized); else active.add(normalized);
    filters[route.key] = [...active];
    
    await persist(); applyFilters(); notify();
    return active.has(normalized);
  };
  const filterSummary = () => {
    const items = [...document.querySelectorAll('[data-mm-component-role="filter-toggle"]')];
    let visibleEnabled = 0, filteredSubdued = 0, hiddenEnabled = 0, hiddenFiltered = 0, inconsistent = 0;
    for (const item of items) {
      const filtered = item.dataset.mmTagFiltered === "true", enabled = item.getAttribute("aria-pressed") === "true", classes = item.className.split(/\s+/u), activeClass = classes.includes("mm-filter-tag-active"), filteredClass = classes.includes("mm-filter-tag-filtered"), style = getComputedStyle(item), box = item.getBoundingClientRect(), rendered = item.isConnected !== false && item.hidden !== true && style.getPropertyValue("display") !== "none" && !["hidden", "collapse"].includes(style.getPropertyValue("visibility")) && style.getPropertyValue("opacity") !== "0" && box.width > 0 && box.height > 0;
      if (!filtered && enabled && activeClass && !filteredClass) rendered ? visibleEnabled += 1 : hiddenEnabled += 1;
      else if (filtered && !enabled && !activeClass && filteredClass) rendered ? filteredSubdued += 1 : hiddenFiltered += 1;
      else inconsistent += 1;
    }
    const posts = [...document.querySelectorAll(".postContainer")], hiddenPosts = posts.filter(item => item.dataset.mmTagFiltered === "true").length;
    return { total: items.length, visibleEnabled, filteredSubdued, hiddenEnabled, hiddenFiltered, rendered: visibleEnabled + filteredSubdued, inconsistent, mode: filterPresentation, posts: { total: posts.length, filtered: hiddenPosts, visible: posts.length - hiddenPosts } };
  };
  const configureFilterVisibility = mode => {
    if (mode !== "visible-enabled") throw new Error("filter_presentation_refused");
    filterPresentation = mode; renderPanel(); return filterSummary();
  };
  const acquiredRecord = listing => records.find(item => item.origin === "acquired" && (item.listingId === listing.id || item.board === listing.board && item.thread === listing.thread && item.post === listing.post && item.tag === listing.tag));
  const acquire = async listingId => {
    await ready;
    let listing = externalListings.find(item => item.id === listingId);
    if (!listing || listing.tagger === taggerIdentity) throw new Error("listing_unavailable");
    const existing = acquiredRecord(listing); if (existing) return existing;
    if (listing.visibility === "hidden") {
      const balanceRead = ++balanceRevision; walletRequest++; monetaryPending++; balanceUnknown = true; walletLoading = true; await persist(); updateEconomyControls();
      const result = await requestWorker({ type: "tag-market.acquire", id: listingId, account: account(), expectedPrice: listing.price });
      monetaryPending--;
      if (result?.ok !== true || !cleanTag(result.listing?.tag)) { void refreshWallet(); throw new Error(result?.reason || "acquisition_failed"); }
      listing = result.listing; if(balanceRead === balanceRevision){economy.balance = result.balance; balanceUnknown = false; walletLoading = false;} updateEconomyControls();
    }
    const tag = cleanTag(listing.tag); if (!tag) throw new Error("tag_unavailable");
    const id = `acquired:${listing.id}`;

    await changeData({ kind: "add", records: [{ id, listingId: listing.id, board: listing.board, thread: listing.thread, post: listing.post, tag, tagger: listing.tagger, origin: "acquired", listed: false }] });
    return records.find(item => item.id === id);

    if (!records.some(item => item.id === id)) records.push({ id, listingId: listing.id, board: listing.board, thread: listing.thread, post: listing.post, tag, tagger: listing.tagger, origin: "acquired", listed: false });
    await persist(); applyFilters(); notify();
    return records.find(item => item.id === id);
  };
  const reveal = async listingId => {
    await ready;
    const result = await mutateOwn(()=>requestWorker({ type: "tag-market.reveal", id: listingId, managementKey }),false);
    if (result?.ok !== true) throw new Error(result?.reason || "reveal_failed");
    for (const item of records) if (item.listingId === listingId) item.visibility = "revealed";
     await changeData({ kind: "reveal", listingId });
    externalListings = externalListings.map(item => item.id === listingId ? result.listing : item);
    ownListings = ownListings.map(item => item.id === listingId ? result.listing : item);
    await persist(); notify(); reconcileMarketResults();
    return result.listing;
  };

  const errorMessage = reason => ({

    setup_required: "Set up or restore your identity in Identity & backup.",
    recovery_required: "Your identity data is incomplete. Open Identity & backup to restore it.",
    identity_changed_reload: "Identity restored. Reload this thread to continue.",
    storage_unavailable: "Could not read or save your local tags. Try Add again, or reload this thread.",
    post_unavailable: "This post is no longer available. Reload the thread and try again.",
    sender_mismatch: "The extension connection changed. Reload this thread and try again.",
    invalid_change: "This tag could not be saved. Try a shorter tag or reload this thread.",
    invalid_backup_data: "Your saved tag data needs recovery. Open Identity & backup.",
    backup_too_large: "Your saved tag data is full. Remove an unused local tag before adding another.",

    insufficient_funds: "Insufficient FREE.",
    price_changed: "The price changed. Update this view and choose again.",
    thread_closed: "This thread has ended. Acquired tags remain yours.",
    unauthorized: "This market identity could not be verified.",
    rate_limited: "Too many requests. Try again in a minute.",
  })[String(reason).toLowerCase()] || "Could not confirm the change. Reconnect and try again.";
  const failEconomy = reason => { economyError = errorMessage(reason); };
  const dismissNotice = () => {
     if (noticeTimer !== null) clearTimeout(noticeTimer); noticeTimer = null;
    toast?.remove(); toast = null;
  };
  const showNotice = (message, destination, tone = "info") => {
    dismissNotice();
    const root = mark(document.createElement("div"), "purchase-notice"); root.className = "mm-purchase-notice extPanel"; root.dataset.tone = tone;
    globalThis.MMNativePopup?.apply(root);
    const content = mark(document.createElement("span"), "purchase-notice-message"); content.setAttribute("role", "status"); content.textContent = message;
    root.append(content);
    if (destination) {
      const link = mark(document.createElement("a"), "purchase-notice-link"); link.href = "#"; link.textContent = destination === "wallet" ? "Open Wallet" : "Open Filters";
      link.addEventListener("click", event => { event.preventDefault(); dismissNotice(); void openPanel(destination); }); root.append(link);
    }
    const close = nativeAction("Dismiss", "purchase-notice-dismiss"); close.addEventListener("click", dismissNotice); root.append(close);
    document.body.append(root); toast = root;

    if (tone === "success") noticeTimer = setTimeout(() => {
      if (toast === root) dismissNotice();
    }, SUCCESS_NOTICE_MS);

  };
  // Direct input feedback from buttons.bradthomasbrown.com, button 6.
  // Shared WebKit-based geometry lives in ios-buttons.css. The only sibling
  // paint is a spinner; the input keeps its label and intrinsic size throughout.
  const runAction = async (button, task, message, destination, keepDisabled = true, settled = () => {}) => {
    if (button.disabled || button.dataset.mmActionState === "pending") return;
    const previousTimer = actionTimers.get(button); if (previousTimer) clearTimeout(previousTimer);
    actionRestores.get(button)?.();
    const label = button.value;
    const frame = mark(document.createElement("span"), "action-frame"); frame.className = "mm-action-frame";
    const spinner = mark(document.createElement("span"), "action-spinner"); spinner.className = "mm-action-spinner"; spinner.setAttribute("aria-hidden", "true");
    button.parentNode.insertBefore(frame, button); frame.append(button, spinner);
    actionTimers.set(button, null); button.disabled = true;
    button.dataset.mmActionState = "pending"; button.setAttribute("aria-busy", "true"); button.setAttribute("aria-label", `${label}: waiting`);
    const restore = () => {
      actionTimers.delete(button); actionRestores.delete(button); delete button.dataset.mmActionState;
      button.removeAttribute("aria-busy"); button.setAttribute("aria-label", label);
      if (frame.parentNode) frame.parentNode.insertBefore(button, frame); frame.remove();
    };
    actionRestores.set(button, restore);
    let success = false;
    try { await task(); success = true; if (message) showNotice(typeof message === "function" ? message() : message, destination, "success"); }
    catch (error) { showNotice(errorMessage(error.message), String(error.message).toLowerCase() === "insufficient_funds" ? "wallet" : null, "error"); }
    finally {
      button.setAttribute("aria-label", label); button.removeAttribute("aria-busy");
      button.disabled = success && keepDisabled; button.dataset.mmActionState = success ? "success" : "error";
      actionTimers.set(button, setTimeout(() => { restore(); settled(success); }, 900));
    }
  };
  const economyRequest = async (kind, input = {}) => {
    await ready;
    const monetary = ["faucet", "subscribe"].includes(kind), canReadBalance = monetaryPending === 0, balanceRead = monetary ? ++balanceRevision : balanceRevision;
    if(monetary){walletRequest++;monetaryPending++;balanceUnknown=true;walletLoading=true;await persist();updateEconomyControls();}
    const result = await requestWorker({ type: `tag-market.${kind}`, account: account(), board: route.board, thread: route.thread, ...input });
    if(monetary)monetaryPending--;
    if (!result?.ok) { if(monetary)void refreshWallet(); throw new Error(result?.reason || "market_unavailable"); }
    if (typeof result.balance === "number" && balanceRead === balanceRevision && !monetaryPending && (monetary || canReadBalance)) { economy.balance = result.balance; balanceUnknown = false; walletLoading = false; }
    await persist();economyError = ""; updateEconomyControls(); return result;
  };
  const syncEconomy = () => {
    if (syncing) return syncing;
    syncing = (async () => {
      try {
        const result = await economyRequest("sync");
        if (!Array.isArray(result.subscriptions) || !Array.isArray(result.acquisitions) || !Array.isArray(result.plans)) throw new Error("invalid_market_response");
        economy = {...result, balance:economy.balance};
        let changed = false;
         const acquired = [];
        for (const listing of result.acquisitions || []) {
          if (dismissed.includes(listing.id) || records.some(item => item.listingId === listing.id)) continue;
          const item = cleanRecord({ ...listing, id: `acquired:${listing.id}`, listingId: listing.id, origin: "acquired", listed: false });
          if (item) { records.push(item); changed = true;  acquired.push(item);  }
        }
        if (changed) {  await changeData({ kind: "add", records: acquired, fromSync: true });  await persist(); applyFilters(); notify(); }
        const covered = new Set(economy.subscriptions.map(item => item.tagger));
        externalListings = externalListings.filter(item => item.board !== route.board || item.thread !== route.thread || !covered.has(item.tagger));
        updateEconomyControls(); reconcileMarketResults(); return true;
      } catch (error) { failEconomy(error.message); return false; }
      finally {
        syncing = null;
        if (syncTimer !== null) clearTimeout(syncTimer); syncTimer = null;
        if (mounted && (economy.subscriptions.some(item => item.active) || economyError)) syncTimer = setTimeout(() => { syncTimer = null; void syncEconomy(); }, 30000);
      }
    })(); return syncing;
  };
  const refreshWallet = () => {
    if(monetaryPending)return Promise.resolve();
    if(walletPromise)return walletPromise;
    if(!balanceUnknown&&economy.balance!==null)return Promise.resolve();
    const revision=++walletRequest,balanceRead=balanceRevision;walletLoading=true;updateEconomyControls();
    walletPromise=(async()=>{
      try{
        const result=await requestWorker({type:"tag-market.wallet",account:account(),board:route.board,thread:route.thread});
        if(revision!==walletRequest||balanceRead!==balanceRevision)return;
        if(!result?.ok||typeof result.balance!=="number")throw new Error('wallet_unavailable');
        wallet=result;economy.balance=result.balance;balanceUnknown=false;await persist();
      }catch{if(revision===walletRequest){balanceUnknown=true;showNotice("Could not confirm your balance. Reconnect or reopen Wallet to retry.",undefined,"error");}}
      finally{walletPromise=null;walletLoading=monetaryPending>0;updateEconomyControls();}
    })();return walletPromise;
  };
  const updateEconomyControls = () => {
    const label = balanceUnknown || economy.balance === null ? walletLoading ? "FREE: checking…" : "FREE: unavailable" : `FREE: ${economy.balance}`;
    // Wallet retains the previous panel, including its labels, while it is detached.
    for (const root of new Set([panel, ...panelHistory.map(item=>item.node)])) {
      for (const balance of root?.querySelectorAll('[data-mm-component-role="market-balance"]') || []) balance.textContent = label;
    }
  };
  const economySummary = () => {
    const wrap = mark(document.createElement("div"), "economy-summary"); wrap.className = "mm-economy-summary";
    const balance = mark(document.createElement(panelMode === "wallet" ? "span" : "a"), "market-balance");
    if (panelMode !== "wallet") { balance.href = "#"; balance.setAttribute("aria-label", "Open Wallet"); balance.addEventListener("click", event => { event.preventDefault(); void openPanel("wallet"); }); }
    wrap.append(balance);
    if (panelMode === "wallet") {
      const faucet = nativeAction("+100 FREE", "market-faucet"); let requestId = null;
      faucet.addEventListener("click", () => runAction(faucet, async () => {
        requestId ||= crypto.randomUUID(); walletRequest++; await economyRequest("faucet", { requestId }); requestId = null;
      }, "100 FREE added.", null, false, () => { if (panelMode === "wallet") renderPanel(); }));
      wrap.append(" ", faucet);
    }
    return wrap;
  };
  const renderSubscriptionRows = scroll => {
    if (actionInPanel()) return;
    const items = [...economy.subscriptions.map(item => ({ ...item, id: item.planId, price: item.pricePaid, subscribed: true })), ...economy.plans];
    const rows = [];
    for (const plan of items.filter(item => !subscriptionTagger || item.tagger === subscriptionTagger)) {
      const row = mark(document.createElement("div"), "subscription-listing"); row.className = "mm-thread-market-listing";
      const description = mark(document.createElement("div"), "market-listing-description"), label = mark(document.createElement("strong"), "market-listing-label"), meta = mark(document.createElement("span"), "market-listing-meta");
      label.textContent = plan.tagger; meta.textContent = `${plan.price} FREE · /${route.board}/${route.thread}${plan.subscribed ? plan.active ? " · Subscribed" : " · Ended" : ""}`;
      description.append(label, meta);
      const buy = nativeAction("Subscribe", "subscription-buy", true); buy.dataset.mmPlanId = plan.id; buy.disabled = Boolean(plan.subscribed);
      buy.addEventListener("click", event => {
        event.preventDefault(); let synced = false; void runAction(buy, async () => {
          await economyRequest("subscribe", { id: plan.id, expectedPrice: plan.price });
          if (syncing) await syncing;
          // Retain a disabled purchased row even if the following refresh is temporarily unavailable.
          economy.plans = economy.plans.filter(item => item.id !== plan.id);
          if (!economy.subscriptions.some(item => item.planId === plan.id)) economy.subscriptions.push({ ...plan, planId: plan.id, pricePaid: plan.price, active: true });
          synced = await syncEconomy();
          void retrieve(1);
        }, () => synced ? "Subscribed. Tags are ready." : "Subscribed. Tags will sync shortly.", "filters", true, () => { if (panelMode === "subscriptions") renderPanel(); });
      });
      row.append(description, buy); rows.push(row);
    }
    if (!rows.length) { const empty = mark(document.createElement("p"), "subscription-empty"); empty.textContent = economy.endedAt !== null ? "Thread ended." : "No subscriptions available."; rows.push(empty); }
    scroll.replaceChildren(...rows);
  };
  const panelBack = role => {
    const back = nativeAction("Back", role); back.dataset.mmActionTone="neutral"; back.disabled=!panelHistory.length;
    back.addEventListener("click",()=>{
      const prior=panelHistory.pop();if(!prior)return;
      panel?.remove();panel=prior.node;panelMode=prior.mode;subscriptionTagger=prior.tagger;
      panel.style.setProperty("top",`${(globalThis.pageYOffset||0)+28}px`);document.body.append(panel);
      if(panelMode==="subscriptions")renderPanel();updateEconomyControls();
      for(const [selector,top] of prior.scrolls){const list=panel.querySelector(selector);if(list)list.scrollTop=top;}
    
    });return back;
  };
  const renderOffer = body => {
    const form=mark(document.createElement("form"),"subscription-offer");form.className="mm-economy-form";
    const summary=mark(document.createElement("p"),"review-summary");summary.textContent=`Subscription listing for /${route.board}/ thread ${route.thread}. Buyers get your existing and future tags in this thread until it ends. Changing the price affects future buyers.`;
    const label=document.createElement("label"),price=mark(document.createElement("input"),"subscription-price");price.type="number";price.min="1";price.max="1000000";price.step="1";price.required=true;price.value=String(economy.ownPlan?.price??10);price.setAttribute("aria-label","Subscription listing price in FREE");label.append("FREE: ",price);
    const save=nativeAction(economy.ownPlan?"Save price":"Create listing","subscription-offer-save",true);save.disabled=economy.endedAt!==null;
    form.addEventListener("submit",event=>{event.preventDefault();void runAction(save,async()=>{await economyRequest("offer",{price:Number(price.value)});await syncEconomy();},"Subscription listing saved.",null,false,()=>{if(panelMode==="subscription-offer")renderPanel();});});
    const actions=document.createElement("div");actions.className="mm-economy-row";actions.append(panelBack("subscription-offer-back"),save);form.append(summary,label,actions);body.replaceChildren(form);
  };
  const renderEconomy = body => {
    if (actionInPanel()) return;
    const summary = economySummary(), scroll = document.createElement("div"); scroll.className = "mm-economy-scroll";
    if (panelMode === "wallet") {
      const back = panelBack("wallet-back");
      const actions = document.createElement("div"); actions.className = "mm-economy-row"; actions.append(back);
      body.replaceChildren(summary, actions); updateEconomyControls(); return;
    } else {
      const searchForm = mark(document.createElement("form"), "subscription-search-form"); searchForm.className = "qrForm";
      const search = mark(document.createElement("input"), "subscription-tagger-search"); search.type = "text"; search.placeholder = "Search tagger ID"; search.setAttribute("aria-label", "Search subscriptions by tagger ID"); search.value = subscriptionTagger;
      const results = mark(document.createElement("div"), "subscription-listings"); results.className = "mm-thread-market-listings";
      const filter = () => { subscriptionTagger = search.value.trim(); renderSubscriptionRows(results); };
      search.addEventListener("input", filter); searchForm.addEventListener("submit", event => { event.preventDefault(); filter(); }); searchForm.append(search);
      scroll.append(searchForm, results); renderSubscriptionRows(results);
    }
    const back = panelBack("subscription-back");
    const create = nativeAction(economy.ownPlan ? "Edit subscription listing" : "Create subscription listing", "subscription-create"); create.dataset.mmActionTone="neutral";
    create.addEventListener("click",()=>void openPanel("subscription-offer"));
    const update = nativeAction("Update", "economy-update"); update.dataset.mmActionTone="neutral"; update.addEventListener("click", async () => { update.disabled = true; if (!await syncEconomy()) showNotice(economyError); renderPanel(); });
    const updateRow = document.createElement("div"); updateRow.className = "mm-economy-row"; updateRow.append(back, update, create);
    body.replaceChildren(summary, updateRow, scroll); updateEconomyControls();
  };

  const mark = (node, role) => { node.dataset.mmComponentOwner = OWNER; node.dataset.mmComponentRole = role; return node; };
  const nativeAction = (text, role, primary = false) => { const node = mark(document.createElement("input"), role); node.type = primary ? "submit" : "button"; node.dataset.mmIosAction = ""; node.value = text; node.setAttribute("aria-label", text); return node; };
  const toggleButton = (text, role) => { const node = mark(document.createElement("button"), role); node.type = "button"; node.textContent = text; return node; };
  const closeImage = (role, label, listener) => { const node = mark(document.createElement("img"), role), native = document.getElementById("qrClose"); node.className = "extButton mm-tag-popup-close"; node.setAttribute("src", native?.getAttribute("src") || "//s.4cdn.org/image/buttons/burichan/cross@2x.png"); node.setAttribute("alt", native?.getAttribute("alt") || "X"); node.setAttribute("title", label); node.setAttribute("aria-label", label); node.addEventListener("click", listener); return node; };
  const dismissMarketPostPreview = () => {
    marketPostPreview?.remove(); marketPostPreview = null;
    document.removeEventListener("click", dismissMarketPostPreview, true); document.removeEventListener("touchstart", dismissMarketPostPreview, true);
  };
  const showMarketPostPreview = (post, trigger) => {
    const source = document.getElementById(`p${post}`); if (!source) return false;
    dismissMarketPostPreview();
    const preview = mark(source.cloneNode(true), "market-post-preview"); preview.setAttribute("id", "quote-preview"); preview.className = `${source.className} preview reveal-spoilers`.trim();
    for (const owned of preview.querySelectorAll(`[data-mm-component-owner="${OWNER}"]`)) owned.remove();
    preview.style.setProperty("position", "absolute"); preview.style.setProperty("left", "0px"); preview.style.setProperty("top", `${globalThis.pageYOffset ?? 0}px`); preview.style.setProperty("z-index", "2147483647");
    preview.addEventListener("click", event => event.preventDefault()); document.body.append(preview);
    const box = preview.getBoundingClientRect(), anchor = trigger.getBoundingClientRect(), viewportWidth = Math.max(document.documentElement.clientWidth, globalThis.innerWidth ?? 0), viewportHeight = Math.max(document.documentElement.clientHeight, globalThis.innerHeight ?? 0), pageX = globalThis.pageXOffset ?? 0, pageY = globalThis.pageYOffset ?? 0;
    const left = pageX + Math.max(0, viewportWidth - box.width); let top = anchor.bottom + 4;
    if (top + box.height > viewportHeight) top = anchor.top - box.height - 4;
    top = pageY + Math.max(0, Math.min(top, Math.max(0, viewportHeight - box.height)));
    preview.style.setProperty("left", `${left}px`); preview.style.setProperty("top", `${top}px`); marketPostPreview = preview;
    document.addEventListener("click", dismissMarketPostPreview, true); document.addEventListener("touchstart", dismissMarketPostPreview, true); return true;
  };
  const renderPollState = () => {
    const status = panel?.querySelector('[data-mm-component-role="market-update-status"]');
    if (!status) return;
    const own = panelMode === "listings", state = own ? ownLoading ? "loading" : ownError ? "error" : "inactive" : pollState;
    const seconds = Math.max(0, Math.ceil((pollDueAt - Date.now()) / 1000));
    status.dataset.mmPollState = state;
    const value = state === "loading" ? own ? "Checking listings…" : "Updating..." : state === "waiting" || state === "retry" ? String(seconds) : state === "error" ? own ? "Listings unavailable. Reconnect or reopen to retry." : "Error" : "";
    if (status.textContent !== value) status.textContent = value;
    status.className = `${globalThis.matchMedia?.("(max-width: 480px)").matches ? "mobile-tu-status" : ""}${state === "error" || state === "retry" ? " tu-error" : ""}`.trim();
    const label = state === "loading" ? "Updating tags" : state === "retry" ? `Update failed; retry in ${seconds} seconds` : state === "waiting" ? `Next update in ${seconds} seconds` : state === "error" ? "Update failed; use Update to retry" : "Automatic updates off";
    status.setAttribute("title", label); status.setAttribute("aria-label", label);
  };
  const showPollState = (state, duration = 0) => { pollState = state; pollDueAt = duration > 0 ? Date.now() + duration : 0; renderPollState(); };
  const updateMarketControls = () => {
    if (!panel || panelMode === "filters") return;
    const own = panelMode === "listings", loading = own ? ownLoading : marketLoading, page = own ? ownPage : marketPage, pages = own ? ownPages : marketPages;
    const update = panel.querySelector('[data-mm-component-role="market-retrieve"]'), poll = panel.querySelector('[data-mm-component-role="market-poll"]'), previous = panel.querySelector('[data-mm-component-role="market-previous"]'), next = panel.querySelector('[data-mm-component-role="market-next"]'), pageLabel = panel.querySelector('[data-mm-component-role="market-page"]');
    if (update) update.setAttribute("aria-busy", String(loading));
    if (poll) poll.checked = marketPoll;
    if (previous) previous.disabled = loading || page <= 1;
    if (next) next.disabled = loading || page >= pages;
    if (pageLabel) pageLabel.textContent = `${page} / ${pages}`;
    const back = panel.querySelector('[data-mm-component-role="market-back"]'), postSearch = panel.querySelector('[data-mm-component-role="market-post-search"]'), taggerSearch = panel.querySelector('[data-mm-component-role="market-tagger-search"]');
    if (back) { back.disabled = marketHistory.length === 0; back.hidden = marketHistory.length === 0; }
    if (postSearch && postSearch.dataset.mmQueryRevision !== String(marketQueryRevision)) { postSearch.value = marketPost; postSearch.removeAttribute("aria-invalid"); postSearch.dataset.mmQueryRevision = String(marketQueryRevision); }
    if (taggerSearch && taggerSearch.dataset.mmQueryRevision !== String(marketQueryRevision)) { taggerSearch.value = marketTagger; taggerSearch.removeAttribute("aria-invalid"); taggerSearch.dataset.mmQueryRevision = String(marketQueryRevision); }
  };
  const listingRevision = () => JSON.stringify([panelMode, (panelMode === "listings" ? ownListings : externalListings).map(item => [item.id, item.board, item.thread, item.post, item.tag, item.tagger, item.visibility, item.price, item.canReveal, item.subscriptionAvailable, acquiredRecord(item)?.tag])]);
  const reconcileMarketResults = () => {
    const listings = panel?.querySelector('[data-mm-component-role="market-listings"]');
    if (!listings || actionInPanel()) return false;
    const revision = listingRevision();
    if (listings.dataset.mmMarketRevision === revision) return false;
    const rows = [];
    const own = panelMode === "listings";
    for (const listing of own ? ownListings : externalListings) {
      const row = mark(document.createElement("div"), "market-listing"); row.className = "mm-thread-market-listing";
      const description = mark(document.createElement("div"), "market-listing-description"), label = mark(document.createElement("strong"), "market-listing-label"), acquired = acquiredRecord(listing);
      label.textContent = acquired?.tag ?? listing.tag ?? "Hidden tag";
      const metadata = mark(document.createElement("span"), "market-listing-meta"), postLink = mark(document.createElement("a"), "market-post-link"), permalink = mark(document.createElement("a"), "market-post-permalink");
      const sameThread = listing.board === route.board && listing.thread === route.thread, postHref = sameThread ? `#p${listing.post}` : `https://boards.4chan.org/${listing.board}/thread/${listing.thread}#p${listing.post}`;
      postLink.className = "quotelink"; postLink.setAttribute("href", postHref); postLink.setAttribute("aria-label", `${sameThread ? "Preview" : "Open"} post No.${listing.post}`); postLink.textContent = sameThread ? `>>${listing.post}` : `>>>/${listing.board}/${listing.post}`;
      postLink.addEventListener("click", event => { if (sameThread && document.getElementById(`p${listing.post}`)) { event.preventDefault(); event.stopPropagation(); showMarketPostPreview(listing.post, postLink); } });
      permalink.className = "quoteLink"; permalink.setAttribute("href", postHref); permalink.setAttribute("aria-label", `Jump to post No.${listing.post}`); permalink.textContent = "#";
      permalink.addEventListener("click", event => { if (sameThread) { event.preventDefault(); dismissMarketPostPreview(); location.hash = `#p${listing.post}`; document.getElementById(`p${listing.post}`)?.scrollIntoView(); closePanel(); } });
      const tagger = mark(document.createElement(own ? "code" : "a"), "market-tagger"); tagger.textContent = listing.tagger; if (!own) { tagger.setAttribute("href", "#"); tagger.setAttribute("aria-label", `Search tags by ${listing.tagger}`); tagger.addEventListener("click", event => { event.preventDefault(); void searchTagger(listing.tagger); }); }
      metadata.append(postLink, " ", permalink, " · tagged by ", tagger, listing.visibility === "hidden" ? ` · ${listing.price} FREE` : " · Free"); description.append(label, metadata);
      if (own) { const visibility = mark(document.createElement("span"), "market-visibility"); visibility.textContent = listing.visibility === "hidden" ? "Hidden" : "Revealed"; description.append(visibility); }
      if (!own) {
        const subscription = mark(document.createElement(listing.subscriptionAvailable ? "a" : "span"), "market-subscription-link");
        subscription.textContent = listing.subscriptionAvailable ? "Thread subscription →" : "No subscription available";
        if (listing.subscriptionAvailable) { subscription.href = "#"; subscription.setAttribute("aria-label", `Thread subscription by ${listing.tagger}`); subscription.addEventListener("click", event => { event.preventDefault(); void openPanel("subscriptions", undefined, listing.tagger); }); }
        description.append(subscription);
      }
      const owned = listing.tagger === taggerIdentity || Boolean(acquired), canReveal = own && listing.canReveal;
      const action = nativeAction(canReveal ? "Reveal" : listing.visibility === "hidden" ? "Buy" : "Use", canReveal ? "market-reveal" : "market-buy", true); action.dataset.mmListingId = listing.id; action.disabled = !canReveal && owned;
      action.addEventListener("click", async event => { event.preventDefault(); if (action.disabled) return; void runAction(action, async () => { if (canReveal) await reveal(listing.id); else { const item = await acquire(listing.id); label.textContent = item.tag; } }, canReveal ? "Tag revealed." : listing.visibility === "hidden" ? "Tag purchased." : "Tag added.", canReveal ? null : "filters", true, reconcileMarketResults); });
      row.append(description); if (!own || canReveal) row.append(action); rows.push(row);

    }
    listings.dataset.mmMarketRevision = revision; listings.replaceChildren(...rows); return true;
  };
  const renderFilters = body => {
    const filterSearch = mark(document.createElement("input"), "filter-search"); filterSearch.type = "search"; filterSearch.value = filterQuery; filterSearch.placeholder = "Search tags"; filterSearch.setAttribute("aria-label", "Search thread tags");
    const filterList = mark(document.createElement("div"), "filter-list"); filterList.className = "mm-tags-body mm-thread-filter-list";
    const tags = [...new Set(currentRecords().map(item => item.tag))].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
    if (tags.length === 0) { const empty = mark(document.createElement("p"), "filter-empty"); empty.textContent = "No created or acquired tags yet."; filterList.append(empty); }
    for (const tag of tags) {
      const filtered = activeTags().has(tag), enabled = filterPresentation === "visible-enabled" ? !filtered : filtered, item = toggleButton(tag, "filter-toggle");
      item.className = `mm-tag-chip mm-filter-tag ${filtered ? "mm-filter-tag-filtered" : "mm-filter-tag-active"}`; item.dataset.mmTagText = tag; item.dataset.mmTagFiltered = String(filtered); item.setAttribute("aria-pressed", String(enabled)); item.setAttribute("aria-label", `${tag}: posts ${filtered ? "hidden" : "visible"}`); item.hidden = filterQuery !== "" && !tag.toLocaleLowerCase().includes(filterQuery); item.addEventListener("click", async () => { await toggleFilter(tag); renderPanel(); }); filterList.append(item);
    }
    filterSearch.addEventListener("input", () => { filterQuery = cleanTag(filterSearch.value).toLocaleLowerCase(); for (const item of filterList.children) item.hidden = filterQuery !== "" && !item.dataset.mmTagText.toLocaleLowerCase().includes(filterQuery); }); body.replaceChildren(filterSearch, filterList);
  };
  const cancelSearch = () => { if (searchTimer !== null) clearTimeout(searchTimer); searchTimer = null; };
  const querySnapshot = () => ({ post: marketPost, tagger: marketTagger, page: marketPage, pages: marketPages, listings: externalListings });
  const selectQuery = async (query, remember = true) => {
    cancelSearch();
    if (remember) { marketHistory.push(querySnapshot()); if (marketHistory.length > 20) marketHistory.shift(); }
    marketPost = query.post ?? ""; marketTagger = query.tagger ?? ""; searchField = marketTagger ? "tagger" : "post"; marketPage = query.page ?? 1; marketPages = query.pages ?? 1; externalListings = query.listings ?? []; marketQueryRevision += 1;
    dismissMarketPostPreview(); reconcileMarketResults(); updateMarketControls();
    return retrieve(marketPage);
  };
  const searchTagger = async value => {
    const tagger = String(value ?? "").trim();
    if (!/^[A-Za-z0-9_.:@-]{1,128}$/u.test(tagger)) return false;
    searchSessionSaved = false;
    return selectQuery({ tagger });
  };
  const commitSearch = async () => {
    cancelSearch();
    const input = panel?.querySelector(`[data-mm-component-role="market-${searchField}-search"]`);
    if (!input || panelMode !== "market") return false;
    const value = input.value.trim(), valid = value === "" || (searchField === "post" ? /^[1-9][0-9]*$/u : /^[A-Za-z0-9_.:@-]{1,128}$/u).test(value);
    input.setAttribute("aria-invalid", String(!valid));
    if (!valid) { if (marketPoll && !marketLoading) schedulePollCycle(); return false; }
    const query = searchField === "post" ? { post: value, tagger: "" } : { post: "", tagger: value };
    if (query.post === marketPost && query.tagger === marketTagger) return retrieve(marketPage);
    const remember = !searchSessionSaved; searchSessionSaved = true;
    return selectQuery(query, remember);
  };
  const createMarketView = body => {
    searchField = marketTagger ? "tagger" : "post";
    const own = panelMode === "listings", mobile = globalThis.matchMedia?.("(max-width: 480px)").matches;
    const children = [economySummary()];
    if (!own) {
      const searchForm = mark(document.createElement("form"), "market-search-form"); searchForm.className = "qrForm";
      const fields = [];
      for (const field of ["post", "tagger"]) {
        const input = mark(document.createElement("input"), `market-${field}-search`); input.type = "text"; input.value = field === "post" ? marketPost : marketTagger; input.placeholder = field === "post" ? "Post number" : "Tagger identity";
        input.setAttribute("aria-label", field === "post" ? "Search tags by post number" : "Search tags by tagger identity");
        if (field === "post") { input.inputMode = "numeric"; input.pattern = "[1-9][0-9]*"; } else input.maxLength = 128;
        let composing = false;
        input.addEventListener("focus", () => { searchSessionSaved = false; });
        const changed = () => {
          cancelSearch(); if (searchField !== field) searchSessionSaved = false; searchField = field;
          for (const other of fields) if (other !== input) { other.value = ""; other.removeAttribute("aria-invalid"); }
          if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null;
          if (!composing) searchTimer = setTimeout(() => { searchTimer = null; void commitSearch(); }, SEARCH_DELAY_MS);
        };
        input.addEventListener("compositionstart", () => { composing = true; cancelSearch(); });
        input.addEventListener("compositionend", () => { composing = false; changed(); });
        input.addEventListener("input", changed);
        input.addEventListener("keydown", event => { if (event.key === "Enter" && !composing && !event.isComposing) { event.preventDefault(); searchField = field; void commitSearch(); } });
        fields.push(input); searchForm.append(input);
      }
      searchForm.addEventListener("submit", event => { event.preventDefault(); void commitSearch(); }); children.push(searchForm);
    }
    const marketTools = mark(document.createElement("div"), "market-tools"); marketTools.className = "mm-market-tools";
    if (!own) {
      const back = nativeAction("Back", "market-back"); back.dataset.mmActionTone = "neutral"; back.addEventListener("click", () => { const prior = marketHistory.pop(); if (prior) { searchSessionSaved = false; void selectQuery(prior, false); } }); marketTools.append(back);
    }
    if(!own){
    const update = mark(document.createElement(mobile ? "label" : "a"), "market-retrieve"); update.textContent = "Update"; update.setAttribute("aria-label", own ? "Update my listings" : "Search or update tags");
    if (mobile) { update.setAttribute("role", "button"); update.setAttribute("tabindex", "0"); } else update.setAttribute("href", "#");
    const updateNow = event => { event.preventDefault(); if (own) void retrieveOwn(); else void commitSearch(); };
    if (mobile) update.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") updateNow(event); });
    const updateWrap = mark(document.createElement("span"), "market-update-control"); if (mobile) { updateWrap.className = "mobileib button"; updateWrap.append(update); } else updateWrap.append("[", update, "]"); updateWrap.addEventListener("click", updateNow); marketTools.append(updateWrap);
    }
    if (!own) {
      const autoWrap = mark(document.createElement("span"), "market-auto-control"), label = mark(document.createElement("label"), "market-poll-label"), poll = mark(document.createElement("input"), "market-poll"); poll.type = "checkbox"; poll.checked = marketPoll; poll.setAttribute("title", "Fetch new tags automatically"); poll.setAttribute("aria-label", "Fetch new tags automatically");
      poll.addEventListener("change", () => { marketPoll = poll.checked === true; if (marketPoll) { pollDelayIndex = 0; if (!marketLoading) schedulePollCycle(); } else { if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null; if (!marketLoading) showPollState("inactive"); } });
      label.append(poll, "Auto"); if (mobile) { autoWrap.className = "mobileib button"; autoWrap.append(label); } else autoWrap.append("[", label, "]"); marketTools.append(autoWrap);
    }
    const status = mark(document.createElement(mobile ? "div" : "span"), "market-update-status"), statusWrap = mark(document.createElement("div"), "market-update-status-container"); statusWrap.append(status); marketTools.append(statusWrap); children.push(marketTools);
    const listings = mark(document.createElement("div"), "market-listings"); listings.className = "mm-thread-market-listings";
    const pagination = mark(document.createElement("nav"), "market-pagination"); pagination.className = "mm-market-pagination"; pagination.setAttribute("aria-label", "Tag market pages"); const previous = nativeAction("Prev", "market-previous"), pageLabel = mark(document.createElement("span"), "market-page"), next = nativeAction("Next", "market-next"); previous.addEventListener("click", () => { if (own) void retrieveOwn(ownPage - 1); else { cancelSearch(); void retrieve(marketPage - 1); } }); next.addEventListener("click", () => { if (own) void retrieveOwn(ownPage + 1); else { cancelSearch(); void retrieve(marketPage + 1); } }); pagination.append(previous, pageLabel, next);
    body.replaceChildren(...children, listings, pagination); reconcileMarketResults(); updateMarketControls(); renderPollState(); updateEconomyControls();
  };
  const renderPanel = () => {
    if (!panel || !route) return;
    const body = panel.querySelector('[data-mm-component-role="market-body"]');
    if (!body) return;
    if (panelMode === "filters") { renderFilters(body); return; }
    if(panelMode === "subscription-offer"){renderOffer(body);return;}
    if (["wallet", "subscriptions"].includes(panelMode)) { renderEconomy(body); return; }
    if (!body.querySelector('[data-mm-component-role="market-tools"]')) createMarketView(body);
    else { reconcileMarketResults(); updateMarketControls(); updateEconomyControls(); }
  };
  const schedulePollCycle = (state = "waiting") => {
    if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null;
    if (!marketPoll) { showPollState("inactive"); return; }
    const delay = POLL_DELAYS_MS[Math.max(document.hidden ? 4 : 0, pollDelayIndex)];
    showPollState(state === "retry" ? "retry" : "waiting", delay);
    const pulse = () => {
      pollTimer = null; if (!marketPoll) return;
      if (Date.now() >= pollDueAt) { void retrieve(marketPage, false); return; }
      renderPollState(); pollTimer = setTimeout(pulse, Math.min(1000, Math.max(1, pollDueAt - Date.now())));
    };
    pollTimer = setTimeout(pulse, Math.min(1000, delay));
  };
  const onVisibilityChange = () => { if (!document.hidden && panel) {if(balanceUnknown)void refreshWallet();if(panelMode==="listings"&&ownDirty)void retrieveOwn();} if (marketPoll && !marketLoading && searchTimer === null) { pollDelayIndex = 0; schedulePollCycle(); } };
  const closePanel = () => {
    cancelSearch(); panelHistory=[]; panel?.remove(); panel = null;
    if (marketPoll && !marketLoading && pollTimer === null) schedulePollCycle();
  };
  const openPanel = async (mode = "market", post, tagger = "", observe = true) => {
    await ready; closeNavigationMenu();
    const push=panel && mode!==panelMode && (mode==="wallet" || mode==="subscriptions"&&panelMode==="market" || mode==="subscription-offer"&&panelMode==="subscriptions");
    const history=push?[...panelHistory,{node:panel,mode:panelMode,tagger:subscriptionTagger,scrolls:['market-listings','subscription-listings'].map(role=>[`[data-mm-component-role="${role}"]`,panel.querySelector(`[data-mm-component-role="${role}"]`)?.scrollTop||0])}]:[];
    closePanel();panelHistory=history;
    if (!route) return;
    if (mode === "subscriptions") subscriptionTagger = tagger;
    panelMode = ["filters", "listings", "wallet", "subscriptions", "subscription-offer"].includes(mode) ? mode : "market"; if (panelMode === "filters") filterQuery = "";
    
    const root = mark(document.createElement("section"), "market-panel"); root.className = "mm-tag-popup mm-thread-market extPanel reply qrWindow"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", panelMode === "subscription-offer" ? "Create subscription listing" : ["wallet", "subscriptions"].includes(panelMode) ? (panelMode === "wallet" ? "Wallet" : "Thread subscriptions") : panelMode === "filters" ? "Thread tag filters" : panelMode === "listings" ? "My listed tags" : "Tag market"); root.style.setProperty("top", `${(globalThis.pageYOffset ?? 0) + 28}px`); globalThis.MMNativePopup?.apply(root);
    const nativePost = document.querySelector(".post.reply") || document.querySelector(".post"), nativeHeader = nativePost?.querySelector(".postInfoM") ?? nativePost?.querySelector(".postInfo"); if (nativePost) { const style = getComputedStyle(nativePost), headerStyle = nativeHeader ? getComputedStyle(nativeHeader) : style; root.style.setProperty("--mm-post-background", solidColor(style.backgroundColor, "rgb(214, 218, 240)")); root.style.setProperty("--mm-post-header-background", solidColor(headerStyle.backgroundColor, globalThis.MMNativePopup?.background(nativeHeader || nativePost) || "rgb(201, 205, 232)")); root.style.setProperty("--mm-tags-divider", solidColor(style.borderColor, "rgb(183, 197, 217)")); }
    const header = mark(document.createElement("header"), "market-header"); header.className = "mm-tag-popup-header qrHeader drag postblock";
    const title = mark(document.createElement("span"), "market-title"); title.textContent = panelMode === "subscription-offer" ? "Subscription listing" : panelMode === "wallet" ? "Wallet" : panelMode === "subscriptions" ? "Thread subscriptions" : panelMode === "filters" ? "Filters" : panelMode === "listings" ? "My listings" : "Tag Market";
    const close = closeImage("market-close", panelMode === "filters" ? "Close filters" : panelMode === "listings" ? "Close my listings" : "Close tag market", closePanel);  header.append(title, close);
    const body = mark(document.createElement("div"), "market-body"); body.className = "mm-tag-popup-body"; root.append(header, body); document.body.append(root); panel = root; if (post !== undefined) { marketHistory.length = 0; marketPost = String(post); marketTagger = ""; searchField = "post"; searchSessionSaved = false; marketQueryRevision += 1; marketPage = 1; marketPages = 1; externalListings = []; } renderPanel(); if (panelMode === "wallet") void refreshWallet(); else if (panelMode === "subscriptions") void syncEconomy().then(renderPanel); else if (panelMode === "listings") void retrieveOwn(); else if (panelMode === "market" && (post !== undefined || !marketPoll)) void retrieve(marketPage);
  };
  const closeNavigationMenu = () => {
    navigationMenu?.remove(); navigationMenu = null; navigationTrigger?.setAttribute("aria-expanded", "false"); navigationTrigger = null;
    document.removeEventListener("click", dismissNavigationMenu, true); document.removeEventListener("touchstart", dismissNavigationMenu, true); document.removeEventListener("keydown", navigationKeydown, true);
  };
  const dismissNavigationMenu = event => { if (!navigationMenu?.contains(event.target) && event.target !== navigationTrigger) closeNavigationMenu(); };
  const navigationKeydown = event => { if (event.key === "Escape") { const trigger = navigationTrigger; closeNavigationMenu(); trigger?.focus(); } };
  const toggleNavigationMenu = trigger => {
    if (navigationMenu) { closeNavigationMenu(); return; }
    const menu = mark(document.createElement("div"), "navigation-menu"), list = mark(document.createElement("ul"), "navigation-menu-list"); menu.className = "dd-menu"; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Mercenary Moderators");
    for (const [label, mode] of [["Market", "market"], ["Filters", "filters"], ["My listings", "listings"], ["Subscriptions", "subscriptions"], ["Wallet", "wallet"]]) {
      const item = mark(document.createElement("li"), `navigation-${mode}`); item.textContent = label; item.setAttribute("role", "menuitem"); item.setAttribute("tabindex", "0");
      const activate = event => { event.preventDefault(); event.stopPropagation(); void openPanel(mode); };
      item.addEventListener("click", activate); item.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") activate(event); }); list.append(item);
    }

    const recovery = mark(document.createElement("li"), "navigation-recovery"), recoveryLink = document.createElement("a");
    recoveryLink.textContent = "Identity & backup"; recoveryLink.href = chrome.runtime.getURL("recovery.html"); recoveryLink.addEventListener("click", openRecovery); recovery.append(recoveryLink); list.append(recovery);

    menu.append(list); menu.style.setProperty("z-index", "2147483647"); document.body.append(menu);
    const box = trigger.getBoundingClientRect(), width = globalThis.innerWidth || document.documentElement.clientWidth || 320;
    menu.style.setProperty("left", `${(globalThis.pageXOffset ?? 0) + Math.max(0, Math.min(box.left, width - menu.getBoundingClientRect().width))}px`); menu.style.setProperty("top", `${(globalThis.pageYOffset ?? 0) + box.bottom}px`);
    navigationMenu = menu; navigationTrigger = trigger; trigger.setAttribute("aria-expanded", "true");
    document.addEventListener("click", dismissNavigationMenu, true); document.addEventListener("touchstart", dismissNavigationMenu, true); document.addEventListener("keydown", navigationKeydown, true);
  };
  const navigationControl = role => {
    const item = mark(document.createElement("a"), role); item.setAttribute("href", "#"); item.textContent = "MM"; item.setAttribute("aria-label", "Mercenary Moderators menu"); item.setAttribute("aria-haspopup", "menu"); item.setAttribute("aria-expanded", "false"); item.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); toggleNavigationMenu(item); }); return item;
  };
  const mount = () => {
    if (!route) return;
    mounted = true; globalThis.MMNativeHiding?.mount();
    if (!started) { started = true; void ready.then(async () => {
      if (!mounted) return; await syncEconomy();
      
    }); }
    controls = [];
    const navigation = document.querySelector("#boardNavMobile .pageJump"), settings = document.getElementById("settingsWindowLinkMobile");
    if (navigation && settings?.parentElement === navigation) {
      let item = document.querySelector('[data-mm-component-role="mobile-nav-control"]');
      if (!item) { item = navigationControl("mobile-nav-control"); navigation.insertBefore(item, settings); }
      controls.push(item);
    }
    const desktop = document.getElementById("navtopright");
    if (desktop) {
      let wrapper = document.querySelector('[data-mm-component-role="desktop-nav-wrapper"]');
      if (!wrapper) { wrapper = mark(document.createElement("span"), "desktop-nav-wrapper"); wrapper.append("[", navigationControl("desktop-nav-control"), "] "); desktop.insertBefore(wrapper, desktop.firstChild); }
      controls.push(wrapper);
    }
    document.addEventListener("visibilitychange", onVisibilityChange); globalThis.addEventListener?.("online", onVisibilityChange); applyFilters();

    void ready.then(showInitializationError);

  };
  const cleanup = () => {
     presentedInitializationError = null;
    dismissNotice(); for (const timer of actionTimers.values()) if (timer !== null) clearTimeout(timer); for (const restore of [...actionRestores.values()]) restore(); actionTimers.clear();
    mounted = false; started = false; if (syncTimer !== null) clearTimeout(syncTimer); syncTimer = null; globalThis.MMNativeHiding?.cleanup();
    closePanel(); closeNavigationMenu(); document.removeEventListener("visibilitychange", onVisibilityChange); globalThis.removeEventListener?.("online", onVisibilityChange); dismissMarketPostPreview(); if (pollTimer !== null) clearTimeout(pollTimer); pollTimer = null; marketPoll = false; pollState = "inactive"; pollDueAt = 0; for (const item of controls) item.remove(); controls = [];
    for (const post of document.querySelectorAll(".post")) { const match = /^p([1-9][0-9]*)$/u.exec(post.id ?? ""); if (match) delete (document.getElementById(`pc${match[1]}`) ?? post).dataset.mmTagFiltered; }
  };

  globalThis.MMTagMarket = Object.freeze({  addErrorMessage: errorMessage, suggestTags,  route, ready, create, remove, list, reveal, acquire, retrieve, sync: syncEconomy, identity, runAction, taggerIdentity: () => taggerIdentity, toggleFilter, activeTags, filterSummary, configureFilterVisibility, recordsForPost: post => displayRecordsForPost(post).map(item => ({ ...item })), subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); }, open: openPanel, close: closePanel, mount, cleanup });
})();
