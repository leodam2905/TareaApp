import { google } from 'googleapis';
import fs from 'node:fs';
import path from 'node:path';

const KEY = '/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json';
const ASSETS = '/Users/monsegueadah/TareaApp/apps/mobile/store';
const SHOTS = '/Users/monsegueadah/Desktop/playstore-screenshots/submission';
const LANG = 'en-US';
const CONTACT_EMAIL = 'support@taptarea.com';
const CONTACT_WEBSITE = 'https://taptarea.com';

const auth = new google.auth.GoogleAuth({
  keyFile: KEY,
  scopes: ['https://www.googleapis.com/auth/androidpublisher'],
});
const ap = google.androidpublisher({ version: 'v3', auth });

const apps = {
  'com.taptarea.customer': {
    dir: 'customer',
    title: 'Tarea: Find a Handyman',
    short: 'Book trusted, verified handymen for any home job. Instant quotes, fast.',
    full: `Need something fixed, installed, or cleaned? Tarea connects you with trusted, verified handymen near you — booked in minutes, right from your phone.

Whether it's a leaky faucet, a wobbly shelf, a deep clean, or a big move, Tarea makes getting home help simple, fast, and stress-free.

WHY TAREA
• Verified pros — every handyman is vetted so you can book with confidence
• Instant quotes — get a fair price estimate in seconds with our AI quote engine
• Snap & diagnose — upload a photo of the problem and let our AI suggest the right service
• Secure payments — pay safely in-app; your money is protected until the job is done
• Real reviews — see ratings and feedback from real customers before you book
• Live updates — track your handyman's status and get notified every step of the way

SERVICES ON TAREA
Plumbing • Electrical • Carpentry • Painting • HVAC • Landscaping • Cleaning • Moving • Wash & Fold • Assembly & Mounting • General handyman work

HOW IT WORKS
1. Tell us what you need — pick a service or describe the job
2. Get an instant price estimate
3. Choose a verified handyman and schedule a time
4. Relax — pay securely in-app once the job is done

BUILT FOR PEACE OF MIND
Tarea handles the hard parts: vetted professionals, transparent pricing, secure payments, and a clear cancellation policy. If plans change, our flexible cancellation keeps things fair for everyone.

Download Tarea today and get your to-do list done — the easy way.

Questions? Reach us at support@taptarea.com
Privacy policy: https://taptarea.com/privacy`,
  },
  'com.taptarea.handyman': {
    dir: 'handyman',
    title: 'Tarea Pro: Handyman Jobs',
    short: 'Find local handyman jobs, get paid fast, and grow your business with Tarea.',
    full: `Turn your skills into steady work. Tarea Pro connects verified handymen and service professionals with local customers who need jobs done — so you can spend less time chasing leads and more time earning.

WHY TAREA PRO
• Find jobs near you — get matched with local customers looking for your skills
• Get paid fast — secure in-app payments with quick, reliable payouts
• Manage everything in one place — bookings, schedule, messages, and earnings
• Build your reputation — collect reviews and ratings that win you more work
• Grow with Premium — boost your visibility and unlock more opportunities
• Stay in control — set your service area, availability, and the jobs you take

WHAT YOU CAN DO
• Browse and accept job requests from nearby customers
• Send quotes and confirm bookings in a few taps
• Chat with customers and share "on my way" updates
• Track your earnings and payout history
• Showcase your work with a photo portfolio

PERFECT FOR
Plumbers, electricians, carpenters, painters, HVAC techs, landscapers, cleaners, movers, assemblers, and all-around handymen.

HOW IT WORKS
1. Create your pro profile and get verified
2. Set your services, rates, and availability
3. Receive job requests from local customers
4. Complete the work and get paid securely through the app

Tarea Pro handles payments, scheduling, and customer trust — so you can focus on doing great work and growing your business.

Download Tarea Pro and start earning today.

Questions? Reach us at support@taptarea.com
Privacy policy: https://taptarea.com/privacy`,
  },
};

async function uploadImage(pkg, editId, imageType, file) {
  await ap.edits.images.upload({
    packageName: pkg,
    editId,
    language: LANG,
    imageType,
    media: { mimeType: 'image/png', body: fs.createReadStream(file) },
  });
  console.log(`   ↑ ${imageType}: ${path.basename(file)}`);
}

for (const [pkg, a] of Object.entries(apps)) {
  console.log(`\n=== ${pkg} (${a.title}) ===`);
  try {
    const { data: edit } = await ap.edits.insert({ packageName: pkg });
    const editId = edit.id;

    await ap.edits.listings.update({
      packageName: pkg, editId, language: LANG,
      requestBody: { language: LANG, title: a.title, shortDescription: a.short, fullDescription: a.full },
    });
    console.log('   ✓ listing text (title / short / full)');

    await ap.edits.details.update({
      packageName: pkg, editId,
      requestBody: { defaultLanguage: LANG, contactEmail: CONTACT_EMAIL, contactWebsite: CONTACT_WEBSITE },
    });
    console.log('   ✓ contact details');

    await uploadImage(pkg, editId, 'icon', `${ASSETS}/${a.dir}/icon-512.png`);
    await uploadImage(pkg, editId, 'featureGraphic', `${ASSETS}/${a.dir}/feature-graphic.png`);

    await ap.edits.images.deleteall({ packageName: pkg, editId, language: LANG, imageType: 'phoneScreenshots' });
    const shotDir = `${SHOTS}/${a.dir}`;
    const shots = fs.readdirSync(shotDir).filter(f => f.toLowerCase().endsWith('.png')).sort();
    for (const s of shots) await uploadImage(pkg, editId, 'phoneScreenshots', path.join(shotDir, s));

    const { data: committed } = await ap.edits.commit({ packageName: pkg, editId });
    console.log(`   ✅ COMMITTED edit ${committed.id}`);
  } catch (e) {
    const msg = e?.response?.data?.error?.message || e?.errors?.[0]?.message || e.message;
    console.error(`   ✖ FAILED: ${msg}`);
    if (e?.response?.status) console.error(`     HTTP ${e.response.status}`);
  }
}
