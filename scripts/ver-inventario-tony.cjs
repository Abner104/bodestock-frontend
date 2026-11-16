const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../functions/service-account.json')) });
const db = admin.firestore();

async function main() {
  const companyId = 'GuUQLAUuIRx6nyUfrJap'; // Tonylisfashionstyle
  const invSnap = await db.collection(`companies/${companyId}/inventories`).get();
  for (const inv of invSnap.docs) {
    console.log(`ID: ${inv.id}`);
    console.log('Datos:', JSON.stringify(inv.data(), null, 2));
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
