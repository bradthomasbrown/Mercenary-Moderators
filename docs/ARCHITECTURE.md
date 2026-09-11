# User-extension module map

This map describes the files in the shipped user ZIP. The files execute directly in the browser; there is no bundler or dependency install for this snapshot.

| Area | Files | Responsibility |
| --- | --- | --- |
| Entry points | `manifest.json`, `user-worker.js`, `user-popup.html`, `user-popup.js` | Declare permissions, start the worker, and expose the extension menu. |
| Tagging and market UI | `tagging-component.js`, `market-component.js`, `packaged-rules.js`, `persistent-rules.js` | Attach the supplied rules and controls to thread pages. |
| Host integration | `native-popup.js`, `native-hiding.js` | Integrate popups and post hiding with the host page. |
| Market transport | `market-worker.js` | Send market requests through the worker. |
| Local data and recovery | `user-data-worker.js`, `recovery-codec.js`, `recovery.html`, `recovery.js` | Store user data and support encrypted recovery. |
| Diagnostics | `error-trace.js` | Capture bounded local error information. |
| Presentation | `adapter.css`, `ios-buttons.css`, `user-popup.css`, `recovery.css` | Style extension-owned elements. |

The market and recovery backend is an external service and is not included here. Successful local packaging does not prove service availability or Orion compatibility.

The initial release has concentrated UI modules: `market-component.js` is approximately 74 KB, and some functions in other modules occupy very long lines. Those are concrete readability and separation concerns to assess before refactoring. Keep behavior checks and a known working package available while changing structure.
