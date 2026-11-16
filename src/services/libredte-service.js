// src/services/libredte-service.js
// Servicio para integración con LibreDTE - Facturación Electrónica SII Chile

import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId } from './companyService.js';
import { FUNCTIONS_ENDPOINTS } from '../config/functions.js';

// SimpleFactura usa Basic Auth - las credenciales se envían a la Cloud Function
// para que genere el header server-side (evita problemas con btoa y caracteres especiales)

/**
 * Convierte un mensaje de error crudo de SimpleFactura/LibreDTE en un mensaje
 * claro para el usuario. Si no reconoce el patrón, devuelve el mensaje original.
 */
function humanizeDteError(rawMessage) {
  const msg = String(rawMessage || '');

  // "Emisor con sucursal y con rut X no encontrado o no está activo"
  // → casi siempre es la cuenta de SimpleFactura suspendida por falta de pago,
  //   o el emisor/sucursal mal configurado en el panel de SimpleFactura.
  if (/emisor.*(no encontrado|no est[aá] activo)/i.test(msg)) {
    return 'No se pudo emitir el documento: la cuenta de facturación electrónica (SimpleFactura) está ' +
      'inactiva o suspendida. Revisá que la suscripción de SimpleFactura esté al día y que el emisor ' +
      'esté activo en su panel, o contactá a soporte.';
  }

  // Credenciales inválidas / no autorizado
  if (/unauthorized|invalid.*credential|401/i.test(msg)) {
    return 'No se pudo emitir el documento: las credenciales de SimpleFactura son incorrectas o vencieron. ' +
      'Revisá el usuario y contraseña en Ajustes > Facturación.';
  }

  // Rate limit / demasiadas solicitudes
  if (/rate.?limit|429|demasiadas solicitudes/i.test(msg)) {
    return 'SimpleFactura está recibiendo demasiadas solicitudes en este momento. Esperá un minuto y volvé a intentar.';
  }

  return msg;
}

/**
 * Formatea un RUT al formato requerido por el SII: XXXXXXXX-X
 * Acepta: "781757098", "78175709-8", "78.175.709-8"
 */
function formatRutSII(rut) {
  if (!rut) return rut;
  // Eliminar puntos y espacios
  let clean = String(rut).replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  // Si ya tiene guión, devolver limpio
  if (clean.includes('-')) return clean;
  // Insertar guión antes del último carácter
  return clean.slice(0, -1) + '-' + clean.slice(-1);
}

/**
 * Obtener configuración de LibreDTE desde Firestore
 * @returns {Promise<Object|null>}
 */
export const getLibreDTEConfig = async () => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId');
    }

    const configDoc = await getDoc(doc(db, `companies/${companyId}/settings/libredte`));

    if (!configDoc.exists()) {
      console.warn('⚠️ Configuración de LibreDTE no encontrada');
      return null;
    }

    return configDoc.data();
  } catch (error) {
    console.error('❌ Error obteniendo configuración de LibreDTE:', error);
    return null;
  }
};

/**
 * Guardar configuración de LibreDTE en Firestore
 * @param {Object} config - { apiUrl, hash, rutEmisor, razonSocial, giro, direccion, comuna }
 */
export const saveLibreDTEConfig = async (config) => {
  try {
    const companyId = await getUserCompanyId();
    if (!companyId) {
      throw new Error('No se pudo obtener el companyId');
    }

    await updateDoc(doc(db, `companies/${companyId}/settings/libredte`), {
      ...config,
      updatedAt: new Date()
    });

    console.log('✅ Configuración de LibreDTE guardada');
  } catch (error) {
    console.error('❌ Error guardando configuración de LibreDTE:', error);
    throw error;
  }
};

/**
 * Emitir una boleta electrónica a través de SimpleFactura
 * @param {Object} exitData - Datos de la salida/venta
 * @param {Object} options - { tipoDTE: 39 (boleta) o 33 (factura), receptorData: { rut, razonSocial, direccion, comuna } }
 * @returns {Promise<Object>} - { success, folio, pdf, xml, trackId }
 */
const MAX_DTE_LINES = 24;

