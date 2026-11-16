const admin = require('../functions/node_modules/firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert(require('../functions/service-account.json')),
});

const db = admin.firestore();

async function main() {
  const companyId = 'ypruiRJ9fKijEptCIyHb';
  const invId = 'minimarket-noemi';
  const basePath = `companies/${companyId}/inventories/${invId}`;

  // Eliminar todos los productos
  const prodsSnap = await db.collection(`${basePath}/products`).get();
  console.log(`Eliminando ${prodsSnap.size} productos...`);
  const batch = db.batch();
  prodsSnap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  console.log('✅ Productos eliminados');

  // Eliminar el documento del inventario
  await db.doc(basePath).delete();
  console.log('✅ Inventario minimarket-noemi eliminado');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
