(() => {
  "use strict";
  if (globalThis.MMFiniteComponents) return;

  const OWNER = "post-tags-v1", sections = new Map();
  const market = globalThis.MMTagMarket;
  let popup = null, openMenu = null, unsubscribe = null;
  const ownedSelector = `[data-mm-component-owner="${OWNER}"]`;
  const parseColor = value => { const match = String(value || "").match(/^rgba?\(\s*(\d+)\D+(\d+)\D+(\d+)(?:\D+([\d.]+))?\s*\)$/u); return match && Number(match[4] ?? 1) >= 1 ? [Number(match[1]), Number(match[2]), Number(match[3])] : null; };
  const mixed = (first, second) => { const a = parseColor(first), b = parseColor(second); if (!a) return second; if (!b) return first; return `rgb(${a.map((value, index) => Math.round((value + b[index]) / 2)).join(", ")})`; };
  const visibleBorder = (style, edge) => { const width = Number.parseFloat(style?.[`border${edge}Width`] ?? "0"), color = style?.[`border${edge}Color`] ?? ""; return Number.isFinite(width) && width > 0 && parseColor(color) ? color : null; };
  const mark = (node, role) => { node.dataset.mmComponentOwner = OWNER; node.dataset.mmComponentRole = role; return node; };
  const button = (label, role) => { const node = mark(document.createElement("button"), role); node.type = "button"; node.textContent = label; return node; };
  const closeImage = (role, label, listener) => { const node = mark(document.createElement("img"), role), native = document.getElementById("qrClose"); node.className = "extButton mm-tag-popup-close"; node.setAttribute("src", native?.getAttribute("src") || "//s.4cdn.org/image/buttons/burichan/cross@2x.png"); node.setAttribute("alt", native?.getAttribute("alt") || "X"); node.setAttribute("title", label); node.setAttribute("aria-label", label); node.addEventListener("click", listener); return node; };
  const removeMenu = () => { openMenu?.remove(); openMenu = null; };
  const closePopup = () => { const closing = popup; popup = null; closing?.remove();  closing?.mmSuggestionsCleanup?.(); closing?.mmOnClose?.();  };
  const postIdFromMenu = item => { const root = item.closest("#post-menu"), identified = root?.querySelector("[data-id]"); return identified?.dataset?.id && /^\d+$/u.test(identified.dataset.id) ? identified.dataset.id : null; };
  const sortTags = body => { for (const item of [...body.children].sort((a, b) => (a.dataset.mmTagText || "").localeCompare(b.dataset.mmTagText || "", undefined, { sensitivity: "base" }))) body.append(item); };
  const appendJsonSyntax = (root, value) => { const text = JSON.stringify(value, null, 2), append = (className, content) => { if (!content) return; const span = document.createElement("span"); span.className = className; span.textContent = content; root.append(span); }; for (let index = 0; index < text.length;) { const character = text[index]; if (character === "\n") { root.append(document.createElement("br")); index += 1; continue; } if (/\s/u.test(character)) { let end = index + 1; while (end < text.length && text[end] !== "\n" && /\s/u.test(text[end])) end += 1; append("pln", text.slice(index, end)); index = end; continue; } if (character === '"') { append("pun", character); let end = index + 1, escaped = false; while (end < text.length) { const next = text[end]; if (!escaped && next === '"') break; escaped = !escaped && next === "\\"; if (next !== "\\") escaped = false; end += 1; } append("pln", text.slice(index + 1, end)); if (end < text.length) { append("pun", '"'); end += 1; } index = end; continue; } if (character === "-" || /[0-9]/u.test(character)) { let end = index + 1; while (end < text.length && /[0-9.eE+-]/u.test(text[end])) end += 1; append("lit", text.slice(index, end)); index = end; continue; } append("pun", character); index += 1; } };

  const openReviewPopup = async (record , onClose ) => {
    closePopup(); removeMenu();
    const tagger = record.tagger ?? await market.identity() ?? "Activation required";
    const root = mark(document.createElement("div"), "review-popup"); root.className = "mm-tag-popup extPanel reply qrWindow"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Review and list tag"); root.style.setProperty("top", `${(document.defaultView?.pageYOffset ?? globalThis.pageYOffset ?? 0) + 28}px`); globalThis.MMNativePopup?.apply(root);
     root.mmOnClose = onClose;
    const nativePost = document.getElementById(`p${record.post}`), nativeStyle = nativePost ? getComputedStyle(nativePost) : null, nativeHeader = nativePost?.querySelector(".postInfoM") ?? nativePost?.querySelector(".postInfo"), headerStyle = nativeHeader ? getComputedStyle(nativeHeader) : nativeStyle; if (nativeStyle) { root.style.setProperty("--mm-post-background", parseColor(nativeStyle.backgroundColor) ? nativeStyle.backgroundColor : "rgb(214, 218, 240)"); root.style.setProperty("--mm-post-header-background", parseColor(headerStyle?.backgroundColor) ? headerStyle.backgroundColor : "rgb(201, 205, 232)"); root.style.setProperty("--mm-tags-divider", parseColor(nativeStyle.borderColor) ? nativeStyle.borderColor : "rgb(183, 197, 217)"); }
    const header = mark(document.createElement("div"), "popup-header"); header.className = "mm-tag-popup-header qrHeader drag postblock";
    const title = mark(document.createElement("span"), "popup-title"); title.textContent = "List tag";
    const close = closeImage("popup-close", "Close tag review", closePopup); header.append(title, close);
    const editor = mark(document.createElement("div"), "review-body"); editor.className = "mm-tag-popup-body";
    const summaryScroll = mark(document.createElement("div"), "review-json-scroll"); summaryScroll.className = "mm-review-json-scroll";
    const summary = mark(document.createElement("pre"), "review-json"); summary.className = "prettyprint prettyprinted mm-review-json"; summary.setAttribute("aria-label", "Tag listing JSON"); appendJsonSyntax(summary, { board: `/${market.route.board}/`, thread: Number(market.route.thread), post: Number(record.post), tag: record.tag, tagger }); summaryScroll.append(summary);
    const visibilityLabel = mark(document.createElement("label"), "tag-visibility-label"), visibility = mark(document.createElement("input"), "tag-visibility"); visibility.type = "checkbox"; visibility.checked = record.listed && record.visibility !== "hidden"; visibility.disabled = record.listed; visibilityLabel.append(visibility, " Reveal tag");
    const priceLabel = mark(document.createElement("label"), "tag-price-label"), price = mark(document.createElement("input"), "tag-price"); price.type = "number"; price.min = "1"; price.max = "1000000"; price.step = "1"; price.value = String(record.price || 1); price.required = true; price.disabled = record.listed; price.setAttribute("aria-label", "Hidden tag price in FREE"); priceLabel.append("FREE: ", price); priceLabel.hidden = visibility.checked;
    visibility.addEventListener("change", () => { priceLabel.hidden = visibility.checked; });
    const errorText = mark(document.createElement("p"), "tag-list-error"); errorText.setAttribute("role", "status");
    const actions = mark(document.createElement("div"), "popup-actions"); actions.className = "mm-tag-popup-actions";
    const list = mark(document.createElement("input"), "tag-list"); list.type = "submit"; list.dataset.mmIosAction = ""; list.value = record.listed ? record.visibility === "hidden" ? "Reveal" : "Listed" : "List"; list.disabled = record.listed && record.visibility !== "hidden";
    list.addEventListener("click", event => { event.preventDefault(); void market.runAction(list, async () => {
      if (record.listed) await market.reveal(record.listingId); else await market.list(record.id, visibility.checked ? "revealed" : "hidden", Number(price.value));
    }, record.listed ? "Tag revealed." : "Tag listed successfully.", null, true, success => { if(success&&popup===root)closePopup(); }); }); actions.append(list); const pricing = mark(document.createElement("div"), "tag-pricing"); pricing.className = "mm-tag-pricing"; pricing.append(visibilityLabel, priceLabel); editor.append(summaryScroll, pricing, actions, errorText); root.append(header, editor); document.body.append(root); popup = root;
  };

  const addChip = (body, record) => {
    const chip = mark(document.createElement("span"), "tag"); chip.className = "mm-tag-chip"; chip.dataset.mmTagId = record.id; chip.dataset.mmTagText = record.tag; chip.dataset.mmTagListed = String(record.listed); chip.dataset.mmTagVisibility = record.visibility ?? "revealed";
    const options = mark(document.createElement("a"), "tag-options"); options.className = "postMenuBtn mm-tag-options"; options.textContent = globalThis.matchMedia?.("(max-width: 480px)").matches ? "..." : "▶"; options.setAttribute("href", "#"); options.setAttribute("aria-label", `Options for tag ${record.tag}`);
    const label = mark(document.createElement("span"), "tag-text"); label.className = "mm-tag-text"; label.textContent = record.tag;
    options.addEventListener("click", event => {
      event.preventDefault(); event.stopPropagation();
      const was = openMenu?.dataset.mmTagId === chip.dataset.mmTagId; removeMenu(); if (was) return;
      const menu = mark(document.createElement("div"), "tag-menu"); menu.className = "dd-menu mm-tag-menu"; menu.dataset.mmTagId = chip.dataset.mmTagId;
      const list = mark(document.createElement("ul"), "tag-menu-list");
      if (record.origin === "created") { const review = mark(document.createElement("li"), "review-tag"); review.textContent = record.listed ? "Review listing" : "Review and list"; review.setAttribute("role", "menuitem"); review.addEventListener("click", async click => { click.preventDefault(); click.stopPropagation(); await openReviewPopup(record); }); list.append(review); }
      const remove = mark(document.createElement("li"), "delete-tag"); remove.textContent = "Delete tag"; remove.setAttribute("role", "menuitem"); remove.addEventListener("click", async click => { click.preventDefault(); click.stopPropagation(); await market.remove(record.id); removeMenu(); }); list.append(remove);
      menu.append(list); document.body.append(menu); openMenu = menu;
      const anchor=options.getBoundingClientRect(),box=menu.getBoundingClientRect(),width=document.documentElement.clientWidth,height=globalThis.innerHeight;
      const left=Math.max(0,Math.min(anchor.left,width-box.width));
      const top=anchor.bottom+box.height<=height?anchor.bottom:Math.max(0,anchor.top-box.height);
      menu.style.setProperty('left',`${left+(globalThis.pageXOffset||0)}px`);menu.style.setProperty('top',`${top+(globalThis.pageYOffset||0)}px`);
    });
    chip.append(options, label); body.append(chip); sortTags(body);
  };
  const renderSection = state => {
    const next = market.recordsForPost(state.postId), current = [...state.body.children].map(item => `${item.dataset.mmTagId}:${item.dataset.mmTagListed}:${item.dataset.mmTagVisibility}`), expected = next.map(item => `${item.id}:${item.listed}:${item.visibility ?? "revealed"}`);
    if (current.length === expected.length && current.every((value, index) => value === expected[index])) return;
    state.body.replaceChildren(); for (const record of next) addChip(state.body, record);
  };
  const renderSections = () => { for (const state of sections.values()) if (state.root?.isConnected) renderSection(state); };


  // MM-owned combobox options: keep focus in the editor when a suggestion is tapped.
  const tagSuggestions = (input, editor, actions) => {
    const list = mark(document.createElement("ul"), "tag-suggestions");
    list.id = "mm-tag-suggestions"; list.className = "mm-tag-suggestions"; list.hidden = true;
    list.setAttribute("role", "listbox"); list.setAttribute("aria-label", "Your saved tags");
    input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-controls", list.id); input.setAttribute("aria-expanded", "false"); input.setAttribute("autocomplete", "off");
    editor.insertBefore(list, actions);
    let choices = [], active = -1, composing = false, focused = true, touch = null;
    const hide = () => { choices = []; active = -1; list.replaceChildren(); list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); };
    const choose = tag => {
      if (input.disabled || !tag) return;
      input.value = tag; input.focus({ preventScroll: true }); hide();
    };
    const render = () => {
      if (touch || !focused) return; // Keep visible options alive through mobile focus changes.
      hide(); if (composing || input.disabled) return;
      choices = market.suggestTags(input.value);
      for (const [index, tag] of choices.entries()) {
        const option = mark(document.createElement("li"), "tag-suggestion");
        option.id = `${list.id}-${index}`; option.textContent = tag;
        option.setAttribute("role", "option"); option.setAttribute("aria-selected", "false");
        option.addEventListener("mousedown", event => event.preventDefault());
        option.addEventListener("touchstart", event => {
          if (event.touches.length !== 1) { touch = null; return; }
          const point = event.touches[0];
          touch = { tag, id: point.identifier, x: point.clientX, y: point.clientY, moved: false };
        }, { passive: true });
        option.addEventListener("click", event => { event.preventDefault(); choose(tag); });
        list.append(option);
      }
      list.hidden = choices.length === 0; input.setAttribute("aria-expanded", String(!list.hidden));
    };
    input.addEventListener("input", render);
    input.addEventListener("focus", () => { focused = true; render(); });
    // Blur can precede touchstart/click in a mobile focus transition. The options
    // remain usable until selection, editing, submission, or closing the dialog.
    input.addEventListener("blur", () => { focused = false; });
    input.addEventListener("compositionstart", () => { composing = true; hide(); });
    input.addEventListener("compositionend", () => { composing = false; render(); });
    list.addEventListener("touchmove", event => {
      if (!touch) return;
      const point = [...event.touches].find(point => point.identifier === touch.id);
      if (!point || event.touches.length !== 1 || Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > 10) touch.moved = true;
    }, { passive: true });
    list.addEventListener("touchend", event => {
      if (!touch) return;
      const ended = touch, point = [...event.changedTouches].find(point => point.identifier === ended.id); touch = null;
      if (point && !ended.moved && Math.hypot(point.clientX - ended.x, point.clientY - ended.y) <= 10) {
        // WebKit may blur the editor before click, or omit the synthesized click.
        // Commit on a completed tap; cancelling touchend suppresses a second click.
        event.preventDefault(); choose(ended.tag);
      }
    }, { passive: false });
    list.addEventListener("touchcancel", () => { touch = null; });
    const unsubscribeSuggestions = market.subscribe(render);
    render();
    return { hide, cleanup: unsubscribeSuggestions, key: event => {
      if (composing || event.isComposing || event.keyCode === 229) return true;
      if (event.key === "Escape" && !list.hidden) { event.preventDefault(); hide(); return true; }
      if (["ArrowDown", "ArrowUp"].includes(event.key)) {
        if (list.hidden) render(); if (!choices.length) return false;
        event.preventDefault(); active = event.key === "ArrowDown" ? (active + 1) % choices.length : (active < 0 ? choices.length - 1 : (active + choices.length - 1) % choices.length);
        for (const [index, option] of [...list.children].entries()) option.setAttribute("aria-selected", String(index === active));
        input.setAttribute("aria-activedescendant", list.children[active].id); list.children[active].scrollIntoView({ block: "nearest" }); return true;
      }
      if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(choices[active]); return true; }
      return false;
    } };
  };


  const openAddPopup = body => {
    closePopup(); removeMenu();
    const root = mark(document.createElement("div"), "popup"); root.className = "mm-tag-popup extPanel reply qrWindow"; root.setAttribute("role", "dialog"); root.setAttribute("aria-label", "Add tag"); root.style.setProperty("top", `${(document.defaultView?.pageYOffset ?? globalThis.pageYOffset ?? 0) + 28}px`); globalThis.MMNativePopup?.apply(root);
    const bodyStyle = getComputedStyle(body); root.style.setProperty("--mm-post-background", bodyStyle.backgroundColor); root.style.setProperty("--mm-tags-divider", bodyStyle.borderTopColor || bodyStyle.borderColor);
    const header = mark(document.createElement("div"), "popup-header"); header.className = "mm-tag-popup-header qrHeader drag postblock";
    const title = mark(document.createElement("span"), "popup-title"); title.textContent = "Add tag";
    const close = closeImage("popup-close", "Close tag editor", closePopup); header.append(title, close);
    const editor = mark(document.createElement("div"), "popup-body"); editor.className = "mm-tag-popup-body qrForm";
    const input = mark(document.createElement("input"), "tag-input"); input.type = "text"; input.maxLength = 80; input.placeholder = "Tag text"; input.setAttribute("aria-label", "Tag text");
    const actions = mark(document.createElement("div"), "popup-actions"); actions.className = "mm-tag-popup-actions";
    const add = mark(document.createElement("input"), "tag-add"); add.type = "submit"; add.dataset.mmIosAction = ""; add.value = "Add";
    let submit = async () => { const value = input.value.trim().replace(/\s+/gu, " "); if (!value) return; const section = [...sections.values()].find(item => item.body === body); if (!section) return; await market.create(section.postId, value); closePopup(); };
    add.addEventListener("click", async event => { event.preventDefault(); await submit(); }); input.addEventListener("keydown", async event => {  if (suggestions.key(event)) return;  if (event.key === "Enter") { event.preventDefault(); await submit( true ); } else if (event.key === "Escape") closePopup(); });
    actions.append(add); editor.append(input, actions);

    actions.dataset.mmTagAddActions = "";
    add.dataset.mmActionTone = "neutral";
    const addAndList = mark(document.createElement("input"), "tag-add-list");
    addAndList.type = "submit"; addAndList.dataset.mmIosAction = ""; addAndList.value = "Add & list…";
    actions.append(addAndList);
    const errorText = mark(document.createElement("p"), "tag-add-error"); errorText.setAttribute("role", "status"); errorText.hidden = true;
    editor.insertBefore(errorText, actions);
    const suggestions = tagSuggestions(input, editor, actions); root.mmSuggestionsCleanup = suggestions.cleanup;
    let submitting = false;
    submit = async (shouldList = false) => {
      if (submitting || popup !== root) return;
      const value = input.value.trim().replace(/\s+/gu, " "), section = [...sections.values()].find(item => item.body === body);
      if (!value || !section) return;
      submitting = true; suggestions.hide(); input.disabled = true; add.disabled = true; addAndList.disabled = true; errorText.hidden = true;
      const releaseHold = shouldList ? globalThis.MMNativeHiding.holdPost(section.postId) : () => {};
      root.mmOnClose = releaseHold;
      try {
        const record = await market.create(section.postId, value);
        if (popup !== root) return;
        if (shouldList) {
          // Transfer the hold to the listing dialog, including failure/retry time.
          root.mmOnClose = null;
          await openReviewPopup(record, releaseHold);
        } else closePopup();
      } catch (error) {
        releaseHold();
        if (popup === root) { errorText.textContent = market.addErrorMessage(error?.message); errorText.hidden = false; }
      } finally {
        submitting = false; input.disabled = false; add.disabled = false; addAndList.disabled = false;
      }
    };
    addAndList.addEventListener("click", async event => { event.preventDefault(); await submit(true); });

    root.append(header, editor); document.body.append(root); popup = root; input.focus({ preventScroll: true });
  };

  const restoreReply = placement => { if (!placement?.node || !placement.parent) return; const before = placement.next?.parentElement === placement.parent ? placement.next : null; placement.parent.insertBefore(placement.node, before); };
  const ensureSection = (id, post) => {
    let state = sections.get(id); if (state?.root?.isConnected) return state;
    if (state?.replyPlacement) restoreReply(state.replyPlacement);
    const container = document.getElementById(`pc${id}`) || post.closest(".postContainer") || post.parentElement; if (!container) return null;
    const root = mark(document.createElement("section"), "section"); root.className = "mm-tags-section"; root.dataset.mmPostId = id;
    const header = mark(document.createElement("header"), "header"); header.className = "mm-tags-header postInfo";
    const title = mark(document.createElement("strong"), "title"); title.textContent = "Tags";
    const add = mark(document.createElement("input"), "open-add"); add.type = "button"; add.dataset.mmIosAction = ""; add.value = "Add tag"; add.className = "mm-add-tag";
    const body = mark(document.createElement("div"), "body"); body.className = "mm-tags-body"; header.append(title, add); root.append(header, body);
    const computedPost = getComputedStyle(post), desktop = post.querySelector(".postInfo"), mobile = post.querySelector(".postInfoM"), nativeReplies = post.querySelector(".postLink, .backlink.mobile") || container.querySelector(".postLink, .backlink.mobile"), navigation = document.querySelector(".boardList a, .navLinks a"), computedDesktop = desktop ? getComputedStyle(desktop) : computedPost, computedMobile = mobile ? getComputedStyle(mobile) : computedPost, computedDivider = nativeReplies ? getComputedStyle(nativeReplies) : computedMobile, bodyColor = computedPost.backgroundColor, headerColor = parseColor(computedMobile.backgroundColor) ? computedMobile.backgroundColor : parseColor(computedDesktop.backgroundColor) ? computedDesktop.backgroundColor : computedPost.borderColor, dividerColor = visibleBorder(computedDivider, "Top") || visibleBorder(computedDivider, "Bottom") || visibleBorder(computedMobile, "Bottom") || visibleBorder(computedMobile, "Top") || "rgb(183, 197, 217)", navigationStyle = navigation ? getComputedStyle(navigation) : null, navigationColor = parseColor(navigationStyle?.color) ? navigationStyle.color : "rgb(52, 52, 92)";
    root.style.setProperty("--mm-post-background", bodyColor); root.style.setProperty("--mm-post-header-background", headerColor); root.style.setProperty("--mm-tags-header-background", mixed(headerColor, bodyColor)); root.style.setProperty("--mm-tags-divider", dividerColor); root.style.setProperty("--mm-tags-title-color", navigationColor);
    const width = Math.ceil(post.getBoundingClientRect().width); if (width > 0) root.style.setProperty("width", `${width}px`);
    const replyPlacement = nativeReplies ? { node: nativeReplies, parent: nativeReplies.parentElement, next: nativeReplies.nextSibling } : null; post.insertAdjacentElement("afterend", root); if (nativeReplies) root.insertAdjacentElement("afterend", nativeReplies);
    add.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); openAddPopup(body); }); state = { root, body, visible: true, replyPlacement, postId: id }; sections.set(id, state); renderSection(state); return state;
  };

  const mount = () => { market.mount(); if (unsubscribe === null) { unsubscribe = market.subscribe(renderSections); void market.ready.then(renderSections); } };
  const label = (_spec, context) => { if (_spec?.action === "search-market") return "Search tags on Market"; const item = context?.menuItem, id = item ? postIdFromMenu(item) : null, state = id ? sections.get(id) : null; return state?.root?.isConnected && state.visible ? "Hide post tags" : "Tag Post"; };
  const activate = async (_spec, context) => {
    mount(); await market.ready;
    const item = context?.menuItem; if (!item) return { ok: false, reason: "menu_item_required" };
    const id = postIdFromMenu(item); if (!id) return { ok: false, reason: "post_identity_unavailable" };
    if (_spec?.action === "search-market") { closePopup(); removeMenu(); await market.open("market", id); return { ok: true, postId: id }; }
    const post = document.getElementById(`p${id}`); if (!post) return { ok: false, reason: "post_unavailable" };
    let state = sections.get(id); if (state?.root?.isConnected && state.visible) { state.root.hidden = true; state.visible = false; closePopup(); removeMenu(); return { ok: true, postId: id, visible: false }; }
    state = ensureSection(id, post); if (!state) return { ok: false, reason: "container_unavailable" }; state.root.hidden = false; state.visible = true; renderSection(state); state.root.scrollIntoView({ block: "nearest" }); return { ok: true, postId: id, visible: true };
  };
  const cleanup = () => { closePopup(); removeMenu(); unsubscribe?.(); unsubscribe = null; market.cleanup(); for (const state of sections.values()) if (state.replyPlacement) restoreReply(state.replyPlacement); for (const item of [...document.querySelectorAll(ownedSelector)]) item.remove(); sections.clear(); };
  globalThis.addEventListener?.("resize", removeMenu);
  globalThis.addEventListener?.("scroll", removeMenu);
  document.addEventListener("click", event => { if (openMenu && !openMenu.contains(event.target) && !event.target.closest?.('[data-mm-component-role="tag-options"]')) removeMenu(); });
  globalThis.MMFiniteComponents = Object.freeze({ activate, label, cleanup, mount, kinds: Object.freeze(["post-tags/v1"]) });
})();
