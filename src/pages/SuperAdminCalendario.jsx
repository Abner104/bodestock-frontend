// src/pages/SuperAdminCalendario.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import { ChevronLeft, ChevronRight, DollarSign, Building2, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/sa-card';
import { Badge } from '../components/ui/sa-badge';
import { Button } from '../components/ui/sa-button';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const CLP = (n) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', minimumFractionDigits: 0 }).format(n || 0);

export default function SuperAdminCalendario() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hoy] = useState(new Date());
  const [mes, setMes] = useState(new Date().getMonth());
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [diaSeleccionado, setDiaSeleccionado] = useState(null);

  useEffect(() => {
    const cargar = async () => {
      try {
        const snap = await getDocs(collection(db, 'companies'));
        const lista = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(c => c.nextBillingDate && c.plan !== 'free' && c.plan !== 'trial');
        setCompanies(lista);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    cargar();
  }, []);

  const cobrosDelMes = companies.reduce((acc, c) => {
    const fecha = c.nextBillingDate?.toDate ? c.nextBillingDate.toDate() : new Date(c.nextBillingDate);
    const diaCobro = fecha.getDate();
    const key = diaCobro;
    if (!acc[key]) acc[key] = [];
    acc[key].push({ ...c, fechaCobro: new Date(anio, mes, diaCobro) });
    return acc;
  }, {});

  const primerDia = new Date(anio, mes, 1).getDay();
  const diasEnMes = new Date(anio, mes + 1, 0).getDate();
  const celdas = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const mesAnterior = () => {
    if (mes === 0) { setMes(11); setAnio(a => a - 1); } else setMes(m => m - 1);
    setDiaSeleccionado(null);
  };
  const mesSiguiente = () => {
    if (mes === 11) { setMes(0); setAnio(a => a + 1); } else setMes(m => m + 1);
    setDiaSeleccionado(null);
  };

  const totalMes = Object.values(cobrosDelMes).flat().reduce((s, c) => s + (c.monthlyAmount || 0), 0);
  const esHoy = (d) => d === hoy.getDate() && mes === hoy.getMonth() && anio === hoy.getFullYear();
  const listaDetalle = diaSeleccionado ? (cobrosDelMes[diaSeleccionado] || []) : (cobrosDelMes[hoy.getDate()] || []);
  const tituloDetalle = diaSeleccionado
    ? `${diaSeleccionado} de ${MESES[mes]}`
    : `Hoy — ${hoy.getDate()} de ${MESES[hoy.getMonth()]}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white text-white">Calendario de cobros</h1>
          <p className="text-sm text-zinc-500 text-zinc-400 mt-0.5">Pagos programados por empresa</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 text-zinc-400 mb-0.5">Total {MESES[mes]}</p>
          <p className="text-lg font-bold text-white text-white">{CLP(totalMes)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Calendario */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-0">
              {/* Nav mes */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] border-white/[0.06]">
                <Button variant="icon" onClick={mesAnterior}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="text-center">
                  <p className="text-sm font-semibold text-white text-white">{MESES[mes]}</p>
                  <p className="text-xs text-zinc-400">{anio}</p>
                </div>
                <Button variant="icon" onClick={mesSiguiente}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              {/* Días semana */}
              <div className="grid grid-cols-7 border-b border-white/[0.06] border-white/[0.06]">
                {DIAS.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                    {d}
                  </div>
                ))}
              </div>

              {/* Grilla */}
              <div className="grid grid-cols-7">
                {celdas.map((dia, idx) => {
                  const tieneCobros = dia && cobrosDelMes[dia];
                  const cantCobros = tieneCobros ? cobrosDelMes[dia].length : 0;
                  const totalDia = tieneCobros ? cobrosDelMes[dia].reduce((s, c) => s + (c.monthlyAmount || 0), 0) : 0;
                  const seleccionado = dia && diaSeleccionado === dia;
                  const hoyDia = dia && esHoy(dia);
                  const esPasado = dia && new Date(anio, mes, dia) < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

                  return (
                    <div
                      key={idx}
                      onClick={() => dia && setDiaSeleccionado(dia === diaSeleccionado ? null : dia)}
                      className={[
                        'min-h-[72px] p-2 border-b border-r border-white/[0.06] border-white/[0.06] transition-colors',
                        dia ? 'cursor-pointer hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04]/40' : '',
                        seleccionado ? 'bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06]' : '',
                      ].join(' ')}
                    >
                      {dia && (
                        <>
                          <div className={[
                            'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium mb-1',
                            hoyDia ? 'bg-zinc-900 dark:bg-white/[0.05] text-white text-white' :
                            esPasado ? 'text-zinc-300 text-zinc-600' : 'text-zinc-600 text-zinc-400',
                          ].join(' ')}>
                            {dia}
                          </div>

                          {tieneCobros && (
                            <div className="space-y-0.5">
                              {cobrosDelMes[dia].slice(0, 2).map((c, i) => (
                                <div key={i} className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 bg-emerald-500/[0.08] text-emerald-700 text-emerald-400 border border-emerald-200 border-emerald-500/[0.15] truncate">
                                  {c.name?.split(' ')[0]}
                                </div>
                              ))}
                              {cantCobros > 2 && (
                                <div className="text-[9px] text-zinc-400 pl-1">+{cantCobros - 2}</div>
                              )}
                              <div className="text-[9px] font-semibold text-zinc-500 text-zinc-400 pl-1">
                                {CLP(totalDia)}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Panel lateral */}
        <div className="space-y-4">
          {/* Detalle día */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{tituloDetalle}</CardTitle>
                <span className="text-xs text-zinc-400">{listaDetalle.length} cobro{listaDetalle.length !== 1 ? 's' : ''}</span>
              </div>
            </CardHeader>
            <CardContent>
              {listaDetalle.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">Sin cobros este día</p>
              ) : (
                <div className="space-y-2">
                  {listaDetalle.map(c => (
                    <div
                      key={c.id}
                      onClick={() => navigate(`/super-admin/empresa/${c.id}`)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-white/[0.06] border-white/[0.06] hover:bg-white/[0.05]/[0.02] hover:bg-white/[0.05]/[0.04] cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] flex items-center justify-center text-sm font-semibold text-zinc-600 text-zinc-300 shrink-0">
                        {(c.name || 'E').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white text-white truncate">{c.name}</p>
                        <p className="text-xs text-zinc-400 truncate">{c.adminEmail}</p>
                      </div>
                      <p className="text-sm font-semibold text-emerald-600 text-emerald-400 shrink-0">{CLP(c.monthlyAmount)}</p>
                    </div>
                  ))}
                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] border-white/[0.06]">
                    <span className="text-xs text-zinc-500 font-medium">Total</span>
                    <span className="text-sm font-bold text-white text-white">
                      {CLP(listaDetalle.reduce((s, c) => s + (c.monthlyAmount || 0), 0))}
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Resumen mes */}
          <Card>
            <CardHeader><CardTitle>Resumen {MESES[mes]}</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 text-zinc-400">
                    <Building2 className="w-3.5 h-3.5" />
                    Empresas cobrando
                  </div>
                  <span className="text-sm font-semibold text-white text-white">
                    {Object.values(cobrosDelMes).flat().length}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] border-white/[0.06]">
                  <div className="flex items-center gap-2 text-sm text-zinc-500 text-zinc-400">
                    <DollarSign className="w-3.5 h-3.5" />
                    Ingreso esperado
                  </div>
                  <span className="text-sm font-bold text-emerald-600 text-emerald-400">{CLP(totalMes)}</span>
                </div>

                <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Próximos cobros</p>
                {Object.entries(cobrosDelMes)
                  .filter(([dia]) => new Date(anio, mes, parseInt(dia)) >= new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .slice(0, 5)
                  .map(([dia, lista]) => (
                    <div key={dia} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${esHoy(parseInt(dia)) ? 'bg-zinc-900 dark:bg-white/[0.05] text-white text-white' : 'bg-white/[0.05]/[0.05] bg-white/[0.05]/[0.06] text-zinc-500 text-zinc-400'}`}>
                          {dia}
                        </div>
                        <span className="text-xs text-zinc-500 text-zinc-400 truncate max-w-[100px]">
                          {lista.map(c => c.name?.split(' ')[0]).join(', ')}
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-zinc-300 text-zinc-300">
                        {CLP(lista.reduce((s, c) => s + (c.monthlyAmount || 0), 0))}
                      </span>
                    </div>
                  ))
                }
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
