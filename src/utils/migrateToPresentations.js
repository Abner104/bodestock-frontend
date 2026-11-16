// Utilidad de migración: Sistema antiguo (conversion) → Sistema nuevo (presentations)
// Se ejecuta desde la consola del navegador o desde un botón en el admin

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Migra todos los productos con el sistema antiguo de conversion al nuevo sistema de presentations
 * @param {string} companyId - ID de la empresa
 * @returns {Promise<Object>} Estadísticas de la migración
 */
export async function migrateToPresentations(companyId) {
  console.log('🚀 Iniciando migración de productos a sistema de presentaciones...\n');

  const stats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    details: []
  };

  try {
    const inventoryRef = collection(db, `companies/${companyId}/inventory`);
    const snapshot = await getDocs(inventoryRef);

    for (const docSnap of snapshot.docs) {
      stats.total++;
      const product = docSnap.data();
      const productId = docSnap.id;

      try {
        // Caso 1: Tiene el sistema antiguo (conversion)
        if (product.conversion && product.conversion.enabled) {
          const oldConversion = product.conversion;

          // Crear la nueva presentación basada en la conversión antigua
          const newPresentation = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: oldConversion.packagingUnit,
            factor: oldConversion.factor
          };

          // Actualizar el documento
          const docRef = doc(db, `companies/${companyId}/inventory`, productId);
          await updateDoc(docRef, {
            presentations: [newPresentation],
            conversion: null // Eliminar el campo antiguo
          });

          stats.migrated++;
          stats.details.push({
            id: productId,
            name: product.name,
            action: 'migrated',
            from: `conversion: ${oldConversion.packagingUnit} (${oldConversion.factor})`,
            to: `presentations: [${newPresentation.name}]`
          });

          console.log(`✅ Migrado: ${product.name}`);
          console.log(`   De: conversion.${oldConversion.packagingUnit} = ${oldConversion.factor}`);
          console.log(`   A: presentations[${newPresentation.name}] = ${newPresentation.factor}\n`);

        }
        // Caso 2: Ya tiene presentations (no hacer nada)
        else if (product.presentations && product.presentations.length > 0) {
          stats.skipped++;
          stats.details.push({
            id: productId,
            name: product.name,
            action: 'skipped',
            reason: 'Ya tiene presentaciones'
          });
          console.log(`⏭️  Omitido: ${product.name} (ya tiene presentaciones)\n`);
        }
        // Caso 3: No tiene ni conversion ni presentations (producto simple)
        else {
          stats.skipped++;
          stats.details.push({
            id: productId,
            name: product.name,
            action: 'skipped',
            reason: 'No tiene conversiones (producto simple)'
          });
          console.log(`⏭️  Omitido: ${product.name} (producto simple, sin conversiones)\n`);
        }

      } catch (error) {
        stats.errors++;
        stats.details.push({
          id: productId,
          name: product.name,
          action: 'error',
          error: error.message
        });
        console.error(`❌ Error en ${product.name}:`, error.message, '\n');
      }
    }

    // Resumen final
    console.log('═'.repeat(60));
    console.log('📊 RESUMEN DE MIGRACIÓN:');
    console.log(`   Total de productos procesados: ${stats.total}`);
    console.log(`   ✅ Migrados exitosamente: ${stats.migrated}`);
    console.log(`   ⏭️  Omitidos: ${stats.skipped}`);
    console.log(`   ❌ Errores: ${stats.errors}`);
    console.log('═'.repeat(60));

    if (stats.migrated > 0) {
      console.log('\n✨ Migración completada exitosamente!');
      console.log('💡 Los productos ahora usan el nuevo sistema de presentaciones múltiples.\n');
    } else {
      console.log('\n💡 No se encontraron productos para migrar.\n');
    }

    return stats;

  } catch (error) {
    console.error('❌ Error general durante la migración:', error);
    throw error;
  }
}

/**
 * Función auxiliar para ejecutar la migración desde la consola del navegador
 * Ejemplo de uso:
 *   import { runMigration } from './utils/migrateToPresentation s';
 *   runMigration('tu-company-id-aqui');
 */
export async function runMigration(companyId) {
  if (!companyId) {
    console.error('❌ Error: Debes proporcionar el ID de la empresa');
    console.log('Uso: runMigration("tu-company-id")');
    return;
  }

  const confirmation = confirm(
    `⚠️ ADVERTENCIA: Estás a punto de migrar TODOS los productos de la empresa.\n\n` +
    `Esta acción:\n` +
    `1. Convertirá el sistema antiguo (conversion) al nuevo (presentations)\n` +
    `2. Eliminará el campo "conversion" de los productos migrados\n` +
    `3. Es IRREVERSIBLE sin un backup\n\n` +
    `¿Deseas continuar?`
  );

  if (!confirmation) {
    console.log('❌ Migración cancelada por el usuario');
    return;
  }

  try {
    const stats = await migrateToPresentations(companyId);
    return stats;
  } catch (error) {
    console.error('❌ La migración falló:', error);
    throw error;
  }
}
