// Promote an already-uploaded build to a Play track for both apps.
//
// This step always comes back to a human: the agent's auto-mode classifier
// blocks a Play production release, so this exists to be run by hand and to be
// hard to get wrong when it is.
//
//   node <abs path>/promote-play.mjs 1.0.26 50                  # -> production
//   node <abs path>/promote-play.mjs 1.0.26 50 --track internal
//   node <abs path>/promote-play.mjs 1.0.26 50 --dry-run
//
// Run it with a BARE ABSOLUTE PATH. No `cd` is needed -- Node resolves
// `googleapis` from this file's directory, not the shell's -- and a
// `cd ~/... && node ...` form has failed here before.
//
// A completed production rollout CANNOT be rolled back. Correcting one needs a
// new versionCode.
import { google } from 'googleapis';

const KEY = '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json';

// Release notes live here, keyed by versionName, so the text that goes to Play
// is reviewable in a diff instead of being retyped at the prompt each release.
// Keep these in step with the App Store "what's new" for the same build.
const NOTES = {
  '1.0.27': {
    'com.taptarea.customer':
      "You can now open any pro who applied and see exactly what they'd charge — labour, materials and the service fee, broken down. Licence and insurance badges show on every pro who has them.",
    'com.taptarea.handyman':
      "Applying to a job now shows YOUR labour price for it, not someone else's, and the materials field no longer disappears behind the keyboard. Adding a service asks which category it is instead of assuming plumbing.",
  },
  '1.0.26': {
    'com.taptarea.customer':
      "You can now require a licensed & insured pro when you post a job, and see each pro's credentials while you choose. Job budgets show the range of rates that could take the work, and your invoices name the pro who did it.",
    'com.taptarea.handyman':
      "Your invoices now carry your name. The rate you set is now used on open job requests too, and materials you report are checked against the receipt you upload.",
  },
};

const argv = process.argv.slice(2);
const flag = (name, def) => {
  const i = argv.indexOf(name);
  return i === -1 ? def : argv[i + 1];
};
const DRY = argv.includes('--dry-run');
const TRACK = flag('--track', 'production');
const [VERSION, VC] = argv.filter(a => !a.startsWith('--') && argv[argv.indexOf(a) - 1] !== '--track');

if (!VERSION || !VC) {
  console.error('usage: node promote-play.mjs <versionName> <versionCode> [--track production|internal] [--dry-run]');
  process.exit(2);
}
if (!/^\d+$/.test(VC)) { console.error(`versionCode must be numeric, got "${VC}"`); process.exit(2); }
if (!NOTES[VERSION]) {
  console.error(`No release notes for ${VERSION}. Add them to NOTES in this file first —\n` +
                `shipping a release with the previous version's notes is worse than not shipping.`);
  process.exit(2);
}

const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });

console.log(`${DRY ? '[DRY RUN] ' : ''}promoting ${VERSION} (vc${VC}) to ${TRACK}\n`);

for (const [pkg, text] of Object.entries(NOTES[VERSION])) {
  console.log('=== ' + pkg + ' ===');

  // Refuse to promote a versionCode that was never uploaded: a track update
  // naming an absent bundle is rejected late and confusingly.
  const { data: probe } = await ap.edits.insert({ packageName: pkg });
  const { data: tracks } = await ap.edits.tracks.list({ packageName: pkg, editId: probe.id });
  const seen = new Set();
  for (const t of tracks.tracks || [])
    for (const r of t.releases || [])
      for (const c of r.versionCodes || []) seen.add(String(c));
  await ap.edits.delete({ packageName: pkg, editId: probe.id }).catch(() => {});

  if (!seen.has(String(VC))) {
    console.log(`   SKIP: vc${VC} is not on any track for this package (seen: ${[...seen].join(', ') || 'none'})`);
    continue;
  }
  if (DRY) { console.log(`   would set ${TRACK} -> ${VERSION} vc=${VC} (100%)`); continue; }

  const { data: edit } = await ap.edits.insert({ packageName: pkg });
  await ap.edits.tracks.update({
    packageName: pkg, editId: edit.id, track: TRACK,
    requestBody: { track: TRACK, releases: [{
      name: VERSION, versionCodes: [String(VC)], status: 'completed',
      releaseNotes: [{ language: 'en-US', text }],
    }]},
  });
  await ap.edits.commit({ packageName: pkg, editId: edit.id });

  // Assert the outcome by reading it back from a FRESH edit. Success is never
  // inferred from the absence of an error.
  const { data: after } = await ap.edits.insert({ packageName: pkg });
  const { data: t2 } = await ap.edits.tracks.list({ packageName: pkg, editId: after.id });
  const rel = ((t2.tracks || []).find(t => t.track === TRACK)?.releases || [])[0];
  const ok = rel && (rel.versionCodes || []).map(String).includes(String(VC));
  console.log(`   ${ok ? '✓' : '✗'} ${TRACK}: ${rel?.name ?? '-'} vc=${(rel?.versionCodes || ['-']).join('/')} ${rel?.status ?? ''}`);
  await ap.edits.delete({ packageName: pkg, editId: after.id }).catch(() => {});
  if (!ok) process.exitCode = 1;
}
