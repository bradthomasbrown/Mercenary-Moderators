# Attribution review in progress

The exact shipped files retain their existing comments and attribution. This document is an inventory for private review, not a completed license audit or a grant of rights.

`extension/ios-buttons.css` identifies WebKit rules used as a reference for explicit Orion/iOS control styling. Its cited revision is `9b0f01ca9e14c8cf7b5485dadeaaeed687e2a851`:

- [html.css, iOS action rules](https://github.com/WebKit/WebKit/blob/9b0f01ca9e14c8cf7b5485dadeaaeed687e2a851/Source/WebCore/css/html.css#L868-L906)
- [RenderThemeIOS.mm, button adjustment](https://github.com/WebKit/WebKit/blob/9b0f01ca9e14c8cf7b5485dadeaaeed687e2a851/Source/WebCore/rendering/ios/RenderThemeIOS.mm#L957-L1003)
- [RenderThemeIOS.mm, corner adjustment](https://github.com/WebKit/WebKit/blob/9b0f01ca9e14c8cf7b5485dadeaaeed687e2a851/Source/WebCore/rendering/ios/RenderThemeIOS.mm#L427-L456)

The local comparison is available at [buttons.bradthomasbrown.com](https://buttons.bradthomasbrown.com/). The stylesheet's reference to an upstream workspace document describes its original location; that full workspace is not included here.

The screenshots depict the extension on an authored thread fixture. Host styling, behavior references and any adapted code need their provenance and applicable notices checked before a public source release. A project license should not be chosen in place of that review.
