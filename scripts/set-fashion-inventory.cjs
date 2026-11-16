const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../functions/service-account.json')) });
const db = admin.firestore();

async function main() {
  const companyId = 'GuUQLAUuIRx6nyUfrJap';
  const invId = 'tonybodega';
  await db.doc(`companies/${companyId}/inventories/${invId}`).update({ type: 'fashion' });
  console.log('✅ Inventario tonybodega → type: fashion');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
