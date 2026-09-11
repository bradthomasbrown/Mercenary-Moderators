# Restrictive license recommendation · proposal only

The owner wants people to inspect the code while retaining more control over reuse. No license is selected or granted by this document, and the repository remains private.

## Recommended starting point

**PolyForm Strict 1.0.0** is the closest established option if the intended rule is: permit noncommercial use and inspection, and require separate permission for modifications, redistribution, or commercial use. It is a source-available license, not an open-source license.

That restriction on modifications matters: it also limits ordinary third-party patches and private customizations. If the owner wants those while controlling redistribution, tailored source-available terms may be a better fit; the final terms should receive legal review before public release.

| Option | What it permits | What it restricts | Main tradeoff |
| --- | --- | --- | --- |
| [PolyForm Strict 1.0.0](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Strict-1.0.0.md) | Noncommercial purposes, including specified personal and nonprofit uses | Grants no permission for modification or redistribution, and excludes commercial purposes | Strong control, but limits community modifications and distribution |
| [PolyForm Shield 1.0.0](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Shield-1.0.0.md) | Use, modification and redistribution for permitted purposes, including noncompeting commercial uses | Competing products, including free competitors, under its defined scope | Better suited to competition concerns than a general ban on reuse |
| [PolyForm Noncommercial 1.0.0](https://github.com/polyformproject/polyform-licenses/blob/1.0.0/PolyForm-Noncommercial-1.0.0.md) | Noncommercial use, modification and redistribution | Commercial purposes | Allows noncommercial forks and redistribution, so it grants more rights than Strict |

These summaries do not replace the license texts. Their definitions, exceptions, patent terms and conditions matter. None offers the broad commercial-use rights required of an open-source license.

AGPL is a different choice: it allows commercial use and redistribution while requiring source availability under specified conditions. It would not implement a general ban on commercial reuse. A license with an eventual open-source conversion also would not provide indefinite restrictions.

## Rights and provenance

The initial implementation was written by agents. Under the U.S. Copyright Office's [2025 guidance on AI outputs](https://www.copyright.gov/newsnet/2025/1060.html), copyright protection requires sufficient human-authored expressive elements; prompts alone do not establish that. Human creative modifications or arrangements may be protected. This does not determine the rights in this particular codebase, but a restrictive license cannot create copyright protection where none exists. Jurisdiction and the actual human contribution matter.

Existing third-party rights and notices also remain applicable; a project license cannot replace them. The attribution review in `ATTRIBUTION.md` is still open. Public GitHub hosting also has platform terms that need to be reconciled with any proposed restrictions.

The next licensing decision is which rights the owner wants to grant, followed by a review of provenance and the final text. Do not add a `LICENSE` file, claim open-source status, or change public visibility solely on the basis of this proposal.
