import { asc } from './asc.mjs';
const r = await asc('/v1/appCategories?limit=200&filter[platforms]=IOS');
const ids = (r.body.data||[]).map(c=>c.id).filter(id=>!id.includes('.')); // top-level only
console.log('top-level categories:', ids.join(', '));
