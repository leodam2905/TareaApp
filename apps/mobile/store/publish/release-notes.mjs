import { google } from 'googleapis';

const KEY = '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json';
const LANG = 'en-US';
const TRACK = 'internal';

const auth = new google.auth.GoogleAuth({ keyFile: KEY, scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
const ap = google.androidpublisher({ version: 'v3', auth });

const notes = {
  'com.taptarea.customer': `Welcome to Tarea! Book trusted, verified handymen for any home job.
- Instant AI price quotes
- Snap a photo to diagnose the problem
- Secure in-app payments
- Real-time job tracking and reviews
Thanks for testing — we'd love your feedback!`,
  'com.taptarea.handyman': `Welcome to Tarea Pro! Find local jobs and grow your handyman business.
- Get matched with nearby customers
- Manage bookings, schedule and messages
- Fast, secure payouts
- Build your reputation with reviews
Thanks for testing — we'd love your feedback!`,
};

for (const [pkg, text] of Object.entries(notes)) {
  console.log(`\n=== ${pkg} (${TRACK}) ===`);
  try {
    const { data: edit } = await ap.edits.insert({ packageName: pkg });
    const editId = edit.id;
    const { data: track } = await ap.edits.tracks.get({ packageName: pkg, editId, track: TRACK });
    if (!track.releases || track.releases.length === 0) {
      console.log('   ⚠ no release on this track yet — skipping (roll out a release first)');
      await ap.edits.delete({ packageName: pkg, editId }).catch(() => {});
      continue;
    }
    track.releases = track.releases.map(r => ({ ...r, releaseNotes: [{ language: LANG, text }] }));
    await ap.edits.tracks.update({ packageName: pkg, editId, track: TRACK, requestBody: track });
    const { data: committed } = await ap.edits.commit({ packageName: pkg, editId });
    console.log(`   ✅ release notes set (${text.length} chars) — committed ${committed.id}`);
  } catch (e) {
    const msg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e.message;
    console.error(`   ✖ ${msg}`);
  }
}
