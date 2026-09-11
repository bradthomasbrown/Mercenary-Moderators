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

During private preparation, repository files and tags may be maintained through repository-scoped Git write access. Issue management, release-asset uploads and repository settings require separate GitHub API permissions. Making this repository public and changing live product behavior remain explicit decisions.
