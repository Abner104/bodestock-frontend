// scripts/generate-pdf-guide.js
const fs = require('fs');
const path = require('path');
const { mdToPdf } = require('md-to-pdf');

const generatePDF = async () => {
  try {
    console.log('📄 Generando PDF de la Guía de Usuario...');

    const inputPath = path.join(__dirname, '..', 'GUIA_DE_USO_CLIENTES.md');
    const outputPath = path.join(__dirname, '..', 'GUIA_DE_USO_CLIENTES.pdf');
    const stylesheetPath = path.join(__dirname, 'pdf-styles.css');

    // Verificar que el archivo MD existe
    if (!fs.existsSync(inputPath)) {
      throw new Error('No se encontró el archivo GUIA_DE_USO_CLIENTES.md');
    }

    // Configuración del PDF
    const pdf = await mdToPdf(
      { path: inputPath },
      {
        dest: outputPath,
        stylesheet: [stylesheetPath],
        pdf_options: {
          format: 'A4',
          margin: {
            top: '2cm',
            right: '2cm',
            bottom: '2cm',
            left: '2cm'
          },
          printBackground: true,
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: `
            <div style="width: 100%; font-size: 9pt; padding: 0 2cm; display: flex; justify-content: space-between; color: #6b7280;">
              <span>Stockly - Guía de Usuario</span>
              <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
            </div>
          `
        }
      }
    );

    console.log('✅ PDF generado exitosamente en:', outputPath);
    console.log('📦 Tamaño:', (pdf.content.length / 1024).toFixed(2), 'KB');

    return outputPath;
  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    throw error;
  }
};

// Ejecutar si se llama directamente
if (require.main === module) {
  generatePDF()
    .then(outputPath => {
      console.log('\n🎉 ¡Listo! Tu guía en PDF está en:', outputPath);
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { generatePDF };
