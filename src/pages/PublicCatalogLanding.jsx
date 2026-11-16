// src/pages/PublicCatalogLanding.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Store,
  Package,
  ArrowRight,
  Loader,
  AlertCircle,
  ShoppingCart,
  Warehouse,
  UtensilsCrossed,
  Box
} from 'lucide-react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * Página de selección de catálogos públicos
 * Muestra todos los inventarios de una empresa que tienen catalogEnabled: true
 */
const PublicCatalogLanding = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [catalogs, setCatalogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!companyId) {
      setError('ID de empresa no válido');
      setLoading(false);
      return;
    }

    loadData();
  }, [companyId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Cargar información de la empresa
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (!companyDoc.exists()) {
        setError('Empresa no encontrada');
        setLoading(false);
        return;
      }

      setCompany({
        id: companyDoc.id,
        ...companyDoc.data()
      });

      // 2. Cargar inventarios públicos
      const inventoriesRef = collection(db, `companies/${companyId}/inventories`);
      const inventoriesSnapshot = await getDocs(inventoriesRef);

      const publicCatalogs = [];

      for (const inventoryDoc of inventoriesSnapshot.docs) {
        const inventoryId = inventoryDoc.id;

        // Obtener metadata del inventario
        const metadataRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`);
        const metadataSnapshot = await getDocs(metadataRef);

        if (!metadataSnapshot.empty) {
          const metadata = metadataSnapshot.docs[0].data();

          // Solo agregar si catalogEnabled === true
          if (metadata.catalogEnabled === true) {
            // Contar productos disponibles
            const productsRef = collection(db, `companies/${companyId}/inventories/${inventoryId}/products`);
            const productsSnapshot = await getDocs(productsRef);

            // Segunda capa de seguridad además del guardrail al activar el
            // toggle (ver toggleCatalog en InventoriesManagement.jsx): un
            // inventario puramente de insumos (ej. "Insumos") nunca debe
            // listarse como tienda, aunque por algún motivo tenga
            // catalogEnabled=true (dato legacy, o cambiado directo en
            // Firestore). Sin este filtro, el cliente final veía ese
            // inventario como una segunda tienda seleccionable.
            const sellableProducts = productsSnapshot.docs.filter(doc => {
              const data = doc.data();
              return data.productType !== 'INSUMO' && data.showInCatalog !== false;
            });
            if (sellableProducts.length === 0) continue;

            const availableProducts = sellableProducts.filter(doc => doc.data().stock > 0).length;

            publicCatalogs.push({
              id: inventoryId,
              name: metadata.name,
              type: metadata.type,
              description: metadata.description || '',
              productsCount: availableProducts
            });
          }
        }
      }

      setCatalogs(publicCatalogs);
    } catch (error) {
      console.error('Error cargando catálogos:', error);
      setError('Error al cargar los catálogos. Intenta de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      RETAIL: Store,
      WHOLESALE: Warehouse,
      RESTAURANT: UtensilsCrossed,
      WAREHOUSE: Box,
      OTHER: Package
    };
    return icons[type] || Package;
  };

  const getTypeLabel = (type) => {
    const labels = {
      RETAIL: 'Retail / Minimarket',
      WHOLESALE: 'Distribuidora / Mayorista',
      RESTAURANT: 'Restaurante / Cocina',
      WAREHOUSE: 'Bodega / Almacén',
      OTHER: 'Otros Productos'
    };
    return labels[type] || 'Catálogo';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-slate-600">Cargando catálogos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Error</h1>
          <p className="text-slate-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  // Si solo hay un catálogo, redirigir automáticamente
  if (catalogs.length === 1) {
    navigate(`/catalogo-publico/${companyId}/${catalogs[0].id}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Store className="w-12 h-12 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">
              {company?.name || 'Nuestros Catálogos'}
            </h1>
            <p className="text-lg text-slate-600">
              Selecciona el catálogo que deseas explorar
            </p>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {catalogs.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-20 h-20 text-slate-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              No hay catálogos disponibles
            </h3>
            <p className="text-slate-600">
              Vuelve pronto para ver nuestros productos
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {catalogs.map((catalog) => {
              const TypeIcon = getTypeIcon(catalog.type);

              return (
                <motion.div
                  key={catalog.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={{ scale: 1.02 }}
                  className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/catalogo-publico/${companyId}/${catalog.id}`)}
                >
                  {/* Header del catálogo */}
                  <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-8 text-white">
                    <TypeIcon className="w-12 h-12 mb-4" />
                    <h2 className="text-2xl font-bold mb-2">{catalog.name}</h2>
                    <p className="text-blue-100 text-sm">{getTypeLabel(catalog.type)}</p>
                  </div>

                  {/* Contenido */}
                  <div className="p-6">
                    {catalog.description && (
                      <p className="text-slate-600 mb-4 line-clamp-3">
                        {catalog.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-2 mb-4 p-3 bg-slate-50 rounded-lg">
                      <Package className="w-5 h-5 text-slate-400" />
                      <div>
                        <p className="text-2xl font-bold text-slate-900">
                          {catalog.productsCount}
                        </p>
                        <p className="text-sm text-slate-600">
                          {catalog.productsCount === 1 ? 'Producto disponible' : 'Productos disponibles'}
                        </p>
                      </div>
                    </div>

                    {/* Botón */}
                    <button
                      onClick={() => navigate(`/catalogo-publico/${companyId}/${catalog.id}`)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 group"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Ver Productos
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center">
          <p className="text-slate-600">
            © {new Date().getFullYear()} {company?.name || 'Tu Empresa'}. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicCatalogLanding;
