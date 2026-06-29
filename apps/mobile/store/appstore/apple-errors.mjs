import { asc } from './asc.mjs';
for (const [name, appId] of [['Tarea Home','6784023441'],['Tarea Pro','6784029141']]) {
  console.log(`\n=== ${name} ===`);
  // existing review submissions
  const rs = await asc(`/v1/apps/${appId}/reviewSubmissions?limit=10`);
  for (const s of (rs.body.data||[])) {
    console.log(`  reviewSubmission ${s.id} state=${s.attributes.state} submitted=${s.attributes.submitted} canceled=${s.attributes.canceled}`);
    // delete stuck/incomplete ones (state READY_FOR_REVIEW not submitted -> delete)
    if (s.attributes.state === 'READY_FOR_REVIEW' && !s.attributes.submitted) {
      const d = await asc(`/v1/reviewSubmissions/${s.id}`, { method:'DELETE' });
      console.log('    -> deleted stuck submission:', d.status);
    }
  }
  // check app-level appInfo state + app privacy hint
  const ai = await asc(`/v1/apps/${appId}/appInfos`);
  console.log('  appInfo state:', ai.body.data[0].attributes.state);
}
