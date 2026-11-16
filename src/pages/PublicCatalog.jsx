// src/pages/PublicCatalog.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Search,
  Store,
  Package,
  AlertCircle
} from 'lucide-react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import ProductImageCarousel from '../components/ProductImageCarousel';

const PublicCatalog = () => {
  const { companyId, inventoryId } = useParams();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [companyInfo, setCompanyInfo] = useState(null);
  const [theme, setTheme] = useState({ primaryColor: '#3b82f6', darkMode: false, logoUrl: '', bannerUrl: '', welcomeText: '', showStock: true });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('TODOS');

  // Cargar información de la empresa y productos
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    loadCompanyData();
    loadProducts();
    if (inventoryId) loadTheme();
  }, [companyId, inventoryId]);

  const loadTheme = async () => {
    try {
      const metaSnap = await getDocs(collection(db, `companies/${companyId}/inventories/${inventoryId}/metadata`));
      if (!metaSnap.empty) {
        const data = metaSnap.docs[0].data();
        if (data.catalogTheme) {
          setTheme(t => ({ ...t, ...data.catalogTheme }));
        }
      }
    } catch (e) { /* sin tema, usa defaults */ }
  };

  const loadCompanyData = async () => {
    try {
      // Intentar cargar datos de la empresa desde Firestore
      const companyDoc = await getDoc(doc(db, 'companies', companyId));
      if (companyDoc.exists()) {
        setCompanyInfo({
          id: companyDoc.id,
          ...companyDoc.data()
        });
      } else {
        setCompanyInfo({
          id: companyId,
          name: 'Catálogo de Productos',
          description: 'Bienvenido a nuestra tienda online'
        });
      }
    } catch (error) {
      console.error('Error cargando datos de la empresa:', error);
      setCompanyInfo({
        id: companyId,
        name: 'Catálogo de Productos',
        description: 'Bienvenido a nuestra tienda online'
      });
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);

      // Cargar productos del inventario
      // Si inventoryId está presente, usar la nueva estructura: companies/{companyId}/inventories/{inventoryId}/products
      // Si no, usar la estructura legacy: companies/{companyId}/inventory
      const inventoryPath = inventoryId
        ? `companies/${companyId}/inventories/${inventoryId}/products`
        : `companies/${companyId}/inventory`;

      const inventoryRef = collection(db, inventoryPath);
      const snapshot = await getDocs(inventoryRef);

      const productsData = snapshot.docs.map(doc => {
        const data = doc.data();
        const unitPrice = data.salePrice || data.price || data.ppp || 0;
        const stock = data.stock || data.qty || 0;
        return {
          id: doc.id,
          name: data.name,
          category: data.category || 'Sin categoría',
          salePrice: unitPrice,
          totalPrice: unitPrice * stock,
          stock: stock,
          unit: data.unit || 'unidad',
          description: data.description || '',
          images: data.photos || (data.photoURL || data.image ? [data.photoURL || data.image] : []),
          presentations: data.presentations || []
        };
      }).filter(p => {
        // FILTRO: Solo productos con stock disponible
        // Si el inventario tiene catalogEnabled: true, TODOS los productos con stock se muestran
        return p.stock > 0;
      });

      setProducts(productsData);
    } catch (error) {
      console.error('Error cargando productos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Obtener categorías únicas
  const categories = ['TODOS', ...new Set(products.map(p => p.category))];

  // Filtrar productos
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'TODOS' || product.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  // Formatear precio CLP
  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!companyId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Catálogo no encontrado</h1>
          <p className="text-slate-600">El enlace del catálogo no es válido</p>
        </div>
      </div>
    );
  }

  const bg = theme.darkMode ? '#0a0a0f' : '#f8fafc';
  const cardBg = theme.darkMode ? '#111118' : '#ffffff';
  const textPrimary = theme.darkMode ? '#ffffff' : '#0f172a';
  const textSecondary = theme.darkMode ? '#6b7280' : '#64748b';
  const border = theme.darkMode ? 'rgba(255,255,255,0.07)' : '#e2e8f0';
  const inputBg = theme.darkMode ? 'rgba(255,255,255,0.05)' : '#ffffff';

  return (
    <div className="min-h-screen" style={{ background: bg }}>

      {/* Banner portada */}
      {theme.bannerUrl && (
        <div className="relative h-36 sm:h-48 overflow-hidden">
          <img src={theme.bannerUrl} alt="banner" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `${bg}99` }} />
          <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
            {theme.logoUrl && (
              <img src={theme.logoUrl} alt="logo" className="w-14 h-14 rounded-2xl object-cover shadow-lg" onError={e => e.target.style.display='none'} />
            )}
            <h1 className="text-2xl sm:text-3xl font-black" style={{ color: textPrimary }}>{companyInfo?.name}</h1>
            {theme.welcomeText && <p className="text-sm font-semibold" style={{ color: theme.primaryColor }}>{theme.welcomeText}</p>}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 shadow-md" style={{ background: cardBg, borderBottom: `1px solid ${border}` }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {!theme.bannerUrl && (
            <div className="flex items-center gap-3 mb-3">
              {theme.logoUrl
                ? <img src={theme.logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" onError={e => e.target.style.display='none'} />
                : <Store className="w-7 h-7 flex-shrink-0" style={{ color: theme.primaryColor }} />
              }
              <div>
                <h1 className="text-xl font-bold" style={{ color: textPrimary }}>{companyInfo?.name || 'Catálogo'}</h1>
                {theme.welcomeText && <p className="text-xs" style={{ color: theme.primaryColor }}>{theme.welcomeText}</p>}
              </div>
            </div>
          )}

          {/* Búsqueda */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: textSecondary }} />
              <input
                type="text"
                placeholder="Buscar productos..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg text-sm focus:outline-none"
                style={{ background: inputBg, border: `1.5px solid ${border}`, color: textPrimary }}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:pb-0">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className="px-3 py-1.5 rounded-lg font-semibold text-xs whitespace-nowrap transition-all"
                  style={selectedCategory === cat
                    ? { background: theme.primaryColor, color: '#fff' }
                    : { background: inputBg, color: textSecondary, border: `1.5px solid ${border}` }
                  }
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2" style={{ borderColor: theme.primaryColor }} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-14 h-14 mx-auto mb-4 opacity-20" style={{ color: textPrimary }} />
            <h3 className="text-lg font-bold mb-2" style={{ color: textPrimary }}>No hay productos disponibles</h3>
            <p className="text-sm" style={{ color: textSecondary }}>
              {searchQuery || selectedCategory !== 'TODOS' ? 'Intenta con otros filtros' : 'Vuelve pronto'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredProducts.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl overflow-hidden transition-all hover:scale-[1.02]"
                style={{ background: cardBg, border: `1px solid ${border}`, boxShadow: theme.darkMode ? 'none' : '0 2px 12px rgba(0,0,0,0.07)' }}
              >
                {/* Imagen / galería */}
                <div className="h-40 flex items-center justify-center relative overflow-hidden group"
                  style={{ background: theme.darkMode ? 'rgba(255,255,255,0.03)' : '#f1f5f9' }}>
                  <ProductImageCarousel
                    images={product.images}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    iconClassName="w-12 h-12 opacity-20"
                    iconStyle={{ color: textPrimary }}
                  />
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: theme.primaryColor }}>
                    {product.category}
                  </p>
                  <h3 className="text-sm font-bold leading-tight mb-2 line-clamp-2" style={{ color: textPrimary }}>
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="text-xs mb-2 line-clamp-2" style={{ color: textSecondary }}>{product.description}</p>
                  )}
                  <div className="flex items-end justify-between gap-1">
                    <span className="text-base font-black" style={{ color: theme.primaryColor }}>
                      {formatCLP(product.salePrice)}<span className="text-xs font-normal opacity-60">/{product.unit}</span>
                    </span>
                    {theme.showStock && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ background: `${theme.primaryColor}20`, color: theme.primaryColor }}>
                        {product.stock > 10 ? 'Disponible' : `${product.stock} ud.`}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicCatalog;
