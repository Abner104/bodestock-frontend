// scripts/cleanup-companies.js
/**
 * Script para eliminar todas las empresas excepto 'botimarket'
 *
 * USO:
 * node scripts/cleanup-companies.js
 *
 * IMPORTANTE: Este script eliminará permanentemente todas las empresas
 * excepto aquella con el nombre exacto 'botimarket' (case-insensitive)
 */

const admin = require('firebase-admin');
const path = require('path');

// Inicializar Firebase Admin
const serviceAccountPath = path.join(__dirname, '../planilla-costos-backend/serviceAccountKey.json');

try {
  const serviceAccount = require(serviceAccountPath);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  console.log('✅ Firebase Admin inicializado correctamente');
} catch (error) {
  console.error('❌ Error inicializando Firebase Admin:', error.message);
  console.error('Asegúrate de que existe el archivo: planilla-costos-backend/serviceAccountKey.json');
  process.exit(1);
}

const db = admin.firestore();

/**
 * Elimina una empresa y todas sus subcolecciones
 */
async function deleteCompany(companyId, companyName) {
  try {
    console.log(`🗑️  Eliminando empresa: ${companyName} (${companyId})`);

    // Subcolecciones a eliminar
    const subcollections = ['products', 'inventory', 'workers', 'categories', 'exits', 'warehouses'];

    // Eliminar cada subcolección
    for (const subcollection of subcollections) {
      const subcollectionRef = db.collection(`companies/${companyId}/${subcollection}`);
      const snapshot = await subcollectionRef.get();

      if (!snapshot.empty) {
        const batch = db.batch();
        snapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`   ✓ Eliminados ${snapshot.size} documentos de ${subcollection}`);
      }
    }

    // Eliminar el documento principal de la empresa
    await db.collection('companies').doc(companyId).delete();
    console.log(`   ✓ Empresa eliminada completamente\n`);

    return true;
  } catch (error) {
    console.error(`   ❌ Error eliminando empresa ${companyName}:`, error.message);
    return false;
  }
}

/**
 * Función principal
 */
async function cleanup() {
  try {
    console.log('\n🔍 Buscando empresas en Firestore...\n');

    const companiesRef = db.collection('companies');
    const snapshot = await companiesRef.get();

    if (snapshot.empty) {
      console.log('ℹ️  No se encontraron empresas en la base de datos');
      return;
    }

    console.log(`📊 Total de empresas encontradas: ${snapshot.size}\n`);

    let deletedCount = 0;
    let skippedCount = 0;
    const companiesToKeep = ['botimarket'];

    // Listar todas las empresas primero
    console.log('📋 Listado de empresas:');
    console.log('─'.repeat(60));

    const companiesData = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      const companyName = data.name || 'Sin nombre';
      companiesData.push({
        id: doc.id,
        name: companyName,
        shouldKeep: companiesToKeep.some(name =>
          companyName.toLowerCase() === name.toLowerCase()
        )
      });
    });

    companiesData.forEach(company => {
      const status = company.shouldKeep ? '✅ MANTENER' : '❌ ELIMINAR';
      console.log(`${status} - ${company.name} (${company.id})`);
    });

    console.log('─'.repeat(60));
    console.log(`\n⚠️  SE ELIMINARÁN ${companiesData.filter(c => !c.shouldKeep).length} EMPRESAS`);
    console.log(`✅ SE MANTENDRÁN ${companiesData.filter(c => c.shouldKeep).length} EMPRESAS\n`);

    // Confirmación de usuario
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    await new Promise((resolve) => {
      rl.question('¿Deseas continuar? (escribe "SI" para confirmar): ', (answer) => {
        rl.close();
        if (answer.toUpperCase() !== 'SI') {
          console.log('\n❌ Operación cancelada por el usuario\n');
          process.exit(0);
        }
        resolve();
      });
    });

    console.log('\n🚀 Iniciando eliminación...\n');

    // Eliminar empresas
    for (const company of companiesData) {
      if (company.shouldKeep) {
        console.log(`✅ Manteniendo: ${company.name}`);
        skippedCount++;
      } else {
        const success = await deleteCompany(company.id, company.name);
        if (success) {
          deletedCount++;
        }
      }
    }

    // Resumen final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE LA OPERACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Empresas mantenidas: ${skippedCount}`);
    console.log(`🗑️  Empresas eliminadas: ${deletedCount}`);
    console.log(`❌ Errores: ${companiesData.length - deletedCount - skippedCount}`);
    console.log('='.repeat(60) + '\n');

    console.log('✅ Limpieza completada\n');

  } catch (error) {
    console.error('\n❌ Error durante la limpieza:', error);
  } finally {
    process.exit(0);
  }
}

// Ejecutar
cleanup();
