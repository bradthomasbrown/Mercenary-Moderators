# Maintenance and release process

The owner approved PolyForm Shield licensing and public repository visibility on 2026-09-11. The source and release process remain under active review.

Current evidence:

- The 20 extension files are copied from the published 0.16.8 user archive and checked against its recorded digests.
- A standalone Python build reproduces that archive byte for byte.
- The initial product screenshots use authored examples and identify the actual capture browser.

Current gaps and proposed work:

- Extract the relevant behavior tests from the upstream application and make them runnable here. Cover tagging/filtering, market failures, identity updates and recovery before structural changes.
- Document the worker/UI message boundaries and data formats. Break up large components where a clear responsibility boundary exists.
- Continue reviewing permissions, secret handling and third-party provenance. Preserve the adopted project license and third-party exceptions.
- Establish an explicit synchronization and release workflow between this repository and the deployed application. Preserve the connection between source revision, tested package and downloaded ZIP.

The origin of the code is disclosed in the README. Review conclusions should rest on observed behavior and inspectable evidence. This initial snapshot is not represented as independently audited or fully maintainable.

Repository files and tags may be maintained through repository-scoped Git write access. The release workflow uses GitHub's temporary repository token with `contents: write` to upload releases and commit a result record. No personal access token is stored here. Other API administration still needs appropriate access. Public visibility has been authorized; changing the setting still requires repository administration access. Changing live product behavior follows the separate product release process.

## Versioned installer releases

Before pushing a `v…` tag, update the source, `release.json`, and `docs/releases/<version>.md`, then run `python3 scripts/prepare_release.py --tag v<version>`. The version tag must match the release metadata, and the source must reproduce the recorded archive.

The tag workflow builds the installer, `SHA256SUMS.txt` and a legal-notices ZIP, creates a draft prerelease, downloads and compares all uploaded assets, then publishes it with the repository's current visibility. It refuses an existing release instead of replacing its assets. Failures may leave a draft for investigation; do not delete or replace it without checking its state.

The workflow records its result at `release-history/v<version>.json` on `main`. Maintainers using only Git can fetch that commit to verify the release URL, exact source commit, asset metadata and workflow result. The workflow is restricted to the official repository and supports its authorized public visibility. Do not move published tags or replace existing assets. Historical release records retain the visibility observed when they were written.

The publication-notices workflow supplies a separate, content-addressed legal-notices ZIP for the existing 0.16.8 release and updates its release notes. It verifies the existing installer and checksum first and does not replace them. The old tag predates license adoption; NOTICE explicitly grants the adopted license for the licensor's 0.16.8 material as well. The result is recorded in `release-history/licensing.json` for Git-only maintenance.

Run `python3 -m unittest discover -s tests -p test_publication_notices.py -v` when changing this publication path. Its isolated GitHub CLI fixture covers public/private operation, retries and rejection of changed existing assets.
