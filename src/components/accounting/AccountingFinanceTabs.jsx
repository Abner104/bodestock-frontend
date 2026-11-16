// src/components/accounting/AccountingFinanceTabs.jsx
// Agrupa las 3 herramientas financieras del Agente de Contabilidad (IVA
// estimado, Cierre de mes, Conciliar banco) en pestañas -- antes vivían
// apiladas una debajo de otra dentro del panel, lo que hacía sentir el
// panel como una lista larga sin jerarquía. Solo la pestaña activa se
// monta, así cada una sigue cargando sus datos de forma perezosa (lazy).
import { useState } from 'react';
import VatEstimatePanel from './VatEstimatePanel';
import MonthCloseSummary from './MonthCloseSummary';
import BankReconciliationPanel from './BankReconciliationPanel';
import PurchaseSalesBookPanel from './PurchaseSalesBookPanel';

const TABS = [
  { id: 'vat', label: 'IVA' },
  { id: 'close', label: 'Cierre' },
  { id: 'book', label: 'Libro' },
  { id: 'bank', label: 'Banco' },
];

export default function AccountingFinanceTabs({ companyId, companyName }) {
  const [activeTab, setActiveTab] = useState('vat');

  return (
    <div>
      <div className="flex items-center gap-1 mb-3 bg-white/[0.03] rounded-lg p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'vat' && <VatEstimatePanel companyId={companyId} />}
      {activeTab === 'close' && <MonthCloseSummary companyId={companyId} />}
      {activeTab === 'book' && <PurchaseSalesBookPanel companyId={companyId} companyName={companyName} />}
      {activeTab === 'bank' && (
        <div className="-mx-4">
          <BankReconciliationPanel companyId={companyId} />
        </div>
      )}
    </div>
  );
}
