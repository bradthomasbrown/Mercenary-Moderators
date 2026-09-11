# Contributing to Mercenary Moderators

You can develop features, test changes and prepare pull requests without asking us first, subject to the applicable license. No prior contributor approval, separate Contributor License Agreement (CLA), signature, copyright assignment or project registration is required.

## Contribution terms

By intentionally submitting a contribution for inclusion, you offer it under the same license that applies to the material you are contributing to: [PolyForm Shield 1.0.0](LICENSE) for MM material, with the exceptions in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md). You retain your copyright. Submit work you have the rights to contribute and preserve existing notices. Identify any third-party material and its license in your pull request.

Contribution forks, local development and pull requests are welcome. Shield restricts providing competing products, including free substitutes; the full license and its exceptions control. You do not have to submit every private improvement. Maintainers decide which changes to merge and what appears in official releases. Merging a pull request does not transfer copyright or grant additional rights to relicense your work.

## Preparing a change

Explain the problem, the resulting behavior, and how you checked it. For interface changes, include a useful screenshot when possible. Orion on iPhone is the primary testing environment; identify the actual browser used for your checks.

This repository currently contains the shipped user extension. It does not yet contain the upstream behavior-test suite. Start from the recorded release and run `python3 scripts/build.py --verify` to confirm the baseline. After a source change, that command should report a mismatch until maintainers deliberately update the release metadata. Do not rewrite published checksums or tags to make a changed package look like the old release.

For changes that depend on the market service, explain that dependency; its implementation is outside this repository. A merged change does not automatically deploy a new extension version.

## Reporting bugs

Describe what you tried, what happened, your extension version and browser. The extension menu's Error trace can provide a bounded diagnostic report. Review it before posting and omit recovery codes, account keys and other private information.
