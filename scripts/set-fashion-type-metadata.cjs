const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../functions/service-account.json')) });
const db = admin.firestore();

async function main() {
  const companyId = 'GuUQLAUuIRx6nyUfrJap';
  const invId = 'tonybodega';

  // Actualizar doc raíz
  await db.doc(`companies/${companyId}/inventories/${invId}`).update({ type: 'fashion' });
  console.log('✅ Doc raíz → type: fashion');

  // Actualizar metadata también
  const metaSnap = await db.collection(`companies/${companyId}/inventories/${invId}/metadata`).get();
  for (const metaDoc of metaSnap.docs) {
    await metaDoc.ref.update({ type: 'fashion' });
    console.log(`✅ Metadata ${metaDoc.id} → type: fashion`);
  }

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
