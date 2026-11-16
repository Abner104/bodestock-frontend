const admin = require('../functions/node_modules/firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('../functions/service-account.json')),
});

const db = admin.firestore();

async function main() {
  const companiesSnap = await db.collection('companies').get();
  for (const compDoc of companiesSnap.docs) {
    const data = compDoc.data();
    const invSnap = await db.collection(`companies/${compDoc.id}/inventories`).get();
    if (invSnap.size === 0) continue;
    console.log(`\n🏢 ${data.name || compDoc.id} (${compDoc.id})`);
    for (const inv of invSnap.docs) {
      const invData = inv.data();
      const prodsSnap = await db.collection(`companies/${compDoc.id}/inventories/${inv.id}/products`).get();
      console.log(`  📦 [${inv.id}] ${invData.name || '(sin nombre)'} — ${prodsSnap.size} productos`);
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