// Helper: construye el objeto DTE para un chunk de productos
const _buildDTEData = (config, tipoDTE, receptor, productos) => {
  const neto = productos.reduce((sum, p) => {
    const precio = (p.unitValue || p.ppp || 0) / 1.19;
    return sum + Math.round(p.quantity * precio);
  }, 0);
  const iva = Math.round(neto * 0.19);
  const total = neto + iva;

  return {
    Documento: {
      Encabezado: {
        IdDoc: {
          TipoDTE: tipoDTE,
          FchEmis: new Date().toISOString().split('T')[0],
          FmaPago: 1,
        },
        Emisor: {
          RUTEmisor: config.rutEmisor,
          RznSoc: config.razonSocial || '',
          GiroEmis: config.giro || '',
          Acteco: [parseInt(config.actividadEconomica) || 0],
          DirOrigen: config.direccion || '',
          CmnaOrigen: config.comuna || 'Santiago',
          CiudadOrigen: config.ciudad || config.comuna || 'Santiago'
        },
        Receptor: receptor,
        Totales: { MntNeto: neto, TasaIVA: 19, IVA: iva, MntTotal: total }
      },
      Detalle: productos.map((product, index) => {
        const precio = (product.unitValue || product.ppp || 0) / 1.19;
        return {
          NroLinDet: index + 1,
          NmbItem: product.productName || 'Producto sin nombre',
          QtyItem: product.quantity || 1,
          UnmdItem: product.unit || 'un',
          PrcItem: Math.round(precio * 1000000) / 1000000,
          MontoItem: Math.round(product.quantity * precio)
        };
      })
    }
  };
};

