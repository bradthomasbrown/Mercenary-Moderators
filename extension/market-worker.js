globalThis.MMMarketRequest = async (message, metadata = {}) => {
      let operation = "message", phase = "runtime", status;
      const started = Date.now();
      const trace = (code, error) => { void globalThis.MMErrorTrace?.record(operation, code, error, { phase, status, durationMs: Date.now() - started, senderId: metadata.senderId }); };
      try {
        const kind = message.type.slice(11);
        operation = kind === "retrieve" && message.managementKey ? "mine" : kind;
        let input;
        if (kind === "retrieve") input = message.managementKey ? { action: "mine", tagger: message.tagger, page: message.page, pageSize: message.pageSize, managementKey: message.managementKey } : { action: "browse", board: message.board, thread: message.thread, post: message.post, tagger: message.tagger, page: message.page, pageSize: message.pageSize, account: message.account };
        else if (kind === "list") input = { board: message.board, thread: message.thread, post: message.post, tag: message.tag, tagger: message.tagger, visibility: message.visibility, price: message.price, managementKey: message.managementKey };
        else if (kind === "reveal") input = { action: "reveal", id: message.id, managementKey: message.managementKey };
        else if (["acquire", "sync", "offer", "subscribe", "wallet", "faucet"].includes(kind)) input = { action: kind, account: message.account, id: message.id, board: message.board, thread: message.thread, price: message.price, expectedPrice: message.expectedPrice, requestId: message.requestId, before: message.before };
        else return { ok: false, reason: "unsupported_message" };
        
        phase = "fetch";
        const response = await fetch("https://mm.bradthomasbrown.com/api/extension/tag-market/listings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(15000) });
        status = response.status; phase = "response";
        const value = await response.json();
        if (!response.ok) { phase = "http"; trace(value.error || "api_error"); }
        return response.ok ? { ok: true, ...(["list", "acquire", "reveal"].includes(kind) ? { listing: value, balance: value.balance } : value) } : ({ ok: false, reason: value.error || "market_unavailable" });
      } catch (error) { trace(phase === "response" ? "invalid_response" : "network_unavailable", error); return { ok: false, reason: "network_unavailable" }; }
    };
