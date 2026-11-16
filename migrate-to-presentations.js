// Script de migración: Sistema antiguo (conversion) → Sistema nuevo (presentations)
// Ejecutar UNA SOLA VEZ con: node migrate-to-presentations.js

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firestore';

// Configuración de Firebase (copia desde src/firebase/firebase.js)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_AUTH_DOMAIN",
  projectId: "TU_PROJECT_ID",
  storageBucket: "TU_STORAGE_BUCKET",
  messagingSenderId: "TU_MESSAGING_SENDER_ID",
  appId: "TU_APP_ID"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function migrateProducts() {
  console.log('🚀 Iniciando migración de productos...\n');

  try {
    // IMPORTANTE: Reemplaza 'YOUR_COMPANY_ID' con el ID real de tu empresa
    const companyId = 'YOUR_COMPANY_ID';
    const inventoryRef = collection(db, `companies/${companyId}/inventory`);
    const snapshot = await getDocs(inventoryRef);

    let totalProducts = 0;
    let migratedProducts = 0;
    let skippedProducts = 0;

    for (const docSnap of snapshot.docs) {
      totalProducts++;
      const product = docSnap.data();
      const productId = docSnap.id;

      console.log(`📦 Procesando: ${product.name} (${productId})`);

      // Verificar si tiene el sistema antiguo
      if (product.conversion && product.conversion.enabled) {
        console.log(`  ✅ Tiene conversión antigua: ${product.conversion.packagingUnit} (factor: ${product.conversion.factor})`);

        // Crear la nueva presentación
        const newPresentation = {
          id: Date.now().toString(),
          name: product.conversion.packagingUnit,
          factor: product.conversion.factor
        };

        // Actualizar el documento
        const docRef = doc(db, `companies/${companyId}/inventory`, productId);
        await updateDoc(docRef, {
          presentations: [newPresentation],
          conversion: null // Eliminar el campo antiguo
        });

        console.log(`  🔄 Migrado a presentations: [${newPresentation.name}]`);
        migratedProducts++;
      } else if (product.presentations && product.presentations.length > 0) {
        console.log(`  ⏭️  Ya tiene presentaciones, omitiendo...`);
        skippedProducts++;
      } else {
        console.log(`  ⏭️  No tiene conversiones, omitiendo...`);
        skippedProducts++;
      }

      console.log('');
    }

    console.log('═'.repeat(50));
    console.log('📊 RESUMEN DE MIGRACIÓN:');
    console.log(`   Total de productos: ${totalProducts}`);
    console.log(`   ✅ Migrados: ${migratedProducts}`);
    console.log(`   ⏭️  Omitidos: ${skippedProducts}`);
    console.log('═'.repeat(50));
    console.log('\n✨ Migración completada exitosamente!\n');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  }
}

// Ejecutar migración
migrateProducts();
