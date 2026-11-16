const admin = require('../functions/node_modules/firebase-admin');
admin.initializeApp({ credential: admin.credential.cert(require('../functions/service-account.json')) });
const db = admin.firestore();

async function main() {
  const companyId = 'ypruiRJ9fKijEptCIyHb'; // Distribuidora L&N

  // Clientes
  const clientesSnap = await db.collection(`companies/${companyId}/customers`).get();
  console.log(`\n📋 CLIENTES (${clientesSnap.size} total)\n`);

  let totalDeuda = 0;
  let clientesConDeuda = 0;
  let clientesSinDeuda = 0;

  clientesSnap.docs.forEach(doc => {
    const d = doc.data();
    const deuda = d.saldoPendiente || d.deuda || d.balance || 0;
    if (deuda > 0) {
      clientesConDeuda++;
      totalDeuda += deuda;
    } else {
      clientesSinDeuda++;
    }
    console.log(`- ${d.razonSocial || d.nombre || 'Sin nombre'} | RUT: ${d.rut || 'N/A'} | Tel: ${d.telefono || 'N/A'} | Deuda: $${deuda.toLocaleString('es-CL')} | Campos: ${Object.keys(d).join(', ')}`);
  });

  console.log(`\n📊 RESUMEN:`);
  console.log(`Total clientes: ${clientesSnap.size}`);
  console.log(`Con deuda: ${clientesConDeuda}`);
  console.log(`Sin deuda: ${clientesSinDeuda}`);
  console.log(`Deuda total: $${totalDeuda.toLocaleString('es-CL')}`);

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
