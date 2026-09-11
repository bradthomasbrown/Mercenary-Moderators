# Third-party licenses and notices

The default project license does not replace the licenses below. Third-party names and trademarks remain with their owners. No affiliation or endorsement is implied.

## WebKit references and adapted button stylesheet

`extension/ios-buttons.css` adapts WebKit iOS button rules through the project's button comparison. To preserve the upstream rights, this complete stylesheet, including MM's modifications, is available under the GNU Library General Public License version 2 or, at your option, any later version (LGPL-2.0-or-later). The project's Shield competition restriction does not apply to this file. The full license is in [LICENSES/LGPL-2.0-or-later.txt](LICENSES/LGPL-2.0-or-later.txt).

The stylesheet is provided in its preferred editable CSS form. It is loaded as a separate stylesheet by the extension manifest, with no compilation or linking step. You may modify or replace it and build a local package using `python3 scripts/build.py`; verification against the original release is expected to fail after modifications. Nothing in the project license restricts rights granted under the LGPL, including modifying this component or debugging those modifications.

Modifications present in the MM 0.16.8 snapshot, documented on 2026-09-11: scoped action selectors, explicit appearance, public color values, capsule radius, rounded minimum height, waiting/result/disabled states, suggestions, animations and reduced-motion handling. These are adaptations and additions; they are not a copy of the entire WebKit renderer. Source comments retain the reference links.

Pinned upstream revision: `9b0f01ca9e14c8cf7b5485dadeaaeed687e2a851`.

### WebCore html.css

[Original source and copyright header](https://github.com/WebKit/WebKit/blob/9b0f01ca9e14c8cf7b5485dadeaaeed687e2a851/Source/WebCore/css/html.css), especially the iOS action rules at lines 868–906:

```text
/*
 * The default style sheet used to render HTML.
 *
 * Copyright (C) 2000 Lars Knoll (knoll@kde.org)
 * Copyright (C) 2003-2025 Apple Inc. All rights reserved.
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Library General Public
 * License as published by the Free Software Foundation; either
 * version 2 of the License, or (at your option) any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this library; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation, Inc., 51 Franklin Street, Fifth Floor,
 * Boston, MA 02110-1301, USA.
 *
 */
```

### WebCore RenderThemeIOS.mm

The padding, minimum-height and capsule geometry references come from [RenderThemeIOS.mm](https://github.com/WebKit/WebKit/blob/9b0f01ca9e14c8cf7b5485dadeaaeed687e2a851/Source/WebCore/rendering/ios/RenderThemeIOS.mm). Its notice is retained here for the referenced adaptations:

```text
/*
 * Copyright (C) 2005-2025 Apple Inc. All rights reserved.
 * Copyright (C) 2025-2026 Samuel Weinig <sam@webkit.org>
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
 */
```

## Screenshots and host integration

The screenshots use authored example posts and market data. They depict MM on a 4chan-style thread fixture; the extension integrates with 4chan's host controls and styles at runtime. MM does not claim ownership of the host's branding or other third-party material. The repository does not bundle the host site's JavaScript or full stylesheet. Mercenary Moderators is independent and is not affiliated with 4chan, Apple, WebKit or Orion.
