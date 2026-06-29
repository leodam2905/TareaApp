import { asc } from './asc.mjs';
async function setup(name, appId) {
  console.log(`\n=== ${name} ===`);
  // get the valid build id
  const builds = await asc(`/v1/builds?filter[app]=${appId}&limit=1`);
  const buildId = builds.body.data?.[0]?.id;
  if (!buildId) { console.log('  no build'); return; }
  // create internal beta group
  let grp = await asc('/v1/betaGroups', { method:'POST', body: JSON.stringify({
    data: { type:'betaGroups', attributes: { name:'Internal Testers', isInternalGroup:true },
      relationships: { app:{ data:{ type:'apps', id:appId } } } }
  })});
  let groupId;
  if (grp.status===201) { groupId = grp.body.data.id; console.log('  created internal group', groupId); }
  else { console.log('  group create:', grp.status, JSON.stringify(grp.body.errors?.[0]?.detail||grp.body).slice(0,160)); 
    // maybe one exists
    const g = await asc(`/v1/apps/${appId}/betaGroups?limit=10`);
    groupId = g.body.data?.find(x=>x.attributes.isInternalGroup)?.id; console.log('  using existing group', groupId);
  }
  if (!groupId) return;
  // attach build to group
  const ab = await asc(`/v1/betaGroups/${groupId}/relationships/builds`, { method:'POST', body: JSON.stringify({ data:[{ type:'builds', id:buildId }] })});
  console.log('  attach build:', ab.status===204?'OK':ab.status+' '+JSON.stringify(ab.body?.errors?.[0]?.detail||'').slice(0,120));
  // add tester
  const t = await asc('/v1/betaTesters', { method:'POST', body: JSON.stringify({
    data: { type:'betaTesters', attributes:{ email:'leodam2905@gmail.com', firstName:'Monseguea', lastName:'Dah' },
      relationships:{ betaGroups:{ data:[{ type:'betaGroups', id:groupId }] } } }
  })});
  console.log('  add tester:', t.status===201?'OK ✅':t.status+' '+JSON.stringify(t.body?.errors?.[0]?.detail||'').slice(0,160));
}
await setup('Tarea Home','6784023441');
await setup('Tarea Pro','6784029141');
