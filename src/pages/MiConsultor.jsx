// src/pages/MiConsultor.jsx
// Vista del cliente — reportes publicados por el consultor, más carga de
// gastos operativos (manual y foto de boleta con sugerencia por IA) para
// que el cliente alimente su propia contabilidad sin depender de que el
// consultor lo tipee a mano. Activación por empresa vía gestionActivo
// (companies/{id}/gestion_config/settings), toggle en SuperAdminCompanyDetail.jsx.
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebase';
import {
  collection, getDocs, doc, getDoc, addDoc, updateDoc, serverTimestamp, query, orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase/firebase';
import { getUserCompanyId } from '../services/companyService';
import { GASTO_TIPOS } from '../config/gasto-tipos';
import { FUNCTIONS_ENDPOINTS } from '../config/functions';
import {
  TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  FileText, Download, ChevronDown, ChevronUp, CheckSquare,
  Square, Camera, Loader2, AlertTriangle, CheckCircle,
  Upload, Clock, BarChart2, ArrowRight, Plus, Sparkles, X, Check, Receipt
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { jsPDF } from 'jspdf';
import ProspectsSummaryCard from '../components/ProspectsSummaryCard';

const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);
const PCT = (n) => `${(n || 0).toFixed(1)}%`;
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function mesLabel(periodo) {
  if (!periodo) return '';
  const [y, m] = periodo.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

export default function MiConsultor() {
  const [companyId, setCompanyId] = useState(null);
  const [company, setCompany] = useState(null);
  const [reportes, setReportes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeReporte, setActiveReporte] = useState(null);
  const [objetivosCheck, setObjetivosCheck] = useState({});

  // Subida de facturas
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [facturas, setFacturas] = useState([]);
  const [loadingFacturas, setLoadingFacturas] = useState(false);
  // Factura recién subida con sugerencia de IA pendiente de confirmar
  // (id + sugerencia de analyzeFacturaReceipt), null si no hay ninguna abierta
  const [facturaPendienteConfirmar, setFacturaPendienteConfirmar] = useState(null);
  const [analizandoFactura, setAnalizandoFactura] = useState(false);
  const [confirmandoFactura, setConfirmandoFactura] = useState(false);

  // Gasto manual (sin foto)
  const [mostrarFormGasto, setMostrarFormGasto] = useState(false);
  const [nuevoGasto, setNuevoGasto] = useState({ tipo: 'otro', monto: '', descripcion: '' });
  const [savingGasto, setSavingGasto] = useState(false);
  const [gastoGuardadoOk, setGastoGuardadoOk] = useState(false);

  // Descarga PDF
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const [gestionActivo, setGestionActivo] = useState(null); // null=cargando, true/false

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const cid = await getUserCompanyId();
      if (!cid) return;
      setCompanyId(cid);

      const [compDoc, configDoc, reportesSnap] = await Promise.all([
        getDoc(doc(db, 'companies', cid)),
        getDoc(doc(db, `companies/${cid}/gestion_config/settings`)).catch(() => null),
        getDocs(query(
          collection(db, `companies/${cid}/gestion_reportes`),
          orderBy('publicadoAt', 'desc')
        )).catch(() => ({ docs: [] })),
      ]);

      setCompany({ id: cid, ...compDoc.data() });
      setGestionActivo(configDoc?.exists?.() ? (configDoc.data().gestionActivo === true) : false);

      const lista = reportesSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(r => r.estado === 'publicado');

      setReportes(lista);
      // Solo mostrar como activo si el reporte es del mes actual
      const now = new Date();
      const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const reporteMesActual = lista.find(r => (r.periodo || r.id) === mesActual);
      setActiveReporte(reporteMesActual || null);

      // Cargar facturas del mes actual
      loadFacturas(cid);
    } catch (e) {
      console.error('Error cargando consultor:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadFacturas = async (cid) => {
    setLoadingFacturas(true);
    try {
      const snap = await getDocs(
        query(collection(db, `companies/${cid}/facturas_proveedores`), orderBy('creadoAt', 'desc'))
      ).catch(() => ({ docs: [] }));
      setFacturas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } finally {
      setLoadingFacturas(false);
    }
  };

  const handleUploadFactura = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    setUploadSuccess(false);
    try {
      const now = new Date();
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const fileName = `facturas/${companyId}/${periodo}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, fileName);
      const snap = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snap.ref);

      const facturaRef = await addDoc(collection(db, `companies/${companyId}/facturas_proveedores`), {
        url,
        fileName: file.name,
        fileType: file.type,
        periodo,
        creadoAt: serverTimestamp(),
        subidoPor: auth.currentUser?.email || 'desconocido',
        estado: 'pendiente', // queda pendiente hasta que el cliente confirme el monto (sugerido por IA o a mano)
      });

      setUploadSuccess(true);
      loadFacturas(companyId);
      setTimeout(() => setUploadSuccess(false), 3000);

      // Pedirle a Claude Vision que lea el monto/tipo de la boleta — es solo
      // una sugerencia, el cliente la confirma o la corrige antes de guardar.
      analizarFacturaConIA(facturaRef.id, url, file.name, periodo);
    } catch (e) {
      console.error('Error subiendo factura:', e);
    } finally {
      setUploading(false);
    }
  };

  const analizarFacturaConIA = async (facturaId, imageUrl, fileName, periodo) => {
    setAnalizandoFactura(true);
    // Se abre el panel de confirmación ya, con la sugerencia en null —
    // así el usuario ve "Analizando..." y puede completar a mano si quiere
    // sin esperar a que termine la IA.
    setFacturaPendienteConfirmar({
      id: facturaId, fileName, periodo,
      tipo: 'otro', monto: '', descripcion: '',
    });
    try {
      const user = auth.currentUser;
      if (!user) return;
      const idToken = await user.getIdToken();
      const resp = await fetch(FUNCTIONS_ENDPOINTS.ANALYZE_FACTURA_RECEIPT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ imageUrl }),
      });
      const data = await resp.json();
      if (resp.ok && data.suggestion) {
        const s = data.suggestion;
        setFacturaPendienteConfirmar(prev => prev && prev.id === facturaId ? {
          ...prev,
          tipo: s.tipoSugerido || 'otro',
          monto: s.monto != null ? String(s.monto) : '',
          descripcion: s.proveedor || '',
          confianza: s.confianza || 'baja',
          sugeridoPorIA: true,
        } : prev);
      }
    } catch (e) {
      console.error('Error analizando factura con IA:', e);
      // Si falla, el panel de confirmación queda igual abierto para
      // completar a mano — no se pierde la factura ya subida.
    } finally {
      setAnalizandoFactura(false);
    }
  };

  const confirmarFactura = async () => {
    if (!facturaPendienteConfirmar || !companyId) return;
    const montoNum = parseInt(String(facturaPendienteConfirmar.monto).replace(/\D/g, '') || '0', 10);
    if (!montoNum || montoNum <= 0) return;
    setConfirmandoFactura(true);
    try {
      // 1. Actualiza la factura con el monto confirmado por el cliente
      //    (mismo campo `estado: 'confirmado'` que ya lee accountingAgent.js
      //    para el IVA estimado).
      await updateDoc(doc(db, `companies/${companyId}/facturas_proveedores/${facturaPendienteConfirmar.id}`), {
        monto: montoNum,
        tipo: facturaPendienteConfirmar.tipo,
        descripcion: facturaPendienteConfirmar.descripcion || '',
        estado: 'confirmado',
        confirmadoPor: auth.currentUser?.email || 'desconocido',
        confirmadoAt: serverTimestamp(),
      });

      // 2. Además registra el gasto operativo correspondiente, con el
      //    mismo shape exacto que lee accountingAgent.js (tipo, monto,
      //    periodo) — así el gasto de la boleta entra al cierre de mes
      //    igual que uno cargado manualmente.
      await addDoc(collection(db, `companies/${companyId}/gestion_gastos`), {
        tipo: facturaPendienteConfirmar.tipo,
        monto: montoNum,
        periodo: facturaPendienteConfirmar.periodo,
        descripcion: facturaPendienteConfirmar.descripcion || `Boleta: ${facturaPendienteConfirmar.fileName}`,
        creadoAt: serverTimestamp(),
        creadoPor: 'cliente',
        facturaId: facturaPendienteConfirmar.id,
      });

      setFacturaPendienteConfirmar(null);
      loadFacturas(companyId);
    } catch (e) {
      console.error('Error confirmando factura:', e);
    } finally {
      setConfirmandoFactura(false);
    }
  };

  const saveGastoManual = async () => {
    if (!companyId) return;
    const montoNum = parseInt(String(nuevoGasto.monto).replace(/\D/g, '') || '0', 10);
    if (!montoNum || montoNum <= 0) return;
    setSavingGasto(true);
    try {
      const now = new Date();
      const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await addDoc(collection(db, `companies/${companyId}/gestion_gastos`), {
        tipo: nuevoGasto.tipo,
        monto: montoNum,
        periodo,
        descripcion: nuevoGasto.descripcion || '',
        creadoAt: serverTimestamp(),
        creadoPor: 'cliente',
      });
      setNuevoGasto({ tipo: 'otro', monto: '', descripcion: '' });
      setGastoGuardadoOk(true);
      setTimeout(() => setGastoGuardadoOk(false), 3000);
    } catch (e) {
      console.error('Error guardando gasto:', e);
    } finally {
      setSavingGasto(false);
    }
  };

  const generatePDF = async () => {
    if (!activeReporte) return;
    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pw = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      let y = 0;

      // Header degradado azul
      pdf.setFillColor(37, 99, 235);
      pdf.rect(0, 0, pw, 45, 'F');

      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.text('Reporte de Gestión', 15, 18);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.text(`${company?.name || 'Mi Empresa'}`, 15, 28);
      pdf.text(mesLabel(activeReporte.periodo), 15, 36);

      // Fecha de publicación
      if (activeReporte.publicadoAt?.toDate) {
        pdf.setFontSize(9);
        pdf.setTextColor(200, 220, 255);
        pdf.text(`Publicado: ${activeReporte.publicadoAt.toDate().toLocaleDateString('es-CL')}`, pw - 15, 36, { align: 'right' });
      }

      y = 55;
      pdf.setTextColor(30, 30, 30);

      // KPIs
      if (activeReporte.kpis) {
        const kpis = activeReporte.kpis;
        const kpiData = [
          { label: 'Ventas del mes', value: CLP(kpis.ventas), color: [37, 99, 235] },
          { label: 'Margen bruto', value: PCT(kpis.margen), color: kpis.margen >= 25 ? [16, 185, 129] : [245, 158, 11] },
          { label: 'Resultado', value: CLP(kpis.resultado), color: kpis.resultado >= 0 ? [16, 185, 129] : [239, 68, 68] },
          { label: 'Transacciones', value: String(kpis.cantVentas || 0), color: [99, 102, 241] },
        ];

        const boxW = (pw - 30) / 4;
        kpiData.forEach((k, i) => {
          const x = 15 + i * boxW;
          pdf.setFillColor(248, 250, 252);
          pdf.roundedRect(x, y, boxW - 3, 22, 2, 2, 'F');
          pdf.setFontSize(7);
          pdf.setTextColor(100, 100, 100);
          pdf.text(k.label, x + (boxW - 3) / 2, y + 7, { align: 'center' });
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...k.color);
          pdf.text(k.value, x + (boxW - 3) / 2, y + 16, { align: 'center' });
          pdf.setFont('helvetica', 'normal');
        });
        y += 30;
      }

      // ── ESTADO DE RESULTADOS ──
      const kpis = activeReporte.kpis || {};
      const costoVentas = activeReporte.costoVentas || 0;
      const margenBruto = kpis.ventas - costoVentas;
      const resultado = kpis.resultado ?? 0;

      if (kpis.ventas > 0 || costoVentas > 0) {
        if (y > pageH - 80) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Estado de resultados', 15, y);
        y += 7;

        const rows = [
          { label: 'Ventas del mes', value: kpis.ventas, color: [30, 30, 30], bold: false },
          { label: `Inversión en mercadería (costo)`, value: -costoVentas, color: [220, 50, 50], bold: false },
          { label: `Margen bruto (${PCT(kpis.margen)})`, value: margenBruto, color: margenBruto >= 0 ? [16, 120, 80] : [220, 50, 50], bold: true },
          { label: 'Gastos fijos del mes', value: -kpis.gastos, color: [220, 50, 50], bold: false },
          { label: 'Resultado operacional', value: resultado, color: resultado >= 0 ? [16, 120, 80] : [220, 50, 50], bold: true },
        ];

        // Detalle de gastos
        if (activeReporte.detalleGastos?.length > 0) {
          activeReporte.detalleGastos.forEach(g => {
            rows.splice(rows.length - 1, 0, {
              label: `   · ${g.descripcion || g.tipo}`,
              value: -g.monto,
              color: [140, 100, 50],
              bold: false,
              small: true,
            });
          });
        }

        rows.forEach((row, i) => {
          if (y > pageH - 20) { pdf.addPage(); y = 20; }
          const isSeparator = row.bold;
          if (isSeparator) {
            pdf.setFillColor(245, 247, 250);
            pdf.rect(14, y - 4, pw - 28, 8, 'F');
          }
          pdf.setFont('helvetica', row.bold ? 'bold' : 'normal');
          pdf.setFontSize(row.small ? 8 : 9);
          pdf.setTextColor(60, 60, 60);
          pdf.text(row.label, 17, y);
          pdf.setTextColor(...row.color);
          const valStr = row.value >= 0 ? CLP(row.value) : `−${CLP(Math.abs(row.value))}`;
          pdf.text(valStr, pw - 15, y, { align: 'right' });
          y += row.bold ? 8 : 6;
        });
        y += 6;
      }

      // ── TOP PRODUCTOS ──
      if (activeReporte.topProductos?.length > 0) {
        if (y > pageH - 50) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Productos mas vendidos', 15, y);
        y += 7;
        activeReporte.topProductos.forEach((p, i) => {
          if (y > pageH - 20) { pdf.addPage(); y = 20; }
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          pdf.text(`${i + 1}. ${p.name}`, 17, y);
          pdf.setTextColor(37, 99, 235);
          pdf.text(`${p.qty} un · ${CLP(p.total)}`, pw - 15, y, { align: 'right' });
          y += 6;
        });
        y += 4;
      }

      // ── TOP CLIENTES ──
      if (activeReporte.topClientes?.length > 0) {
        if (y > pageH - 50) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Mejores clientes del mes', 15, y);
        y += 7;
        activeReporte.topClientes.forEach((c, i) => {
          if (y > pageH - 20) { pdf.addPage(); y = 20; }
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          pdf.setTextColor(60, 60, 60);
          pdf.text(`${i + 1}. ${c.nombre}`, 17, y);
          pdf.setTextColor(99, 102, 241);
          pdf.text(`${c.comprasMes} compras · ${CLP(c.totalMes)}`, pw - 15, y, { align: 'right' });
          y += 6;
        });
        y += 4;
      }

      // ── ALERTAS ──
      if (activeReporte.alertas?.length > 0) {
        if (y > pageH - 50) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Alertas del periodo', 15, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        activeReporte.alertas.forEach(a => {
          if (y > pageH - 20) { pdf.addPage(); y = 20; }
          const color = a.type === 'critical' ? [239, 68, 68] : a.type === 'warning' ? [245, 158, 11] : [59, 130, 246];
          pdf.setFillColor(...color);
          pdf.circle(18, y - 1.5, 1.5, 'F');
          pdf.setTextColor(60, 60, 60);
          pdf.text(a.message, 22, y);
          y += 6;
        });
        y += 4;
      }

      // ── ANÁLISIS DEL CONSULTOR ──
      if (activeReporte.observaciones) {
        if (y > pageH - 50) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Analisis del consultor', 15, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        const lines = pdf.splitTextToSize(activeReporte.observaciones, pw - 30);
        lines.forEach(line => {
          if (y > pageH - 30) { pdf.addPage(); y = 20; }
          pdf.text(line, 15, y);
          y += 5;
        });
        y += 4;
      }

      // ── RECOMENDACIONES ──
      if (activeReporte.recomendaciones?.length > 0) {
        if (y > pageH - 50) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Recomendaciones', 15, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        activeReporte.recomendaciones.forEach((r, i) => {
          if (y > pageH - 20) { pdf.addPage(); y = 20; }
          pdf.text(`${i + 1}. ${r}`, 18, y);
          y += 6;
        });
        y += 4;
      }

      // ── OBJETIVOS ──
      if (activeReporte.objetivos?.length > 0) {
        if (y > pageH - 50) { pdf.addPage(); y = 20; }
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(30, 30, 30);
        pdf.text('Objetivos para el proximo mes', 15, y);
        y += 6;
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        pdf.setTextColor(60, 60, 60);
        activeReporte.objetivos.forEach(o => {
          if (y > pageH - 20) { pdf.addPage(); y = 20; }
          pdf.text(`[ ]  ${o}`, 18, y);
          y += 6;
        });
        y += 4;
      }

      // ── FOOTER ──
      const totalPages = pdf.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Bodestock · Reporte de Gestion · ${company?.name}`, 15, pageH - 8);
        pdf.text(`Pagina ${i} de ${totalPages}`, pw - 15, pageH - 8, { align: 'right' });
      }

      pdf.save(`Reporte-${company?.name}-${mesLabel(activeReporte.periodo)}.pdf`);
    } catch (e) {
      console.error('Error generando PDF:', e);
    } finally {
      setGeneratingPDF(false);
    }
  };

  if (loading || gestionActivo === null) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
    </div>
  );

  if (!gestionActivo) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-5 shadow-lg shadow-blue-500/25">
        <BarChart2 className="w-10 h-10 text-white" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Muy pronto</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs leading-relaxed">
        Tu consultor está configurando este módulo especialmente para <strong>{company?.name}</strong>.
        Estará disponible muy pronto.
      </p>
      <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 dark:text-slate-600">
        <Clock className="w-3.5 h-3.5" />
        Se activará automáticamente
      </div>
    </div>
  );

  if (reportes.length === 0) return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <BarChart2 className="w-8 h-8 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tu reporte estará aquí</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs">
          Tu consultor está preparando el análisis de tu negocio. Vuelve pronto.
        </p>
      </div>
      <ProspectsSummaryCard companyId={companyId} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 px-4 pt-8 pb-6 relative overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/[0.05] rounded-full" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/[0.04] rounded-full" />

        <div className="max-w-2xl mx-auto relative">
          {/* Empresa */}
          <div className="flex items-center gap-2 mb-1">
            <p className="text-blue-200 text-xs font-semibold uppercase tracking-widest">Mi Consultor</p>
            {activeReporte?.tipo && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">
                {activeReporte.tipo === 'semanal' ? '📅 Semanal' : '📊 Mensual'}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-black text-white leading-tight mb-4">{company?.name}</h1>

          {/* Selector de mes — mes actual + historial */}
          {(() => {
            const now = new Date();
            const mesActualKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const tieneReporteMesActual = reportes.some(r => (r.periodo || r.id) === mesActualKey);
            return (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide mb-4">
                {/* Chip del mes actual si no tiene reporte */}
                {!tieneReporteMesActual && (
                  <button
                    onClick={() => setActiveReporte(null)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeReporte === null
                        ? 'bg-white text-blue-700'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    📋 {mesLabel(mesActualKey)}
                  </button>
                )}
                {reportes.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setActiveReporte(r)}
                    className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${
                      activeReporte?.id === r.id
                        ? 'bg-white text-blue-700'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    {r.tipo === 'semanal' ? '📅' : '📊'}
                    {mesLabel(r.periodo || r.id)}
                  </button>
                ))}
              </div>
            );
          })()}

          {/* KPIs horizontales scrollables */}
          {activeReporte?.kpis && (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {[
                { label: 'Ventas', value: CLP(activeReporte.kpis.ventas), icon: '💰' },
                { label: 'Margen', value: PCT(activeReporte.kpis.margen), icon: '📈' },
                { label: 'Resultado', value: CLP(Math.abs(activeReporte.kpis.resultado || 0)), icon: (activeReporte.kpis.resultado || 0) >= 0 ? '✅' : '❌', bad: (activeReporte.kpis.resultado || 0) < 0 },
                { label: 'Ventas', value: `${activeReporte.kpis.cantVentas || 0} tx`, icon: '🛒' },
              ].map((k, i) => (
                <div key={i} className="flex-shrink-0 bg-white/[0.15] backdrop-blur-sm rounded-2xl px-4 py-3 min-w-[110px]">
                  <p className="text-white/70 text-[10px] font-medium mb-0.5">{k.label}</p>
                  <p className={`text-[15px] font-black tabular-nums leading-tight ${k.bad ? 'text-red-300' : 'text-white'}`}>
                    {k.value}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Fecha publicación + PDF */}
          {activeReporte && (
            <div className="flex items-center justify-between mt-4">
              {activeReporte.publicadoAt?.toDate ? (
                <p className="text-blue-200 text-xs flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {activeReporte.publicadoAt.toDate().toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              ) : <span />}
              <button
                onClick={generatePDF}
                disabled={generatingPDF}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 border border-white/30 text-white text-xs font-bold px-3 py-2 rounded-xl transition-all disabled:opacity-60"
              >
                {generatingPDF ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</> : <><Download className="w-3.5 h-3.5" /> PDF</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Sin reporte del mes actual — + resumen del mes anterior ── */}
      {!activeReporte && reportes.length > 0 && (() => {
        const ultimoReporte = reportes[0]; // ya viene ordenado desc por publicadoAt
        const resultado = ultimoReporte?.kpis?.resultado ?? null;
        const noLlego = resultado !== null && resultado < 0;
        return (
          <div className="max-w-2xl mx-auto px-4 py-6 space-y-3">
            {/* Banner resultado mes anterior */}
            {ultimoReporte && resultado !== null && (
              <div className={`rounded-2xl border p-4 ${
                noLlego
                  ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60'
              }`}>
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{noLlego ? '📉' : '📈'}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${noLlego ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                      {mesLabel(ultimoReporte.periodo || ultimoReporte.id)}: {noLlego ? 'No se alcanzó el punto de equilibrio' : 'Mes cerró en positivo'}
                    </p>
                    <p className={`text-xs mt-0.5 ${noLlego ? 'text-red-500 dark:text-red-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                      Resultado: {noLlego ? '−' : ''}{CLP(Math.abs(resultado))} · Ventas: {CLP(ultimoReporte.kpis.ventas)} · Margen: {PCT(ultimoReporte.kpis.margen)}
                    </p>
                    {noLlego && (
                      <p className="text-xs text-red-400 dark:text-red-500 mt-1.5">
                        Revisá las recomendaciones del mes anterior para mejorar este mes.
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveReporte(ultimoReporte)}
                    className={`text-[11px] font-bold px-2.5 py-1.5 rounded-lg shrink-0 ${
                      noLlego
                        ? 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-300'
                        : 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300'
                    }`}
                  >
                    Ver
                  </button>
                </div>
              </div>
            )}
            {/* Aviso reporte en preparación */}
            <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 p-5 text-center">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300">El reporte de este mes está en preparación</p>
              <p className="text-xs text-blue-500 dark:text-blue-400 mt-1">Tu consultor lo publicará pronto. Mientras tanto podés ver los meses anteriores arriba.</p>
            </div>
          </div>
        );
      })()}

      {/* ── Contenido ── */}
      {activeReporte && (
        <motion.div
          key={activeReporte.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto px-4 py-5 space-y-4"
        >
          {/* Alertas — más visuales */}
          {activeReporte.alertas?.length > 0 && (
            <div className="space-y-2">
              {activeReporte.alertas.map((a, i) => {
                const cfg = {
                  critical: { bg: 'bg-red-50 dark:bg-red-950/40', border: 'border-red-200 dark:border-red-800/60', text: 'text-red-700 dark:text-red-300', icon: '🚨' },
                  warning:  { bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-700/60', text: 'text-amber-700 dark:text-amber-300', icon: '⚠️' },
                  info:     { bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-700/60', text: 'text-blue-700 dark:text-blue-300', icon: 'ℹ️' },
                }[a.type] || { bg: 'bg-gray-50 dark:bg-slate-800', border: 'border-gray-200 dark:border-slate-700', text: 'text-gray-700 dark:text-gray-300', icon: '•' };
                return (
                  <div key={i} className={`flex items-start gap-3 p-3.5 rounded-2xl border ${cfg.bg} ${cfg.border}`}>
                    <span className="text-base shrink-0 mt-0.5">{cfg.icon}</span>
                    <span className={`text-sm leading-relaxed ${cfg.text}`}>{a.message}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Estado de Resultados — solo en mensual */}
          {activeReporte.tipo !== 'semanal' && (activeReporte.kpis?.ventas > 0 || activeReporte.kpis?.gastos > 0) && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">📊 Estado de Resultados</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{mesLabel(activeReporte.periodo)}</p>
              </div>
              <div className="px-4 py-3 space-y-2 text-sm">
                {/* Ventas */}
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">Ventas brutas</span>
                  <span className="font-bold text-slate-800 dark:text-white tabular-nums">{CLP(activeReporte.kpis.ventas)}</span>
                </div>
                {/* Costo de ventas */}
                {activeReporte.costoVentas > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600 dark:text-slate-400">− Costo de mercadería</span>
                    <span className="font-semibold text-red-500 dark:text-red-400 tabular-nums">−{CLP(activeReporte.costoVentas)}</span>
                  </div>
                )}
                {/* Margen bruto */}
                {activeReporte.costoVentas > 0 && (
                  <div className="flex justify-between items-center py-2 border-y border-slate-100 dark:border-slate-800">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">= Margen bruto</span>
                    <div className="text-right">
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{CLP(activeReporte.kpis.ventas - activeReporte.costoVentas)}</span>
                      <span className="text-[10px] text-slate-400 ml-1">({PCT(activeReporte.kpis.margen)})</span>
                    </div>
                  </div>
                )}
                {/* Detalle de gastos */}
                {activeReporte.detalleGastos?.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Gastos fijos</p>
                    {activeReporte.detalleGastos.map((g, i) => {
                      const tipoLabel = {
                        arriendo: '🏪 Arriendo', sueldos: '👷 Sueldos', servicios: '💡 Servicios',
                        transporte: '🚗 Transporte', software: '💻 Software', honorarios: '📊 Honorarios',
                        impuestos: '🏛️ Impuestos', comision_vendedor: '🤝 Comisión vendedor', otro: '📋 Otro',
                      }[g.tipo] || g.tipo;
                      const subLabel = g.tipo === 'comision_vendedor' && g.comisionVendedor
                        ? ` — ${g.comisionVendedor}${g.comisionPct ? ` (${g.comisionPct}%)` : ''}`
                        : g.descripcion ? ` — ${g.descripcion}` : '';
                      return (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-slate-500 dark:text-slate-400 text-xs">{tipoLabel}{subLabel}</span>
                          <span className="text-xs font-semibold text-red-500 dark:text-red-400 tabular-nums">−{CLP(g.monto)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* Total gastos */}
                {activeReporte.kpis.gastos > 0 && (
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-slate-600 dark:text-slate-400">− Total gastos fijos</span>
                    <span className="font-semibold text-red-500 dark:text-red-400 tabular-nums">−{CLP(activeReporte.kpis.gastos)}</span>
                  </div>
                )}
                {/* Resultado operacional */}
                <div className={`flex justify-between items-center py-2.5 px-3 rounded-xl mt-2 ${
                  (activeReporte.kpis.resultado || 0) >= 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/40'
                    : 'bg-red-50 dark:bg-red-950/40'
                }`}>
                  <span className="font-bold text-slate-700 dark:text-slate-300">= Resultado operacional</span>
                  <span className={`font-black tabular-nums text-base ${
                    (activeReporte.kpis.resultado || 0) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {(activeReporte.kpis.resultado || 0) >= 0 ? '' : '−'}{CLP(Math.abs(activeReporte.kpis.resultado || 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Pulso semanal — solo en semanal */}
          {activeReporte.tipo === 'semanal' && activeReporte.kpis?.ventas > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">⚡ Pulso de la semana</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-400 mb-1">Ventas</p>
                  <p className="text-base font-black text-slate-800 dark:text-white tabular-nums">{CLP(activeReporte.kpis.ventas)}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-400 mb-1">Margen</p>
                  <p className="text-base font-black text-emerald-600 dark:text-emerald-400">{PCT(activeReporte.kpis.margen)}</p>
                </div>
                <div className="text-center p-3 rounded-xl bg-slate-50 dark:bg-slate-800">
                  <p className="text-[10px] text-slate-400 mb-1">Transacciones</p>
                  <p className="text-base font-black text-slate-800 dark:text-white">{activeReporte.kpis.cantVentas || 0}</p>
                </div>
              </div>
            </div>
          )}

          {/* Top productos — en semanal también */}
          {activeReporte.tipo === 'semanal' && activeReporte.topProductos?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">🔥 Lo más vendido esta semana</p>
              <div className="space-y-2.5">
                {activeReporte.topProductos.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                      i === 0 ? 'bg-amber-400 text-white' :
                      i === 1 ? 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-white' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>{i + 1}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{p.name}</p>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">{CLP(p.total)}</p>
                      <p className="text-[10px] text-slate-400">{p.qty} un</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Análisis del consultor — con avatar */}
          {activeReporte.observaciones && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  A
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-white">Abner — Tu consultor</p>
                  <p className="text-[10px] text-slate-400">Análisis de {mesLabel(activeReporte.periodo)}</p>
                </div>
              </div>
              <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-wrap px-4 py-4">
                {activeReporte.observaciones}
              </p>
            </div>
          )}

          {/* Top clientes — solo mensual */}
          {activeReporte.tipo !== 'semanal' && activeReporte.topClientes?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">🏆 Mejores clientes</p>
              <div className="space-y-3">
                {activeReporte.topClientes.map((c, i) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const pct = activeReporte.kpis?.ventas > 0 ? Math.round((c.totalMes / activeReporte.kpis.ventas) * 100) : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base shrink-0">{medals[i]}</span>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white flex-1 truncate">{c.nombre}</p>
                        <p className="text-sm font-bold text-slate-800 dark:text-white tabular-nums shrink-0">${c.totalMes.toLocaleString('es-CL')}</p>
                      </div>
                      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full ml-8 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-slate-400 ml-8 mt-0.5">{pct}% de tus ventas · {c.comprasMes} compra{c.comprasMes !== 1 ? 's' : ''}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top productos — solo mensual */}
          {activeReporte.tipo !== 'semanal' && activeReporte.topProductos?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">🔥 Más vendidos</p>
              <div className="space-y-2.5">
                {activeReporte.topProductos.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black shrink-0 ${
                      i === 0 ? 'bg-amber-400 text-white' :
                      i === 1 ? 'bg-slate-300 dark:bg-slate-600 text-slate-700 dark:text-white' :
                      'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}>{i + 1}</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">{p.name}</p>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-white tabular-nums">${p.total.toLocaleString('es-CL')}</p>
                      <p className="text-[10px] text-slate-400">{p.qty} un</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recomendaciones */}
          {activeReporte.recomendaciones?.filter(r => r.trim()).length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">💡 Recomendaciones</p>
              <div className="space-y-3">
                {activeReporte.recomendaciones.filter(r => r.trim()).map((rec, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-blue-500 flex items-center justify-center text-white text-[11px] font-black shrink-0 mt-0.5">{i + 1}</div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Objetivos con checkbox */}
          {activeReporte.objetivos?.filter(o => o.trim()).length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">📋 Esta semana</p>
                <p className="text-[11px] text-slate-400">
                  {Object.values(objetivosCheck).filter(Boolean).length}/{activeReporte.objetivos.filter(o => o.trim()).length} completados
                </p>
              </div>
              <div className="space-y-2">
                {activeReporte.objetivos.filter(o => o.trim()).map((obj, i) => {
                  const key = `${activeReporte.id}_${i}`;
                  const checked = objetivosCheck[key] || false;
                  return (
                    <motion.button
                      key={i}
                      onClick={() => setObjetivosCheck(prev => ({ ...prev, [key]: !checked }))}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                        checked
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                          : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {checked && <CheckCircle className="w-3 h-3 text-white" />}
                      </div>
                      <span className={`text-sm leading-snug transition-all ${
                        checked ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'
                      }`}>{obj}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Productos sin rotación — solo mensual */}
          {activeReporte?.tipo !== 'semanal' && activeReporte?.sinMovimiento?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">📦 Stock sin movimiento</p>
                <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60">
                  {activeReporte.sinMovimiento.length} producto{activeReporte.sinMovimiento.length !== 1 ? 's' : ''}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
                Estos productos tienen stock disponible pero no han tenido ventas recientes. Considera promocionarlos o ajustar su precio.
              </p>
              <div className="space-y-2">
                {activeReporte.sinMovimiento.map((p, i) => (
                  <div key={p.id || i} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-400">{p.stock} {p.unit}</p>
                    </div>
                    {p.valorInmovilizado > 0 && (
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums shrink-0 ml-3">
                        {CLP(p.valorInmovilizado)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {activeReporte.sinMovimiento.reduce((s, p) => s + (p.valorInmovilizado || 0), 0) > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">Capital inmovilizado estimado</p>
                  <p className="text-sm font-black text-amber-600 dark:text-amber-400 tabular-nums">
                    {CLP(activeReporte.sinMovimiento.reduce((s, p) => s + (p.valorInmovilizado || 0), 0))}
                  </p>
                </div>
              )}
            </div>
          )}

        </motion.div>
      )}

      {/* ── Negocios por visitar (Marketing) — siempre visible ── */}
      <ProspectsSummaryCard companyId={companyId} />

      {/* ── Gasto manual — siempre visible ── */}
      <div className="max-w-2xl mx-auto px-4 pb-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Receipt className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Registrar un gasto</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Sin foto — arriendo, sueldos, servicios, etc.</p>
              </div>
            </div>
            <button
              onClick={() => setMostrarFormGasto(v => !v)}
              className="shrink-0 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
            >
              {mostrarFormGasto ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>

          <AnimatePresence>
            {mostrarFormGasto && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {GASTO_TIPOS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setNuevoGasto(g => ({ ...g, tipo: t.id }))}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          nuevoGasto.tipo === t.id
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text" inputMode="numeric" placeholder="Monto — ej: 120.000"
                    value={nuevoGasto.monto}
                    onChange={(e) => setNuevoGasto(g => ({ ...g, monto: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-white"
                  />
                  <input
                    type="text" placeholder="Descripción (opcional)"
                    value={nuevoGasto.descripcion}
                    onChange={(e) => setNuevoGasto(g => ({ ...g, descripcion: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm text-slate-800 dark:text-white"
                  />
                  <button
                    onClick={saveGastoManual}
                    disabled={savingGasto || !nuevoGasto.monto}
                    className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      gastoGuardadoOk ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
                      'bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white'
                    }`}
                  >
                    {savingGasto ? 'Guardando...' : gastoGuardadoOk ? '✓ Gasto guardado' : 'Guardar gasto'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Facturas — siempre visible ── */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 dark:text-white">Comprobantes de gastos del mes</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Sacá una foto y te sugerimos el monto automáticamente</p>
            </div>
          </div>

          <label className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl text-sm font-semibold cursor-pointer transition-all ${
            uploading ? 'bg-violet-100 dark:bg-violet-900/20 text-violet-500 cursor-not-allowed' :
            uploadSuccess ? 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' :
            'bg-violet-600 hover:bg-violet-700 text-white'
          }`}>
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</> :
             uploadSuccess ? <><CheckCircle className="w-4 h-4" /> ¡Enviada!</> :
             <><Camera className="w-4 h-4" /> Sacar foto o subir comprobante</>
            }
            <input type="file" accept="image/*,application/pdf" capture="environment" onChange={handleUploadFactura} disabled={uploading} className="hidden" />
          </label>

          {/* Panel de confirmación: sugerencia de IA editable antes de guardar */}
          <AnimatePresence>
            {facturaPendienteConfirmar && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-3 p-3.5 rounded-xl border-2 border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30"
              >
                <div className="flex items-center gap-2 mb-2.5">
                  {analizandoFactura ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-500" />
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">Leyendo la boleta...</p>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      <p className="text-xs font-semibold text-violet-700 dark:text-violet-300">
                        {facturaPendienteConfirmar.sugeridoPorIA ? 'Esto detectamos — revisá y confirmá' : 'Completá los datos para guardar'}
                      </p>
                    </>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {GASTO_TIPOS.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setFacturaPendienteConfirmar(f => ({ ...f, tipo: t.id }))}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                          facturaPendienteConfirmar.tipo === t.id
                            ? 'bg-violet-600 border-violet-600 text-white'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text" inputMode="numeric" placeholder="Monto — ej: 45.000"
                    value={facturaPendienteConfirmar.monto}
                    onChange={(e) => setFacturaPendienteConfirmar(f => ({ ...f, monto: e.target.value.replace(/\D/g, '') }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white"
                  />
                  <input
                    type="text" placeholder="Proveedor / descripción (opcional)"
                    value={facturaPendienteConfirmar.descripcion}
                    onChange={(e) => setFacturaPendienteConfirmar(f => ({ ...f, descripcion: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-violet-200 dark:border-violet-800 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white"
                  />
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={() => setFacturaPendienteConfirmar(null)}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    >
                      Revisar después
                    </button>
                    <button
                      onClick={confirmarFactura}
                      disabled={confirmandoFactura || !facturaPendienteConfirmar.monto}
                      className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white flex items-center justify-center gap-1.5"
                    >
                      {confirmandoFactura ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Confirmar
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {loadingFacturas ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          ) : facturas.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {facturas.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-xs py-1">
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline flex-1 min-w-0">
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{f.fileName}</span>
                  </a>
                  <span className="text-[10px] text-slate-400 shrink-0">{f.periodo}</span>
                  {f.estado === 'confirmado' ? (
                    <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                      {f.monto ? CLP(f.monto) : '✓ Confirmado'}
                    </span>
                  ) : (
                    <button
                      onClick={() => setFacturaPendienteConfirmar({
                        id: f.id, fileName: f.fileName, periodo: f.periodo,
                        tipo: 'otro', monto: '', descripcion: '',
                      })}
                      className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                    >
                      Pendiente — completar
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400 mt-3">Aún no has subido facturas este mes</p>
          )}
        </div>
      </div>
    </div>
  );
}
