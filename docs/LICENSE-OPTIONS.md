# Restrictive license recommendation · proposal only

The owner wants people to inspect the code while retaining more control over reuse. No license is selected or granted by this document, and the repository remains private.

## Updated recommendation: PolyForm Shield plus contribution terms

The owner clarified the goal: prevent someone from copying Mercenary Moderators and providing a competing project, including a free competitor during the beta and competitors after the business develops. People should be able to develop improvements and contribute them to the official project through pull requests.

**PolyForm Shield 1.0.0** is now the recommended starting point. This supersedes the earlier provisional Strict recommendation. Shield permits changes and redistribution for permitted purposes, while excluding competing products. Strict's general modification restriction would obstruct the contribution model the owner wants.

Shield expressly states: “Goods and services compete even when provided free of charge.” A revenue model is therefore not a prerequisite to its competition restriction. Its definition also addresses different interfaces and platforms. Publishing a substitute using the licensed code is the intended concern; the license is not a general prohibition on independently developed competition.

Shield's scope includes both the licensed software and products the licensor or affiliates provide using it. That is broader than Perimeter's focus on competition with the software itself, and may be useful as the project develops. This is a proposed licensing fit, not a conclusion about enforceability in a particular dispute.

| Option | Fit for the clarified goal | Important limit |
| --- | --- | --- |
| [PolyForm Shield 1.0.0](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Shield-1.0.0.md) | Recommended: allows work on the code for permitted purposes and restricts competing products, including free ones; also addresses products provided using the software | Has specific new-product and discontinued-product provisions; does not require every improvement to be contributed upstream |
| [PolyForm Perimeter 1.0.1](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Perimeter-1.0.1.md) | Narrower alternative: restricts providing others a product that competes with the software, including free alternatives | Does not have Shield's wider scope covering products the licensor provides using the software |
| [PolyForm Strict 1.0.0](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Strict-1.0.0.md) | Restricts reuse more broadly | Also withholds modification and redistribution rights generally, making ordinary contribution work harder |
| [PolyForm Noncommercial 1.0.0](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Noncommercial-1.0.0.md) | Allows noncommercial modifications and redistribution | Does not implement the requested restriction on free competing forks |

These are source-available restrictions, not open-source licenses. The full license definitions, exceptions and conditions control.

### Future protection has boundaries

Shield's New Products clause allows an existing, previously noncompeting use to continue with previously available versions if the licensor later enters that market. It does not let the owner retroactively prohibit every previously permitted use by expanding into a new business. A future version can have different terms only within the rights actually held; it does not erase rights already granted.

Shield also has a Discontinued Products provision. A `Licensor Line of Business:` notice can preserve a specified line against that exception. If Shield is selected, review a precise description of MM's actual line of business, such as browser-based post tagging, filtering and tag-sharing markets. This is a candidate scope description, not a notice applied to the code by this document.

### Encourage contributions while retaining project control

The recommended package has three parts:

1. Shield as the source license, with the owner and required notices identified accurately.
2. A contribution policy that clearly permits the development work needed for patches: contribution forks or branches, local test builds, and pull requests. Explain the distinction between preparing a contribution and offering a competing product. Any supplemental permission should be checked against the chosen license rather than assumed from a README invitation.
3. A contributor agreement covering the rights the project needs to use, modify, distribute and, if desired, relicense accepted contributions for future releases or commercial terms. Contributors can retain copyright while granting specified rights; merely merging a pull request does not transfer their copyright to the project.

The policy should make upstream contributions attractive through clear scope, reproducible checks, responsive review and credit. Maintainers retain decisions over merges, the official roadmap, branding and official releases. Neither Shield nor a contribution invitation forces someone to submit every private improvement as a pull request. Independently written alternatives also cannot be ruled out simply by choosing this source license.

No contributor agreement or supplemental legal permission is adopted by this proposal. Have the final source/contribution terms reviewed before applying them.

## TypeScript comparison

[TypeScript's license](https://github.com/microsoft/TypeScript/blob/main/LICENSE.txt) is Apache 2.0. It permits modification and redistribution, including commercial competing forks, subject to its conditions. It is not an anti-fork or anti-competition license.

Its [contribution policy](https://github.com/microsoft/TypeScript/blob/main/CONTRIBUTING.md) sets rules for issues, pull requests and review and requires a Contributor License Agreement. This is useful precedent for managing an official upstream project, but it is a different licensing model from MM's stated goal. Central control of the official repository does not itself prohibit independently maintained forks.

## Rights and provenance

The initial implementation was written by agents. Under the U.S. Copyright Office's [2025 guidance on AI outputs](https://www.copyright.gov/newsnet/2025/1060.html), copyright protection requires sufficient human-authored expressive elements; prompts alone do not establish that. Human creative modifications or arrangements may be protected. This does not determine the rights in this particular codebase, but a restrictive license cannot create copyright protection where none exists. Jurisdiction and the actual human contribution matter.

Existing third-party rights and notices also remain applicable; a project license cannot replace them. The attribution review in `ATTRIBUTION.md` is still open. Public GitHub hosting also has platform terms that need to be reconciled with any proposed restrictions.

The next licensing decision is which rights the owner wants to grant, followed by a review of provenance and the final text. Do not add a `LICENSE` file, claim open-source status, or change public visibility solely on the basis of this proposal.
