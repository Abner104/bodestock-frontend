// src/pages/SuperAdminCiudad3D.jsx
// Propuesta/demo: mapa 3D isométrico de la distribuidora (modelo hecho en
// Blender por el equipo). Es un prototipo visual aparte del mapa 2D real
// (/super-admin/agentes, Konva) -- NO lo reemplaza, no se usa operativamente.
// Fullscreen real (portal a document.body, mismo patrón que
// BodestockWorldView en mobile): el visor ya trae su propia barra superior
// y chips inferiores, así que compartir espacio con el header/padding del
// layout admin solo le recorta pantalla sin aportar nada.
import React from 'react';
import { createPortal } from 'react-dom';
import Ciudad3DView from '../components/Ciudad3D/Ciudad3DView';
import { useCompanySelector } from '../hooks/useCompanySelector';

export default function SuperAdminCiudad3D() {
  const { companies, companyId, companyName, selectCompany } = useCompanySelector();

  return createPortal(
    <div className="fixed inset-0 z-50">
      <Ciudad3DView
        companyId={companyId}
        companyName={companyName}
        companies={companies}
        onSelectCompany={selectCompany}
      />
    </div>,
    document.body
  );
}
