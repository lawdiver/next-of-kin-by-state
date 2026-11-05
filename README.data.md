# Next of kin by state

Who inherits when someone dies without a will (intestate succession), in each of the 50 U.S. states: the order of priority among relatives, and the statute that controls it.

Browse it as a table: https://lawdiver.com/guides/compare/next-of-kin

## Files

| File | What it is |
|---|---|
| `next-of-kin-by-state.csv` | One row per state |
| `next-of-kin-by-state.json` | Same rows, with the order of priority as an array |
| `input.json` | Hand-curated source: order of priority and citation for each state |
| `build.mjs` | Checks every citation against the LawDiver API and writes the CSV and JSON |

## Columns

| Column | Meaning |
|---|---|
| `state`, `state_code` | State name and USPS code |
| `order_of_priority` | Relatives in the order they inherit, separated by ` > ` in the CSV |
| `statute_citation` | The state's intestate succession section |
| `statute_edition_year` | Code edition the citation was checked against |
| `statute_official_url` | The section on the state's official code site |
| `statute_lawdiver_url` | The section on LawDiver |
| `statute_verified` | `true` when the citation was checked against the statute text |
| `statute_checked_via` | Where it was checked: `LawDiver API`, an official legislature site, or FindLaw |
| `guide_url` | LawDiver's full guide for the state: shares by family situation, related rules, cases |
| `note` | Anything a reader should know about the row |

## How it is built

`input.json` lists each state's order of priority, summarized from LawDiver's state guides, and the Bluebook citation of the controlling statute. `build.mjs` sends every citation to the LawDiver statute API (`POST /api/v1/statutes/retrieve`) and keeps a row as verified only when:

1. the API returns the section that was asked for (not a neighboring or parent section), and
2. the section's text reads as an intestacy provision.

Where the API cannot serve a section, the row was checked by hand against the official legislature site (Hawaii, Maine, Oregon) or FindLaw (Mississippi), recorded in `manualCheck` in `input.json`. Rows checked neither way keep their citation, link nowhere, and carry a note.

```bash
LAWDIVER_API_KEY=ld_... node build.mjs
```

Node 18 or later, no dependencies. A free API key: https://lawdiver.com/products/api

## Known gaps (build of 2026-11-05)

48 of 50 citations checked against statute text: 44 through the LawDiver API, 4 by hand (Hawaii, Maine, Oregon on official legislature sites; Mississippi on FindLaw).

- **New Mexico (§ 45-2-103), Oklahoma (tit. 84, § 213):** the citations are confirmed in public code databases, but the statute text was not checked in this build.

## Limits

This is a summary for orientation, not legal advice. The order of priority does not show the shares (for example, how a spouse and children split an estate), survivorship rules, half-blood or adoption rules, or community property. The statute controls; the linked guide covers the details.

## License

Data: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Reuse it for anything, including commercially, and credit **LawDiver (lawdiver.com)** with a link to https://lawdiver.com/guides/compare/next-of-kin.

Build script: MIT.

## Cite as

LawDiver. *Next of kin by state* (2026). https://lawdiver.com/guides/compare/next-of-kin