export const emitirBoleta = async (exitData, options = {}) => {
  try {
    const { tipoDTE = 39, receptorData = null, onSplitNotice } = options;
    console.log(`📋 Iniciando emisión de ${tipoDTE === 33 ? 'factura' : 'boleta'}...`, exitData);

    // 1. Obtener configuración
    const config = await getLibreDTEConfig();
    const proveedor = config?.proveedor || 'simplefactura';
    const tieneCredenciales = proveedor === 'simplefactura' ? (config?.sfEmail && config?.sfPassword) : config?.apiKey;

    if (!config || !tieneCredenciales || !config.rutEmisor) {
      throw new Error('Configuración de facturación electrónica incompleta. Configura las credenciales en Ajustes.');
    }

    if (tipoDTE === 33 && !receptorData) {
      throw new Error('Para emitir facturas se requiere información del receptor (RUT, razón social, etc.)');
    }

    // 2. Preparar receptor
    const receptor = tipoDTE === 33 && receptorData
      ? {
          RUTRecep: formatRutSII(receptorData.rut),
          RznSocRecep: receptorData.razonSocial,
          GiroRecep: receptorData.giro || 'Particular',
          DirRecep: receptorData.direccion || 'Sin dirección',
          CmnaRecep: receptorData.comuna || 'Santiago',
          CiudadRecep: receptorData.ciudad || receptorData.comuna || 'Santiago'
        }
      : {
          RUTRecep: '66666666-6',
          RznSocRecep: 'Cliente Genérico',
          GiroRecep: 'Particular',
          DirRecep: 'Sin dirección',
          CmnaRecep: 'Santiago',
          CiudadRecep: 'Santiago'
        };

    // 3. Dividir productos en chunks de MAX_DTE_LINES
    const productos = exitData.products || [];
    const chunks = [];
    for (let i = 0; i < productos.length; i += MAX_DTE_LINES) {
      chunks.push(productos.slice(i, i + MAX_DTE_LINES));
    }

    // 4. Avisar al usuario si se va a dividir en múltiples documentos
    if (chunks.length > 1 && onSplitNotice) {
      onSplitNotice(chunks.length, productos.length);
    }

    // 5. Construir todos los DTEs y enviarlos en una sola llamada (evita rate-limit del /token de SimpleFactura)
    const tipoDocumento = tipoDTE === 33 ? 'Factura Electrónica' : 'Boleta Electrónica';
    const dtesData = chunks.map(chunk => _buildDTEData(config, tipoDTE, receptor, chunk));

    console.log(`📦 Enviando ${dtesData.length} ${tipoDocumento}(s) en una sola llamada...`);

    let response;

    if (proveedor === 'simplefactura') {
      const sucursal = config.sucursal || 'Casa Matriz';
      const sfApiUrl = `https://api.simplefactura.cl/invoiceV2/${encodeURIComponent(sucursal)}`;
      response = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_EMITIR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: sfApiUrl,
          sfEmail: config.sfEmail,
          sfPassword: config.sfPassword,
          dtesData
        })
      });
    } else {
      // Para otros proveedores, emitir en secuencia (no tienen rate-limit de token)
      const ambiente = config.ambiente || 'certificacion';
      let apiUrl, headers;
      switch (proveedor) {
        case 'libredte':
          apiUrl = 'https://libredte.cl/api/dte/documentos/emitir';
          headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` };
          break;
        case 'chilesystems':
          apiUrl = ambiente === 'produccion' ? 'https://api.chilesystems.com/dte/emitir' : 'https://apicert.chilesystems.com/dte/emitir';
          headers = { 'Content-Type': 'application/json', 'apikey': config.apiKey };
          break;
        case 'manual':
          apiUrl = config.apiUrl;
          headers = { 'Content-Type': 'application/json', 'Authorization': config.apiKey };
          break;
        default:
          throw new Error(`Proveedor desconocido: ${proveedor}`);
      }
      const otherResults = [];
      for (const dteData of dtesData) {
        const r = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(dteData) });
        if (!r.ok) throw new Error(`Error HTTP ${r.status}`);
        otherResults.push(await r.json());
      }
      const foliosOther = otherResults.map(r => r.folio || r.data?.folio).filter(Boolean);
      const primerOther = otherResults[0];
      return {
        success: true, tipoDTE, tipoDocumento,
        folio: foliosOther[0],
        folios: foliosOther.length > 1 ? foliosOther : undefined,
        documentosEmitidos: otherResults.length,
        trackId: primerOther.trackId || primerOther.data?.trackId,
        pdf: primerOther.pdf || primerOther.data?.pdf,
        xml: primerOther.xml || primerOther.data?.xml,
        estado: primerOther.estado || primerOther.data?.estado || 'EMITIDO',
        mensaje: otherResults.length > 1
          ? `${otherResults.length} ${tipoDocumento}s emitidas. Folios: ${foliosOther.join(', ')}`
          : `${tipoDocumento} emitida correctamente`
      };
    }

    if (!response.ok) {
      const errorText = await response.text();
      let parsedMessage = null;
      try {
        const errorData = JSON.parse(errorText);
        parsedMessage = errorData.message || errorData.error || null;
      } catch { /* respuesta no era JSON */ }
      throw new Error(humanizeDteError(parsedMessage || `Error HTTP ${response.status}: ${errorText}`));
    }

    const batchResult = await response.json();
    console.log('✅ Respuesta batch:', batchResult);

    // La Cloud Function retorna { success, resultados: [...], total } para múltiples DTEs
    const resultados = batchResult.resultados || [batchResult];
    const folios = resultados.map(r => r.folio || r.data?.folio).filter(Boolean);

    // 6. Retornar resultado
    const primerResult = resultados[0];

    return {
      success: true,
      tipoDTE,
      tipoDocumento,
      folio: folios[0],
      folios: folios.length > 1 ? folios : undefined,
      documentosEmitidos: chunks.length,
      trackId: primerResult.trackId || primerResult.data?.trackId,
      pdf: primerResult.pdfStorageUrl || primerResult.pdf || primerResult.data?.pdf,
      xml: primerResult.xml || primerResult.data?.xml,
      estado: primerResult.estado || primerResult.data?.estado || 'EMITIDO',
      mensaje: chunks.length > 1
        ? `${chunks.length} ${tipoDocumento}s emitidas. Folios: ${folios.join(', ')}`
        : `${tipoDocumento} emitida correctamente`
    };

  } catch (error) {
    console.error(`❌ Error emitiendo ${options.tipoDTE === 33 ? 'factura' : 'boleta'}:`, error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Obtener PDF de un DTE emitido desde SimpleFactura
 * @param {number} folio - Número de folio del documento
 * @param {number} tipoDTE - Tipo de DTE (33, 39, 52)
 * @returns {Promise<Object>} - { success, pdfBase64 } o { success: false, error }
 */
export const obtenerPdfDTE = async (folio, tipoDTE) => {
  try {
    const config = await getLibreDTEConfig();
    if (!config?.sfEmail || !config?.sfPassword) {
      throw new Error('Credenciales de SimpleFactura no configuradas');
    }

    // SimpleFactura: ambiente 1 = producción, 0 = certificación
    const ambiente = (config.ambiente === 'produccion') ? 1 : 0;

    const response = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_PDF, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sfEmail: config.sfEmail,
        sfPassword: config.sfPassword,
        credenciales: {
          rutEmisor: config.rutEmisor,
          nombreSucursal: config.sucursal || 'Casa Matriz'
        },
        dteReferenciadoExterno: {
          folio: Number(folio),
          codigoTipoDte: Number(tipoDTE),
          ambiente: ambiente
        }
      })
    });

    if (!response.ok) {
      let errorMsg = `Error ${response.status}`;
      try {
        const errJson = await response.json();
        // Mostrar el detalle de SimpleFactura si existe, sino el error genérico
        errorMsg = errJson.detail || errJson.error || errJson.message || errorMsg;
      } catch {
        const errText = await response.text().catch(() => '');
        if (errText) errorMsg = errText.slice(0, 300);
      }
      throw new Error(humanizeDteError(errorMsg));
    }

    const result = await response.json();

    if (result.pdfBase64) {
      return { success: true, pdfBase64: result.pdfBase64 };
    }

    const serverError = result.error || result.message || 'No se recibió el PDF desde SimpleFactura';
    throw new Error(humanizeDteError(serverError));
  } catch (error) {
    console.error('❌ Error obteniendo PDF:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Emitir una factura electrónica a través de LibreDTE
 * Alias de emitirBoleta con tipoDTE = 33
 * @param {Object} exitData - Datos de la salida/venta
 * @param {Object} receptorData - { rut, razonSocial, direccion, comuna }
 * @returns {Promise<Object>} - { success, folio, pdf, xml, trackId }
 */
export const emitirFactura = async (exitData, receptorData) => {
  return emitirBoleta(exitData, { tipoDTE: 33, receptorData });
};

/**
 * Emitir una Guía de Despacho Electrónica (Tipo 52)
 * Documento de transporte de mercadería - OBLIGATORIO para traslados antes de facturar
 * @param {Object} exitData - Datos de la salida/venta
 * @param {Object} transportData - Datos del transporte y receptor
 * @returns {Promise<Object>} - { success, folio, pdf, xml, trackId }
 */
export const emitirGuiaDespacho = async (exitData, transportData) => {
  try {
    console.log('📋 Iniciando emisión de Guía de Despacho (Tipo 52)...', exitData);

    // 1. Obtener configuración
    const config = await getLibreDTEConfig();
    const proveedor = config?.proveedor || 'simplefactura';

    // Validar credenciales según proveedor
    const tieneCredenciales = proveedor === 'simplefactura'
      ? (config?.sfEmail && config?.sfPassword)
      : config?.apiKey;

    if (!config || !tieneCredenciales || !config.rutEmisor) {
      throw new Error('Configuración de facturación electrónica incompleta. Configura las credenciales en Ajustes.');
    }

    // 2. Validar datos del receptor (OBLIGATORIO para Guías de Despacho)
    if (!transportData || !transportData.rut || !transportData.razonSocial) {
      throw new Error('Para emitir Guías de Despacho se requiere información del receptor (RUT y Razón Social)');
    }

    // 3. Preparar datos del receptor
    const receptor = {
      RUTRecep: transportData.rut,
      RznSocRecep: transportData.razonSocial,
      GiroRecep: transportData.giro || 'Particular',
      DirRecep: transportData.direccion || 'Sin dirección',
      CmnaRecep: transportData.comuna || 'Sin comuna'
    };

    // 4. Preparar datos del transporte (OBLIGATORIO para Guía de Despacho)
    const transporte = {
      Patente: transportData.patente || '', // Patente del vehículo (ej: ABCD12)
      RUTTrans: transportData.rutTransportista || config.rutEmisor, // RUT del transportista
      Chofer: {
        RUTChofer: transportData.rutChofer || '',
        NombreChofer: transportData.nombreChofer || 'Por definir'
      },
      DirDest: transportData.direccionDestino || transportData.direccion || 'Sin dirección',
      CmnaDest: transportData.comunaDestino || transportData.comuna || 'Sin comuna'
    };

    // 5. Preparar DTE Guía de Despacho (formato SimpleFactura API)
    const neto = Math.round(exitData.totalValue / 1.19);
    const iva = Math.round(exitData.totalValue - neto);
    const total = Math.round(exitData.totalValue);

    const dteData = {
      Documento: {
        Encabezado: {
          IdDoc: {
            TipoDTE: 52,
            FchEmis: new Date().toISOString().split('T')[0],
            IndTraslado: transportData.tipoTraslado || 1,
            TipoDespacho: 1,
            IndServicio: 3
          },
          Emisor: {
            RUTEmisor: config.rutEmisor,
            RznSoc: config.razonSocial || '',
            GiroEmis: config.giro || '',
            Acteco: [parseInt(config.actividadEconomica) || 0],
            DirOrigen: config.direccion || '',
            CmnaOrigen: config.comuna || 'Santiago',
            CiudadOrigen: config.ciudad || config.comuna || 'Santiago'
          },
          Receptor: receptor,
          Transporte: transporte,
          Totales: {
            MntNeto: neto,
            TasaIVA: 19,
            IVA: iva,
            MntTotal: total
          }
        },
        Detalle: (exitData.products || []).map((product, index) => {
          const precio = (product.unitValue || product.ppp || 0) / 1.19;
          return {
            NroLinDet: index + 1,
            NmbItem: product.productName || 'Producto sin nombre',
            QtyItem: product.quantity || 1,
            UnmdItem: product.unit || 'un',
            PrcItem: Math.round(precio * 1000000) / 1000000,
            MontoItem: Math.round(product.quantity * precio)
          };
        })
      }
    };

    console.log(`📦 Guía de Despacho preparada para ${proveedor}:`, dteData);

    // 6. Determinar URL y headers según proveedor
    const ambiente = config.ambiente || 'certificacion';
    let apiUrl, headers;

    let response;

    if (proveedor === 'simplefactura') {
      // SimpleFactura: usar Cloud Function proxy para evitar CORS
      const sucursal = config.sucursal || 'Casa Matriz';
      const sfApiUrl = `https://api.simplefactura.cl/invoiceV2/${encodeURIComponent(sucursal)}`;

      console.log(`🌍 Emitiendo Guía de Despacho en ambiente: ${ambiente.toUpperCase()}`);
      console.log(`🔗 Proveedor: ${proveedor} (via proxy)`);
      console.log(`🔗 Endpoint destino: ${sfApiUrl}`);

      response = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_EMITIR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: sfApiUrl,
          sfEmail: config.sfEmail,
          sfPassword: config.sfPassword,
          dteData
        })
      });
    } else {
      // Otros proveedores: llamada directa
      switch (proveedor) {
        case 'libredte':
          apiUrl = 'https://libredte.cl/api/dte/documentos/emitir';
          headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${config.apiKey}`
          };
          break;

        case 'chilesystems':
          apiUrl = ambiente === 'produccion'
            ? 'https://api.chilesystems.com/dte/emitir'
            : 'https://apicert.chilesystems.com/dte/emitir';
          headers = {
            'Content-Type': 'application/json',
            'apikey': config.apiKey
          };
          break;

        case 'manual':
          apiUrl = config.apiUrl;
          headers = {
            'Content-Type': 'application/json',
            'Authorization': config.apiKey
          };
          break;

        case 'sii_directo':
          apiUrl = ambiente === 'produccion'
            ? 'https://maullin.sii.cl/cgi_dte/UPL/DTEUpload'
            : 'https://pangal.sii.cl/cgi_dte/UPL/DTEUpload';
          headers = {
            'Content-Type': 'application/xml',
            'RutEmisor': config.rutEmisor,
            'RutEnvia': config.rutEmisor,
            'RutCompania': config.rutEmisor
          };
          break;

        default:
          throw new Error(`Proveedor desconocido: ${proveedor}`);
      }

      console.log(`🌍 Emitiendo Guía de Despacho en ambiente: ${ambiente.toUpperCase()}`);
      console.log(`🔗 Proveedor: ${proveedor}`);
      console.log(`🔗 Endpoint: ${apiUrl}`);

      response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(dteData)
      });
    }

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', errorText);

      let parsedMessage = null;
      try {
        const errorData = JSON.parse(errorText);
        parsedMessage = errorData.message || errorData.error || null;
      } catch { /* respuesta no era JSON */ }
      throw new Error(humanizeDteError(parsedMessage || `Error HTTP ${response.status}: ${errorText}`));
    }

    const result = await response.json();
    console.log('✅ Guía de Despacho emitida:', result);

    return {
      success: true,
      tipoDTE: 52,
      tipoDocumento: 'Guía de Despacho Electrónica',
      folio: result.folio || result.data?.folio,
      trackId: result.trackId || result.data?.trackId,
      pdf: result.pdf || result.data?.pdf,
      xml: result.xml || result.data?.xml,
      estado: result.estado || result.data?.estado || 'EMITIDO',
      mensaje: result.mensaje || 'Guía de Despacho emitida correctamente'
    };

  } catch (error) {
    console.error('❌ Error emitiendo Guía de Despacho:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Consultar estado de un DTE en el SII
 * @param {number} folio - Folio del DTE
 * @param {number} tipoDTE - Tipo de DTE (39 = Boleta)
 * @returns {Promise<Object>}
 */
export const consultarEstadoDTE = async (folio, tipoDTE = 39) => {
  try {
    const config = await getLibreDTEConfig();
    if (!config || !config.hash) {
      throw new Error('Configuración de LibreDTE no disponible');
    }

    const apiUrl = config.apiUrl || 'https://libredte.cl';
    const response = await fetch(`${apiUrl}/api/dte/documentos/estado/${tipoDTE}/${folio}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.hash}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('❌ Error consultando estado DTE:', error);
    throw error;
  }
};

