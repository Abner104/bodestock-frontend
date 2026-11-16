// src/pages/WorkerWarehouses.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Warehouse,
  Package,
  ArrowLeft,
  AlertTriangle,
  Search,
  MapPin,
  Users,
  Camera,
  X,
  ShoppingCart
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/firebase.js';
import { getWorkerByEmail } from '../services/workers-service.js';
import { getUserCompanyId } from '../services/companyService.js';
import ImprovedBarcodeScanner from '../components/inventory/ImprovedBarcodeScanner.jsx';
import GlobalLoading from '../components/GlobalLoading.jsx';
import WorkerDrawerMenu from '../components/WorkerDrawerMenu.jsx';
import { SUPER_ADMIN_EMAIL } from '../config/env.js';

const WorkerWarehouses = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clienteRut = searchParams.get('clienteRut') || '';
  const clienteNombre = searchParams.get('clienteNombre') || '';
  const clienteDireccion = searchParams.get('clienteDireccion') || '';
  const clienteComuna = searchParams.get('clienteComuna') || '';
  const tipoVenta = searchParams.get('tipoVenta') || '';
  const [loading, setLoading] = useState(true);
  const [worker, setWorker] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [allProducts, setAllProducts] = useState([]);
  const [inventoriesWithWarehouses, setInventoriesWithWarehouses] = useState([]);

  // ===== EFECTOS =====
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }

      try {
        // SUPER_ADMIN y ADMIN pueden ver todas las bodegas
        const workerData = await getWorkerByEmail(user.email);

        if (!workerData) {
          // Si no es worker, verificar si es SUPER_ADMIN o ADMIN
          if (user.email === SUPER_ADMIN_EMAIL) {
            console.log('👑 SUPER_ADMIN - Cargando todas las bodegas');
            setWorker({ name: 'Super Admin', role: 'SUPER_ADMIN', email: user.email });
            await loadAllWarehouses();
            return;
          }

          // Usuario no es worker ni super admin - asumir ADMIN
          console.log('✅ Usuario ADMIN - Cargando todas las bodegas');
          setWorker({ name: 'Administrador', role: 'ADMIN', email: user.email });
          await loadAllWarehouses();
          return;
        }

        // Es un worker registrado
        setWorker(workerData);

        // Auto-redirect: si tiene exactamente 1 bodega asignada específica, ir directo
        if (workerData.assignedWarehouses && workerData.assignedWarehouses.length === 1) {
          const warehouseId = workerData.assignedWarehouses[0];
          const companyId = await getUserCompanyId();
          // Buscar la bodega en inventarios dinámicos
          let foundWarehouse = null;
          if (companyId) {
            const { getDocs: gd, collection: col } = await import('firebase/firestore');
            const invSnap = await gd(col(db, `companies/${companyId}/inventories`));
            for (const invDoc of invSnap.docs) {
              const whSnap = await gd(col(db, `companies/${companyId}/inventories/${invDoc.id}/warehouses`));
              const whDoc = whSnap.docs.find(d => d.id === warehouseId);
              if (whDoc) {
                foundWarehouse = { id: whDoc.id, ...whDoc.data(), inventoryId: invDoc.id };
                break;
              }
            }
          }
          if (foundWarehouse) {
            const params = new URLSearchParams({
              warehouseId: foundWarehouse.id,
              name: foundWarehouse.name || warehouseId,
              location: foundWarehouse.location || '',
              inventoryId: foundWarehouse.inventoryId || '',
              ...(clienteRut && { clienteRut, clienteNombre, clienteDireccion, clienteComuna }),
              ...(tipoVenta && { tipoVenta }),
            });
            navigate(`/salida-inventario?${params.toString()}`, { replace: true });
            return;
          }
        }

        // Si tiene inventarios asignados (sucursales), mostrar solo esos — sin importar el rol
        if (workerData.assignedInventories && workerData.assignedInventories.length > 0) {
          await loadAssignedInventoriesAndWarehouses(workerData);
        } else if (workerData.role === 'ADMIN' || workerData.role === 'SUPERVISOR') {
          // Sin asignación específica: ADMIN/SUPERVISOR ve todo (es de la empresa completa)
          await loadAllWarehouses();
        } else {
          // WORKER sin asignación: mostrar vacío o solo bodegas heredadas
          await loadAssignedInventoriesAndWarehouses(workerData);
        }

      } catch (error) {
        console.error('Error cargando datos:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // ===== FUNCIONES =====
  const loadAssignedInventoriesAndWarehouses = async (workerData) => {
    try {
      console.log('🏭 Cargando inventarios y bodegas asignados para:', workerData.name);
      console.log('📦 Inventarios asignados:', workerData.assignedInventories);
      console.log('📋 Bodegas asignadas:', workerData.assignedWarehouses);

      const companyId = await getUserCompanyId();
      if (!companyId) {
        console.error('❌ No se pudo obtener el companyId');
        setInventoriesWithWarehouses([]);
        return;
      }

      const inventoriesData = [];

      // 1. Cargar INVENTARIOS asignados (nuevo sistema)
      if (workerData.assignedInventories && workerData.assignedInventories.length > 0) {
        for (const invId of workerData.assignedInventories) {
          try {
            // Obtener datos del inventario
            const invDoc = await getDoc(doc(db, `companies/${companyId}/inventories`, invId));
            if (!invDoc.exists()) {
              console.warn(`⚠️  Inventario ${invId} no encontrado`);
              continue;
            }

            const invData = invDoc.data();
            const inventory = {
              id: invDoc.id,
              name: invData.name || invData.nombre || 'Sin nombre',
              description: invData.description || invData.descripcion || '',
              ...invData,
              warehouses: []
            };

            // Obtener bodegas de este inventario
            const warehousesSnapshot = await getDocs(collection(db, `companies/${companyId}/inventories/${invId}/warehouses`));
            warehousesSnapshot.forEach(whDoc => {
              inventory.warehouses.push({
                id: whDoc.id,
                ...whDoc.data(),
                inventoryId: invId,
                inventoryName: inventory.name
              });
            });

            inventoriesData.push(inventory);
            console.log(`✅ Inventario cargado: ${inventory.name} con ${inventory.warehouses.length} bodegas`);
          } catch (error) {
            console.error(`❌ Error cargando inventario ${invId}:`, error);
          }
        }
      }

      // 2. Cargar BODEGAS LEGACY asignadas (sistema antiguo)
      if (workerData.assignedWarehouses && workerData.assignedWarehouses.length > 0) {
        try {
          const warehousesQuery = query(
            collection(db, `companies/${companyId}/warehouses`),
            where('__name__', 'in', workerData.assignedWarehouses)
          );

          const snapshot = await getDocs(warehousesQuery);
          if (snapshot.size > 0) {
            const legacyInventory = {
              id: 'legacy',
              name: '📦 Bodegas Principales',
              description: 'Bodegas del sistema principal',
              warehouses: []
            };

            snapshot.forEach(whDoc => {
              legacyInventory.warehouses.push({
                id: whDoc.id,
                ...whDoc.data(),
                inventoryId: null,
                inventoryName: 'Principal'
              });
            });

            inventoriesData.push(legacyInventory);
            console.log(`✅ Bodegas legacy cargadas: ${legacyInventory.warehouses.length}`);
          }
        } catch (error) {
          console.error('❌ Error cargando bodegas legacy:', error);
        }
      }

      console.log('✅ Total inventarios con bodegas:', inventoriesData.length);

      // Auto-redirect: si hay exactamente 1 bodega disponible, ir directo
      const allWarehouses = inventoriesData.flatMap(inv => inv.warehouses || []);
      if (allWarehouses.length === 1) {
        console.log('🚀 Auto-redirect: 1 sola bodega disponible, entrando directo');
        const warehouse = allWarehouses[0];
        const params = new URLSearchParams({
          warehouseId: warehouse.id,
          name: warehouse.name,
          location: warehouse.location || '',
          inventoryId: warehouse.inventoryId || '',
          ...(clienteRut && { clienteRut, clienteNombre, clienteDireccion, clienteComuna }),
          ...(tipoVenta && { tipoVenta }),
        });
        navigate(`/salida-inventario?${params.toString()}`, { replace: true });
        return;
      }

      setInventoriesWithWarehouses(inventoriesData);

    } catch (error) {
      console.error('Error cargando inventarios y bodegas:', error);
      setInventoriesWithWarehouses([]);
    }
  };

  // Cargar TODAS las bodegas (para ADMIN y SUPERVISOR)
  const loadAllWarehouses = async () => {
    try {
      console.log('🏭 Cargando TODOS los inventarios con sus bodegas');

      // Obtener companyId
      const companyId = await getUserCompanyId();
      if (!companyId) {
        console.error('❌ No se pudo obtener el companyId');
        setInventoriesWithWarehouses([]);
        return;
      }

      const inventoriesData = [];

      // 1. Cargar bodegas LEGACY (sin inventario) - companies/{companyId}/warehouses
      try {
        const legacyWarehousesSnapshot = await getDocs(collection(db, `companies/${companyId}/warehouses`));

        if (legacyWarehousesSnapshot.size > 0) {
          const legacyInventory = {
            id: 'legacy',
            name: '📦 Bodegas Principales',
            description: 'Bodegas del sistema principal',
            warehouses: []
          };

          legacyWarehousesSnapshot.forEach(whDoc => {
            legacyInventory.warehouses.push({
              id: whDoc.id,
              ...whDoc.data(),
              inventoryId: null, // Legacy no tiene inventoryId
              inventoryName: 'Principal'
            });
          });

          inventoriesData.push(legacyInventory);
          console.log('✅ Bodegas legacy cargadas:', legacyInventory.warehouses.length);
        }
      } catch (legacyError) {
        console.warn('⚠️ No se pudieron cargar bodegas legacy:', legacyError);
      }

      // 2. Cargar inventarios NUEVOS con sus bodegas
      const inventoriesSnapshot = await getDocs(collection(db, `companies/${companyId}/inventories`));

      for (const invDoc of inventoriesSnapshot.docs) {
        const invData = invDoc.data();
        console.log('📦 Inventario cargado:', invDoc.id, 'Data:', invData);
        console.log('🔍 Campos disponibles:', Object.keys(invData));
        console.log('🔍 Probando campos: name=', invData.name, ', nombre=', invData.nombre, ', displayName=', invData.displayName, ', title=', invData.title);

        const inventory = {
          id: invDoc.id,
          name: invData.name || invData.nombre || invData.displayName || invData.title || invDoc.id,
          description: invData.description || invData.descripcion || '',
          ...invData,
          warehouses: []
        };

        console.log('📦 Inventario procesado:', inventory.id, 'Nombre:', inventory.name);

        // Obtener bodegas de este inventario
        const warehousesSnapshot = await getDocs(collection(db, `companies/${companyId}/inventories/${invDoc.id}/warehouses`));

        warehousesSnapshot.forEach(whDoc => {
          inventory.warehouses.push({
            id: whDoc.id,
            ...whDoc.data(),
            inventoryId: invDoc.id,
            inventoryName: inventory.name
          });
        });

        console.log('✅ Inventario con bodegas:', inventory.name, '- Bodegas:', inventory.warehouses.length);

        // Agregar inventario
        inventoriesData.push(inventory);
      }

      console.log('✅ Total inventarios cargados:', inventoriesData.length, inventoriesData);
      setInventoriesWithWarehouses(inventoriesData);

    } catch (error) {
      console.error('Error cargando inventarios y bodegas:', error);
      setInventoriesWithWarehouses([]);
    }
  };

  const handleWarehouseAccess = (warehouse) => {
    const params = new URLSearchParams({
      warehouseId: warehouse.id,
      name: warehouse.name,
      location: warehouse.location || '',
      inventoryId: warehouse.inventoryId || '',
      inventoryName: warehouse.inventoryName || ''
    });
    if (clienteRut) {
      params.set('clienteRut', clienteRut);
      params.set('clienteNombre', clienteNombre);
      if (clienteDireccion) params.set('clienteDireccion', clienteDireccion);
      if (clienteComuna) params.set('clienteComuna', clienteComuna);
    }
    if (tipoVenta) params.set('tipoVenta', tipoVenta);
    navigate(`/salida-inventario?${params.toString()}`);
  };

  const handleScanSuccess = (product) => {
    console.log('📷 Producto escaneado:', product);
    setShowScanner(false);

    // Navegar a la salida de inventario con el producto pre-seleccionado
    if (warehouses.length > 0) {
      const firstWarehouse = warehouses[0];
      const params = new URLSearchParams({
        warehouseId: firstWarehouse.id,
        name: firstWarehouse.name,
        location: firstWarehouse.location || '',
        productId: product.id
      });
      navigate(`/salida-inventario?${params.toString()}`);
    }
  };

  const loadAllProducts = async () => {
    try {
      const companyId = await getUserCompanyId();
      if (!companyId) return;

      const inventoryRef = collection(db, `companies/${companyId}/inventory`);
      const snapshot = await getDocs(inventoryRef);
      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setAllProducts(products);
    } catch (error) {
      console.error('Error cargando productos:', error);
    }
  };

  useEffect(() => {
    if (warehouses.length > 0) {
      loadAllProducts();
    }
  }, [warehouses]);


  // Filtrar inventarios y sus bodegas por búsqueda
  const filteredInventories = inventoriesWithWarehouses
    .map(inventory => ({
      ...inventory,
      warehouses: inventory.warehouses.filter(warehouse =>
        warehouse.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        warehouse.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inventory.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(inventory => inventory.warehouses.length > 0 ||
            inventory.name?.toLowerCase().includes(searchQuery.toLowerCase()));

  // ===== RENDERIZADO =====
  if (loading) {
    return <GlobalLoading />;
  }

  return (
    <div className="min-h-screen h-full bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Background Decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-100/20 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 min-h-screen h-full">
        {/* Header Moderno */}
        <motion.div
          className="bg-white border-b border-slate-200 shadow-lg"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="flex items-center gap-3 flex-1">
                <motion.div
                  className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg ring-4 ring-blue-500/20"
                  animate={{
                    boxShadow: [
                      '0 10px 30px rgba(59, 130, 246, 0.3)',
                      '0 10px 40px rgba(99, 102, 241, 0.4)',
                      '0 10px 30px rgba(59, 130, 246, 0.3)',
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                >
                  <Warehouse className="w-6 h-6 md:w-7 md:h-7 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-xl md:text-3xl font-bold text-slate-900">Mis Bodegas</h1>
                  <p className="text-xs md:text-sm text-slate-600">
                    Bodegas asignadas para <span className="font-semibold text-blue-600">{worker?.name}</span>
                  </p>
                </div>
              </div>
              {['WORKER', 'CAJERA', 'VENDEDORA'].includes(worker?.role) && (
                <div className="ml-auto">
                  <WorkerDrawerMenu workerRole={worker?.role} workerName={worker?.name} dark={false} />
                </div>
              )}
            </div>
          </div>
        </motion.div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 pb-safe-nav md:pb-8">
          {/* Banner cliente preseleccionado */}
          {clienteRut && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-3 px-4 py-3 bg-blue-600 text-white rounded-xl shadow-lg"
            >
              <ShoppingCart className="w-5 h-5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Pedido para: {clienteNombre}</p>
                <p className="text-xs text-blue-200">RUT {clienteRut} · Elige la bodega para continuar</p>
              </div>
              <button
                onClick={() => navigate('/clientes')}
                className="p-1.5 rounded-lg hover:bg-blue-500 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Buscador Mejorado */}
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Buscar bodega por nombre o ubicación..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 md:py-4 bg-white border-2 border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </motion.div>

          {/* Lista de Inventarios y Bodegas */}
          {filteredInventories.length > 0 ? (
            <div className="space-y-6">
              {filteredInventories.map((inventory, invIndex) => (
                <motion.div
                  key={inventory.id}
                  className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 overflow-hidden"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * invIndex }}
                >
                  {/* Header del Inventario */}
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-5 md:px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center ring-2 ring-white/30">
                        <Package className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-white text-xl">{inventory.name}</h3>
                        <p className="text-purple-100 text-sm">{inventory.warehouses.length} bodega(s) disponible(s)</p>
                      </div>
                    </div>
                  </div>

                  {/* Grid de Bodegas del Inventario */}
                  {inventory.warehouses.length > 0 ? (
                    <div className="p-5 md:p-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {inventory.warehouses.map((warehouse, whIndex) => (
                          <motion.div
                            key={warehouse.id}
                            className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl border-2 border-slate-200 hover:border-blue-500 hover:shadow-lg transition-all p-4 group"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.15 * invIndex + 0.05 * whIndex }}
                            whileHover={{ y: -3, scale: 1.02 }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex items-center space-x-2 flex-1">
                                <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-all">
                                  <Warehouse className="w-5 h-5 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-slate-900 text-base group-hover:text-blue-600 transition-colors truncate">
                                    {warehouse.name}
                                  </h4>
                                  {warehouse.location && (
                                    <div className="flex items-center space-x-1 text-xs text-slate-600 mt-0.5">
                                      <MapPin className="w-3 h-3 flex-shrink-0" />
                                      <span className="truncate">{warehouse.location}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <motion.button
                              onClick={() => handleWarehouseAccess(warehouse)}
                              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2.5 px-4 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all text-sm"
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Package className="w-4 h-4" />
                              <span>Ver Productos</span>
                            </motion.button>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500">
                      <AlertTriangle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm">Este inventario no tiene bodegas asignadas</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : inventoriesWithWarehouses.length === 0 ? (
            <motion.div
              className="text-center py-12 md:py-16"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div
                className="w-20 h-20 md:w-24 md:h-24 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4"
                animate={{
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <AlertTriangle className="w-10 h-10 md:w-12 md:h-12 text-orange-500" />
              </motion.div>
              <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-2">Sin Bodegas Asignadas</h3>
              <p className="text-slate-600 mb-6 text-sm md:text-base">
                No tienes bodegas asignadas actualmente. Contacta al administrador para obtener acceso.
              </p>
              <motion.button
                onClick={() => navigate('/dashboard-trabajador')}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                Volver al Dashboard
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Sin Resultados</h3>
              <p className="text-slate-600">
                No se encontraron bodegas que coincidan con tu búsqueda.
              </p>
            </motion.div>
          )}

          {/* Info adicional */}
          {warehouses.length > 0 && (
            <motion.div
              className="mt-8 bg-white border-2 border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-start space-x-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-sm flex-1">
                  <h4 className="font-semibold text-slate-900 mb-1">Información</h4>
                  <p className="text-slate-600">
                    Tienes acceso a <strong className="text-blue-600">{warehouses.length}</strong> bodega{warehouses.length !== 1 ? 's' : ''}.
                    Selecciona una bodega para gestionar su inventario y registrar salidas de productos.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WorkerWarehouses;