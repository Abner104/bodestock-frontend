const admin = require('../functions/node_modules/firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('../functions/service-account.json')),
});

const db = admin.firestore();

async function main() {
  const companyId = 'ypruiRJ9fKijEptCIyHb';

  await db.doc(`companies/${companyId}/inventories/distribuidora-y-comercializadora-l-n`)
    .update({ name: 'Distribuidora L&N' });
  console.log('✅ Distribuidora L&N nombrada');

  await db.doc(`companies/${companyId}/inventories/minimarket-noemi`)
    .update({ name: 'Minimarket Noemí' });
  console.log('✅ Minimarket Noemí nombrado');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
