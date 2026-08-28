// Opens a Prisma-usable connection to the PRODUCTION database from a laptop.
//
// The DATABASE_URL in Secret Manager points at a unix socket
// (?host=/cloudsql/<conn>), which only exists inside Cloud Run. Handing that
// URL to Prisma locally fails with "Can't reach database server at
// /cloudsql/...:5432" — the socket is simply not there.
//
// So this fetches the secret, starts cloud-sql-proxy on a free port, and
// rewrites the URL to point at it. Callers get a URL that works and a close()
// that takes the proxy down again.
//
//   const db = await openCloudSql();
//   const prisma = new PrismaClient({ datasources: { db: { url: db.url } } });
//   ...
//   await db.close();
import { spawn, execFileSync } from 'node:child_process';
import net from 'node:net';

const ACCOUNT = process.env.GCLOUD_ACCOUNT
  ?? 'tarea-deployer@splendid-drake-497611-h6.iam.gserviceaccount.com';

const freePort = () =>
  new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolve(port));
    });
    s.on('error', reject);
  });

export async function openCloudSql() {
  // Always from Secret Manager, NEVER from process.env.DATABASE_URL.
  //
  // Importing @prisma/client loads apps/web/.env into process.env, and that
  // file holds a LOCAL dev URL. Preferring the environment therefore pointed a
  // production maintenance script at localhost, which found no rows and
  // reported "nothing to do" — the failure mode of a --delete run against the
  // wrong database does not bear thinking about. The secret is the only source
  // of truth for "production".
  const raw = execFileSync('gcloud', [
    'secrets', 'versions', 'access', 'latest',
    '--secret=DATABASE_URL', `--account=${ACCOUNT}`,
  ], { encoding: 'utf8' }).trim();

  const conn = raw.match(/[?&]host=\/cloudsql\/([^&]+)/)?.[1];
  if (!conn) {
    // Refuse rather than guess. A URL that is not the Cloud SQL socket form is
    // not the production database, and silently using it is how the wrong
    // server gets written to.
    throw new Error(
      'DATABASE_URL from Secret Manager is not a Cloud SQL socket URL — refusing to continue.',
    );
  }

  const token = execFileSync('gcloud',
    ['auth', 'print-access-token', `--account=${ACCOUNT}`], { encoding: 'utf8' }).trim();
  const port = await freePort();

  const proxy = spawn('cloud-sql-proxy',
    ['--token', token, '--port', String(port), conn],
    { stdio: ['ignore', 'pipe', 'pipe'] });

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('cloud-sql-proxy did not become ready')), 30000);
    const watch = (buf) => {
      const line = buf.toString();
      if (/ready for new connections/i.test(line)) { clearTimeout(timer); resolve(); }
      if (/error|refused|denied/i.test(line)) { clearTimeout(timer); reject(new Error(line.trim())); }
    };
    proxy.stdout.on('data', watch);
    proxy.stderr.on('data', watch);
    proxy.on('exit', (c) => { clearTimeout(timer); reject(new Error(`proxy exited (${c})`)); });
  });

  const url = raw
    .replace(/@[^/]*\//, `@127.0.0.1:${port}/`)
    .replace(/\?.*$/, '?sslmode=disable');

  return { url, close: async () => { proxy.kill(); } };
}
