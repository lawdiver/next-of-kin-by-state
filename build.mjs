#!/usr/bin/env node
/**
 * Build the "Next of kin by state" dataset.
 *
 * Reads input.json (one row per state: the order of priority as summarized in
 * the LawDiver guide, and the Bluebook citation of the state's intestate
 * succession statute), checks every citation against the LawDiver statute API,
 * and writes:
 *
 *   next-of-kin-by-state.json
 *   next-of-kin-by-state.csv
 *
 * next to this file, plus a copy of both in packages/client/public/datasets/
 * when run inside the LawDiver monorepo.
 *
 * Usage:
 *   LAWDIVER_API_KEY=ld_... node build.mjs
 *
 * Get a free key at https://lawdiver.com/products/api. One statute retrieval
 * per state, so a full build is about 50 requests.
 *
 * No dependencies: Node 18+ (global fetch).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const API = process.env.LAWDIVER_API_URL || 'https://lawdiver.com/api/v1';
const KEY = process.env.LAWDIVER_API_KEY;
const SITE = 'https://lawdiver.com';

if (!KEY) {
  console.error('Set LAWDIVER_API_KEY (free key: https://lawdiver.com/products/api).');
  process.exit(1);
}

/** POST /statutes/retrieve with a Bluebook citation; retries on 429/5xx. */
async function retrieveStatute(citation) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(`${API}/statutes/retrieve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query: citation }),
    });
    if (res.status === 429 || res.status >= 500) {
      const wait = Number(res.headers.get('retry-after')) * 1000 || 1000 * 2 ** attempt;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    return res.json();
  }
  throw new Error(`statutes/retrieve kept failing for ${citation}`);
}

/** Last section token of a citation, normalized: "§ 42-1-3a" -> "42-1-3a". */
function sectionOf(citation) {
  const m = String(citation).trim().match(/([0-9A-Za-z.:/-]+)$/);
  return m ? m[1].toLowerCase().replace(/[.]$/, '') : '';
}

/**
 * A "valid" verdict is not enough: require that the section returned is the
 * section asked for, and that its text reads like an intestacy provision.
 */
function looksRight(citation, statute) {
  const asked = sectionOf(citation);
  const got = sectionOf(statute.bluebook || '');
  if (!asked || asked !== got) return false;
  return /intesta|heirs?\b|descen|kindred|succession|leaves? no surviving spouse/i.test(
    statute.body || '',
  );
}

function csvCell(value) {
  const s = value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const input = JSON.parse(readFileSync(join(HERE, 'input.json'), 'utf8'));
const rows = [];
let unverified = 0;

for (const row of input) {
  const result = await retrieveStatute(row.citation);
  const st = result.statute;
  const viaApi =
    result.status === 'ok' && result.verdict === 'valid' && Boolean(st) && looksRight(row.citation, st);
  // Rows the API cannot serve may be checked by hand against another copy of the code.
  const manual = !viaApi && row.manualCheck ? row.manualCheck : null;
  const verified = viaApi || Boolean(manual);
  if (!verified) unverified++;
  rows.push({
    state: row.state,
    stateCode: row.stateCode,
    orderOfPriority: row.orderOfPriority,
    statute: {
      // An unverified row keeps the citation as written and links nowhere:
      // never publish a link to a section that failed the check.
      citation: viaApi ? st.bluebook : row.citation,
      editionYear: viaApi ? (st.editionYear ?? null) : null,
      officialUrl: viaApi ? (st.officialUrl ?? null) : (manual?.url ?? null),
      lawdiverUrl: viaApi && st.authorityKey
        ? `${SITE}/authoritydisplay?key=${encodeURIComponent(st.authorityKey)}`
        : null,
      verified,
      checkedVia: viaApi ? 'LawDiver API' : (manual?.via ?? null),
    },
    guideUrl: row.guideUrl,
    note:
      row.note ??
      (verified
        ? null
        : 'Citation not verified against LawDiver statute data in this build; check the official code.'),
  });
  console.log(
    `${viaApi ? 'ok  ' : manual ? 'HAND' : 'MISS'} ${row.state.padEnd(15)} ${row.citation.padEnd(42)} ${st ? `${st.bluebook} | ${(st.body || '').replace(/\s+/g, ' ').slice(0, 70)}` : result.message ?? ''}`,
  );
}

const builtAt = new Date().toISOString().slice(0, 10);
const json = {
  name: 'Next of kin by state',
  description:
    'Order in which relatives inherit when a person dies without a will (intestate succession), for each U.S. state, with the controlling statute.',
  source: 'https://lawdiver.com/guides/compare/next-of-kin',
  license: 'CC BY 4.0 — credit "LawDiver (lawdiver.com)" with a link.',
  builtAt,
  builtWith: 'LawDiver API POST /api/v1/statutes/retrieve',
  disclaimer:
    'General information, not legal advice. The order of priority is a summary: shares depend on the full family situation, and the statute controls.',
  rows,
};
writeFileSync(join(HERE, 'next-of-kin-by-state.json'), `${JSON.stringify(json, null, 2)}\n`);

const header = [
  'state',
  'state_code',
  'order_of_priority',
  'statute_citation',
  'statute_edition_year',
  'statute_official_url',
  'statute_lawdiver_url',
  'statute_verified',
  'statute_checked_via',
  'guide_url',
  'note',
];
const csv = [
  header.join(','),
  ...rows.map((r) =>
    [
      r.state,
      r.stateCode,
      r.orderOfPriority.join(' > '),
      r.statute.citation,
      r.statute.editionYear,
      r.statute.officialUrl,
      r.statute.lawdiverUrl,
      r.statute.verified,
      r.statute.checkedVia,
      r.guideUrl,
      r.note,
    ]
      .map(csvCell)
      .join(','),
  ),
].join('\n');
writeFileSync(join(HERE, 'next-of-kin-by-state.csv'), `${csv}\n`);

// Inside the monorepo, also publish the files for the /guides/compare page.
const publicDir = resolve(HERE, '../../packages/client/public/datasets');
if (existsSync(resolve(HERE, '../../packages/client'))) {
  mkdirSync(publicDir, { recursive: true });
  writeFileSync(join(publicDir, 'next-of-kin-by-state.json'), `${JSON.stringify(json, null, 2)}\n`);
  writeFileSync(join(publicDir, 'next-of-kin-by-state.csv'), `${csv}\n`);
}

console.log(`\n${rows.length} states, ${unverified} citation(s) not checked against statute text.`);
