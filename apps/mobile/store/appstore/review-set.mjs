import { asc } from './asc.mjs';
const NOTES = 'Log in on the first screen with the provided credentials. No OTP/2FA is required for these test accounts — login goes straight to the dashboard.';
const apps = {
  '6784023441': { demoName: 'reviewer@taptarea.com', demoPass: 'Review123!' },     // Tarea Home
  '6784029141': { demoName: 'test@taptarea.com',     demoPass: 'TareaTest2026!' },  // Tarea Pro
};
for (const [appId, a] of Object.entries(apps)) {
  const ver = await asc(`/v1/apps/${appId}/appStoreVersions`);
  const verId = ver.body.data[0].id;
  const attrs = {
    contactFirstName: 'Monseguea', contactLastName: 'Dah',
    contactEmail: 'leodam2905@gmail.com', contactPhone: '+12677521861',
    demoAccountRequired: true, demoAccountName: a.demoName, demoAccountPassword: a.demoPass,
    notes: NOTES,
  };
  const res = await asc('/v1/appStoreReviewDetails', { method:'POST', body: JSON.stringify({
    data: { type:'appStoreReviewDetails', attributes: attrs,
      relationships: { appStoreVersion: { data: { type:'appStoreVersions', id: verId } } } }
  })});
  console.log(`${appId}: ${res.status==201?'✅ OK':res.status+' '+JSON.stringify(res.body.errors).slice(0,300)}`);
}
