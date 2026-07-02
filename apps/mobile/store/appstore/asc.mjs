import jwt from 'jsonwebtoken';
import fs from 'node:fs';
export const KEY_ID = '54F786QLW9';
export const ISSUER_ID = 'd4043b84-ff32-4cd9-bef8-a0d183c13991';
const P8 = '/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/AuthKey_54F786QLW9.p8';
export function token() {
  const key = fs.readFileSync(P8);
  return jwt.sign({}, key, {
    algorithm: 'ES256',
    keyid: KEY_ID,
    issuer: ISSUER_ID,
    audience: 'appstoreconnect-v1',
    expiresIn: '18m',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
  });
}
export async function asc(pathQ, opts = {}) {
  const res = await fetch('https://api.appstoreconnect.apple.com' + pathQ, {
    ...opts,
    headers: { Authorization: 'Bearer ' + token(), 'Content-Type': 'application/json', ...(opts.headers||{}) },
  });
  const text = await res.text();
  let body; try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
