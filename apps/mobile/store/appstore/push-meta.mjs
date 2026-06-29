import { asc } from './asc.mjs';

const apps = {
  '6784023441': { // Tarea Home (customer)
    subtitle: 'Trusted handymen, on demand',
    keywords: 'handyman,home repair,plumber,electrician,cleaner,booking,contractor,services,fix,moving',
    promo: 'Book a verified handyman in minutes — instant quotes, secure payments, real reviews.',
    description: `Need something fixed, installed, or cleaned? Tarea Home connects you with trusted, verified handymen near you — booked in minutes, right from your phone.

Whether it's a leaky faucet, a wobbly shelf, a deep clean, or a big move, Tarea Home makes getting home help simple, fast, and stress-free.

WHY TAREA HOME
• Verified pros — every handyman is vetted so you can book with confidence
• Instant quotes — get a fair price estimate in seconds
• Snap & diagnose — upload a photo and let AI suggest the right service
• Secure payments — pay safely in-app; your money is protected until the job is done
• Real reviews — see ratings and feedback before you book
• Live updates — track your handyman's status every step of the way

SERVICES
Plumbing • Electrical • Carpentry • Painting • HVAC • Landscaping • Cleaning • Moving • Wash & Fold • Assembly & Mounting • General handyman work

HOW IT WORKS
1. Tell us what you need
2. Get an instant price estimate
3. Choose a verified handyman and schedule a time
4. Relax — pay securely in-app once the job is done

Download Tarea Home and get your to-do list done — the easy way.

Questions? support@taptarea.com`,
  },
  '6784029141': { // Tarea Pro (handyman)
    subtitle: 'Find jobs. Get paid. Grow.',
    keywords: 'handyman jobs,gig work,contractor,find work,earnings,service pro,local jobs,trades,side work',
    promo: 'Find local handyman jobs, manage bookings, and get paid fast. Grow your business.',
    description: `Turn your skills into steady work. Tarea Pro connects verified handymen and service professionals with local customers who need jobs done — so you spend less time chasing leads and more time earning.

WHY TAREA PRO
• Find jobs near you — get matched with local customers looking for your skills
• Get paid fast — secure in-app payments with quick, reliable payouts
• Manage everything in one place — bookings, schedule, messages, and earnings
• Build your reputation — collect reviews and ratings that win you more work
• Grow with Premium — boost your visibility and unlock more opportunities
• Stay in control — set your service area, availability, and the jobs you take

PERFECT FOR
Plumbers, electricians, carpenters, painters, HVAC techs, landscapers, cleaners, movers, assemblers, and all-around handymen.

HOW IT WORKS
1. Create your pro profile and get verified
2. Set your services, rates, and availability
3. Receive job requests from local customers
4. Complete the work and get paid securely through the app

Download Tarea Pro and start earning today.

Questions? support@taptarea.com`,
  },
};

for (const [appId, m] of Object.entries(apps)) {
  // appInfoLocalization -> subtitle
  const ai = await asc(`/v1/apps/${appId}/appInfos`);
  const appInfoId = ai.body.data[0].id;
  const aiLoc = await asc(`/v1/appInfos/${appInfoId}/appInfoLocalizations`);
  const aiLocEn = aiLoc.body.data.find(l => l.attributes.locale === 'en-US');
  const r1 = await asc(`/v1/appInfoLocalizations/${aiLocEn.id}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'appInfoLocalizations', id: aiLocEn.id, attributes: { subtitle: m.subtitle } }
  })});
  // appStoreVersionLocalization -> description, keywords, promo, urls
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions`);
  const verId = ver.body.data[0].id;
  const vLoc = await asc(`/v1/appStoreVersions/${verId}/appStoreVersionLocalizations`);
  const vLocEn = vLoc.body.data.find(l => l.attributes.locale === 'en-US');
  const r2 = await asc(`/v1/appStoreVersionLocalizations/${vLocEn.id}`, { method:'PATCH', body: JSON.stringify({
    data: { type:'appStoreVersionLocalizations', id: vLocEn.id, attributes: {
      description: m.description, keywords: m.keywords, promotionalText: m.promo,
      supportUrl: 'https://taptarea.com', marketingUrl: 'https://taptarea.com',
    } }
  })});
  console.log(`app ${appId}: subtitle(${m.subtitle.length}) ${r1.status==200?'OK':JSON.stringify(r1.body.errors).slice(0,150)} | desc/kw(${m.keywords.length}) ${r2.status==200?'OK':JSON.stringify(r2.body.errors).slice(0,200)}`);
}