/**
 * Descargar PDF de una boleta
 * @param {string} pdfUrl - URL del PDF
 */
export const descargarPDF = async (pdfUrl) => {
  try {
    const response = await fetch(pdfUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boleta_${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('❌ Error descargando PDF:', error);
    throw error;
  }
};

/**
 * Emitir una Nota de Crédito Electrónica (Tipo 61)
 * Anula total o parcialmente un documento original (factura o boleta)
 * @param {Object} docOriginal - { tipoDTE, folio, fechaEmision, receptor, total, items }
 * @param {string} motivo - Motivo de la NC (ej: "Devolución de productos")
 * @returns {Promise<Object>} - { success, folio, tipoDTE: 61, tipoDocumento: "Nota de Crédito" }
 */
export const emitirNotaCredito = async (docOriginal, motivo = 'Devolución de productos') => {
  try {
    console.log('📋 Iniciando emisión de Nota de Crédito (Tipo 61)...', docOriginal);

    // 1. Obtener configuración
    const config = await getLibreDTEConfig();
    const proveedor = config?.proveedor || 'simplefactura';

    const tieneCredenciales = proveedor === 'simplefactura'
      ? (config?.sfEmail && config?.sfPassword)
      : config?.apiKey;

    if (!config || !tieneCredenciales || !config.rutEmisor) {
      throw new Error('Configuración de facturación electrónica incompleta.');
    }

    // 2. Validar datos del documento original
    if (!docOriginal.tipoDTE || !docOriginal.folio) {
      throw new Error('Se requiere el tipo y folio del documento original');
    }

    // 3. Preparar receptor con campos exactos del SII
    const r = docOriginal.receptor || {};
    const receptor = {
      RUTRecep:    r.RUTRecep    || r.rut           || '66666666-6',
      RznSocRecep: r.RznSocRecep || r.razonSocial   || 'Cliente Genérico',
      GiroRecep:   r.GiroRecep   || r.giro          || 'Sin giro',
      DirRecep:    r.DirRecep    || r.direccion     || 'Sin dirección',
      CmnaRecep:   r.CmnaRecep   || r.comuna        || 'Santiago',
      CiudadRecep: r.CiudadRecep || r.ciudad        || r.comuna || 'Santiago'
    };

    // 4. Preparar montos (mismos del documento original)
    const total = Math.round(docOriginal.total || 0);
    const neto = Math.round(total / 1.19);
    const iva = Math.round(total - neto);

    // 5. Preparar detalle (mismos items del documento original)
    const detalle = (docOriginal.items || []).map((product, index) => {
      const precio = (product.unitValue || product.ppp || 0) / 1.19;
      const monto = Math.round((product.quantity || 1) * precio);
      return {
        NroLinDet: index + 1,
        NmbItem: product.productName || product.NmbItem || 'Producto',
        QtyItem: product.quantity || product.QtyItem || 1,
        UnmdItem: product.unit || product.UnmdItem || 'un',
        PrcItem: Math.round(precio * 1000000) / 1000000,
        MontoItem: monto
      };
    });

    // Si no hay items, crear un detalle genérico con el total
    const detalleRenderizado = detalle.length > 0 ? detalle : [{
      NroLinDet: 1,
      NmbItem: 'Anulación documento completo',
      QtyItem: 1,
      UnmdItem: 'un',
      PrcItem: neto,
      MontoItem: neto
    }];

    // 6. Construir DTE tipo 61
    // invoiceCreditDebitNotesV2 espera { Documento: { ... } } — igual que invoiceV2, sin wrapper "dte"
    // FchRef se serializa como "FechaDocumentoReferenciaString" según el SDK de SimpleFactura
    const fechaRef = docOriginal.fechaEmision || new Date().toISOString().split('T')[0];
    const dteData = {
      Documento: {
        Encabezado: {
          IdDoc: {
            TipoDTE: 61,
            FchEmis: new Date().toISOString().split('T')[0],
            FmaPago: 2  // 2 = Crédito (requerido para NC)
          },
          Emisor: {
            RUTEmisor: config.rutEmisor,
            RznSoc: config.razonSocial || '',
            GiroEmis: config.giro || '',
            Acteco: [parseInt(config.actividadEconomica) || 0],
            DirOrigen: config.direccion || '',
            CmnaOrigen: config.comuna || 'Santiago',
            CiudadOrigen: config.ciudad || config.comuna || 'Santiago'
          },
          Receptor: receptor,
          Totales: {
            MntNeto: neto,
            TasaIVA: 19,
            IVA: iva,
            MntTotal: total
          }
        },
        Detalle: detalleRenderizado,
        Referencia: [{
          NroLinRef: 1,
          TpoDocRef: String(docOriginal.tipoDTE),
          FolioRef: String(docOriginal.folio),
          FechaDocumentoReferenciaString: fechaRef,  // nombre exacto del SDK
          CodRef: 1,  // 1 = AnulaDocumentoReferencia
          RazonRef: motivo
        }]
      }
    };

    console.log('📦 Nota de Crédito preparada:', JSON.stringify(dteData, null, 2));

    // 7. Emitir via SimpleFactura usando endpoint específico para NC/ND
    // ReasonTypeEnum: 1=ErrorDigitacion, 2=ReclamoCliente, 3=DatosDesactualizados, 6=Otros
    const motivoMap = {
      'Devolución de productos': 2,
      'Devolución': 2,
      'Error de digitación': 1,
      'Error digitación': 1,
      'Datos desactualizados': 3,
      'Intereses por mora': 4,
      'Intereses por cambio de fecha': 5,
    };
    const motivoNum = motivoMap[motivo] || 6; // default: Otros

    let response;

    if (proveedor === 'simplefactura') {
      const sucursal = config.sucursal || 'Casa Matriz';
      const sfApiUrl = `https://api.simplefactura.cl/invoiceCreditDebitNotesV2/${encodeURIComponent(sucursal)}/${motivoNum}`;

      response = await fetch(FUNCTIONS_ENDPOINTS.SIMPLE_FACTURA_EMITIR, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiUrl: sfApiUrl,
          sfEmail: config.sfEmail,
          sfPassword: config.sfPassword,
          dteData
        })
      });
    } else {
      throw new Error('Nota de Crédito solo disponible para SimpleFactura por ahora');
    }

    if (!response.ok) {
      const errorText = await response.text();
      let parsedMessage = null;
      try {
        const errorData = JSON.parse(errorText);
        parsedMessage = errorData.message || errorData.error || null;
      } catch { /* respuesta no era JSON */ }
      throw new Error(humanizeDteError(parsedMessage || `Error HTTP ${response.status}: ${errorText}`));
    }

    const result = await response.json();
    console.log('✅ Nota de Crédito emitida:', result);

    return {
      success: true,
      tipoDTE: 61,
      tipoDocumento: 'Nota de Crédito Electrónica',
      folio: result.folio || result.data?.folio,
      trackId: result.trackId || result.data?.trackId,
      pdf: result.pdf || result.data?.pdf,
      xml: result.xml || result.data?.xml,
      estado: result.estado || result.data?.estado || 'EMITIDO',
      mensaje: result.mensaje || 'Nota de Crédito emitida correctamente'
    };

  } catch (error) {
    console.error('❌ Error emitiendo Nota de Crédito:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

export default {
  getLibreDTEConfig,
  saveLibreDTEConfig,
  emitirBoleta,
  emitirFactura,
  emitirGuiaDespacho,
  emitirNotaCredito,
  consultarEstadoDTE,
  descargarPDF
};
