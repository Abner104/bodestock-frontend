// src/components/inventory/notifications/PermissionRequestNotification.jsx
import React, { useState } from 'react';
import {
  AlertTriangle,
  User,
  Package,
  DollarSign,
  Check,
  X,
  Clock,
  MessageSquare
} from 'lucide-react';

const PermissionRequestNotification = ({
  isOpen,
  onClose,
  onApprove,
  onReject,
  permissionData,
  workerData
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showRejectionForm, setShowRejectionForm] = useState(false);
  const [showApprovalForm, setShowApprovalForm] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen || !permissionData || !workerData) return null;

  const formatCLP = (amount) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const handleApprove = async () => {
    if (!showApprovalForm) {
      setShowApprovalForm(true);
      return;
    }

    setLoading(true);
    try {
      await onApprove({
        permissionId: permissionData.id,
        notes: approvalNotes.trim(),
        approvedBy: 'admin', // TODO: get from current user
        approvedAt: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      console.error('Error approving permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectionForm) {
      setShowRejectionForm(true);
      return;
    }

    if (!rejectionReason.trim()) {
      alert('Debes proporcionar una razón para el rechazo');
      return;
    }

    setLoading(true);
    try {
      await onReject({
        permissionId: permissionData.id,
        reason: rejectionReason.trim(),
        rejectedBy: 'admin', // TODO: get from current user
        rejectedAt: new Date().toISOString()
      });
      onClose();
    } catch (error) {
      console.error('Error rejecting permission:', error);
    } finally {
      setLoading(false);
    }
  };

  const isMoneyLimit = permissionData.limitType === 'MONEY';
  const exceededAmount = isMoneyLimit
    ? permissionData.requestedAmount - permissionData.availableAmount
    : permissionData.requestedProducts - permissionData.availableProducts;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-6 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-full">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Solicitud de Permiso</h2>
              <p className="text-orange-100 text-sm">Exceso de límite diario</p>
            </div>
          </div>
        </div>

        {/* Worker Info */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-full">
              <User className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{workerData.name}</h3>
              <p className="text-sm text-gray-600">{workerData.email}</p>
              <p className="text-xs text-gray-500">{workerData.role}</p>
            </div>
          </div>

          {/* Limit Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">Detalles del Límite</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Tipo de límite:</span>
                <span className="font-medium">
                  {isMoneyLimit ? (
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      Monetario
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Package className="w-4 h-4" />
                      Por Productos
                    </span>
                  )}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Límite diario:</span>
                <span className="font-medium">
                  {isMoneyLimit
                    ? formatCLP(permissionData.dailyLimit)
                    : `${permissionData.dailyLimit} productos`
                  }
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Ya usado:</span>
                <span className="font-medium text-orange-600">
                  {isMoneyLimit
                    ? formatCLP(permissionData.usedAmount)
                    : `${permissionData.usedAmount} productos`
                  }
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-600">Disponible:</span>
                <span className="font-medium text-green-600">
                  {isMoneyLimit
                    ? formatCLP(permissionData.availableAmount)
                    : `${permissionData.availableProducts} productos`
                  }
                </span>
              </div>

              <div className="border-t pt-2 mt-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Solicita:</span>
                  <span className="font-bold text-red-600">
                    {isMoneyLimit
                      ? formatCLP(permissionData.requestedAmount)
                      : `${permissionData.requestedProducts} productos`
                    }
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-600">Exceso:</span>
                  <span className="font-bold text-red-700">
                    {isMoneyLimit
                      ? formatCLP(exceededAmount)
                      : `${exceededAmount} productos`
                    }
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Request Details */}
        {permissionData.products && permissionData.products.length > 0 && (
          <div className="p-6 border-b border-gray-100">
            <h4 className="font-medium text-gray-900 mb-3">Productos Solicitados</h4>
            <div className="space-y-2">
              {permissionData.products.map((product, index) => (
                <div key={index} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700">{product.name}</span>
                  <span className="font-medium">
                    {product.quantity} {product.unit}
                    {isMoneyLimit && (
                      <span className="text-gray-500 ml-2">
                        ({formatCLP(product.totalValue)})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {permissionData.reason && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Motivo
                </h5>
                <p className="text-blue-800 text-sm">{permissionData.reason}</p>
              </div>
            )}

            {permissionData.notes && (
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <h5 className="font-medium text-gray-900 mb-2">Notas del Trabajador</h5>
                <p className="text-gray-700 text-sm">{permissionData.notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Rejection Form */}
        {showRejectionForm && (
          <div className="p-6 border-b border-gray-100 bg-red-50">
            <h4 className="font-medium text-red-900 mb-3">Razón del Rechazo</h4>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Explica por qué se rechaza esta solicitud..."
              className="w-full px-3 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
              rows="3"
            />
          </div>
        )}

        {/* Approval Form */}
        {showApprovalForm && (
          <div className="p-6 border-b border-gray-100 bg-green-50">
            <h4 className="font-medium text-green-900 mb-3">Notas de Aprobación (Opcional)</h4>
            <textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Notas adicionales sobre la aprobación..."
              className="w-full px-3 py-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              rows="2"
            />
          </div>
        )}

        {/* Actions */}
        <div className="p-6">
          <div className="flex gap-3">
            {!showRejectionForm && !showApprovalForm && (
              <>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Rechazar
                </button>
                <button
                  onClick={handleApprove}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Aprobar
                </button>
              </>
            )}

            {(showRejectionForm || showApprovalForm) && (
              <>
                <button
                  onClick={() => {
                    setShowRejectionForm(false);
                    setShowApprovalForm(false);
                    setRejectionReason('');
                    setApprovalNotes('');
                  }}
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50 transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={showRejectionForm ? handleReject : handleApprove}
                  disabled={loading || (showRejectionForm && !rejectionReason.trim())}
                  className={`flex-2 px-4 py-3 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 ${
                    showRejectionForm
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {loading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : showRejectionForm ? (
                    <>
                      <X className="w-4 h-4" />
                      Confirmar Rechazo
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Confirmar Aprobación
                    </>
                  )}
                </button>
              </>
            )}
          </div>

          {!showRejectionForm && !showApprovalForm && (
            <button
              onClick={onClose}
              disabled={loading}
              className="w-full mt-3 px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition font-medium"
            >
              Cerrar sin Acción
            </button>
          )}
        </div>

        {/* Timestamp */}
        <div className="px-6 pb-4">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            Solicitud recibida: {new Date(permissionData.requestedAt).toLocaleString('es-CL')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionRequestNotification;