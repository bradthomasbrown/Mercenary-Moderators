# Private review and maintenance

The repository is private while its presentation, source scope and quality are reviewed. Public visibility requires the owner's explicit approval.

Current evidence:

- The 20 extension files are copied from the published 0.16.8 user archive and checked against its recorded digests.
- A standalone Python build reproduces that archive byte for byte.
- The initial product screenshots use authored examples and identify the actual capture browser.

Current gaps and proposed work:

- Extract the relevant behavior tests from the upstream application and make them runnable here. Cover tagging/filtering, market failures, identity updates and recovery before structural changes.
- Document the worker/UI message boundaries and data formats. Break up large components where a clear responsibility boundary exists.
- Review permissions, secret handling and third-party provenance. Select a project license with the owner before public release.
- Establish an explicit synchronization and release workflow between this repository and the deployed application. Preserve the connection between source revision, tested package and downloaded ZIP.

The origin of the code is disclosed in the README. Review conclusions should rest on observed behavior and inspectable evidence. This initial snapshot is not represented as independently audited or fully maintainable.

During private preparation, repository files and tags may be maintained through repository-scoped Git write access. The release workflow uses GitHub's temporary repository token with `contents: write` to upload releases and commit a result record. No personal access token is stored here. Other API administration still needs appropriate access. Making this repository public and changing live product behavior remain explicit decisions.

## Versioned installer releases

Before pushing a `v…` tag, update the source, `release.json`, and `docs/releases/<version>.md`, then run `python3 scripts/prepare_release.py --tag v<version>`. The version tag must match the release metadata, and the source must reproduce the recorded archive.

The tag workflow builds the installer and `SHA256SUMS.txt`, creates a draft prerelease, downloads and compares both uploaded assets, then publishes it inside the private repository. It refuses an existing release instead of replacing its assets. Failures may leave a draft for investigation; do not delete or replace it without checking its state.

The workflow records its result at `release-history/v<version>.json` on `main`. Maintainers using only Git can fetch that commit to verify the release URL, exact source commit, asset metadata and workflow result. The workflow refuses publication after a change to public repository visibility until that separate promotion policy is deliberately updated. Public-source approval and licensing remain owner decisions.
