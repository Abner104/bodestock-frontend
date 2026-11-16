// src/components/workers/SendEmailModal.jsx
import React, { useState } from 'react';
import { X, Mail, Send, Users, CheckCircle, AlertTriangle } from 'lucide-react';
import { API_URL } from '../../config/env';

const SendEmailModal = ({ workers, onClose, senderName, companyName, companyId }) => {
  const activeWorkers = workers.filter(w => w.isActive && w.email);

  const [selectedEmails, setSelectedEmails] = useState(activeWorkers.map(w => w.email));
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null); // { success, sent, failed }

  const toggleWorker = (email) => {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const toggleAll = () => {
    if (selectedEmails.length === activeWorkers.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(activeWorkers.map(w => w.email));
    }
  };

  const handleSend = async () => {
    if (!subject.trim() || !message.trim() || selectedEmails.length === 0) return;

    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/emails/send-to-workers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selectedEmails,
          subject: subject.trim(),
          message: message.trim(),
          senderName,
          companyName,
          companyId
        })
      });

      const data = await res.json();
      const sent = data.results?.filter(r => r.success).length ?? 0;
      const failed = data.results?.filter(r => !r.success).length ?? 0;
      setResult({ success: data.success, sent, failed });
    } catch (err) {
      setResult({ success: false, sent: 0, failed: selectedEmails.length });
    } finally {
      setSending(false);
    }
  };

  if (result) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative w-full max-w-md bg-white rounded-xl shadow-2xl p-8 text-center">
          {result.sent > 0 ? (
            <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          ) : (
            <AlertTriangle className="w-14 h-14 text-red-500 mx-auto mb-4" />
          )}
          <h3 className="text-xl font-semibold text-slate-900 mb-2">
            {result.sent > 0 ? '¡Emails enviados!' : 'Error al enviar'}
          </h3>
          <p className="text-slate-500 mb-6">
            {result.sent > 0 && <span className="text-green-600 font-medium">{result.sent} enviados correctamente</span>}
            {result.failed > 0 && <span className="text-red-500 font-medium ml-2">{result.failed} fallaron</span>}
          </p>
          <button
            onClick={onClose}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-slate-900">Enviar email a empleados</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Destinatarios */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-1">
                <Users className="w-4 h-4" />
                Destinatarios ({selectedEmails.length} seleccionados)
              </label>
              <button
                onClick={toggleAll}
                className="text-xs text-blue-600 hover:underline"
              >
                {selectedEmails.length === activeWorkers.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>
            <div className="border rounded-lg max-h-40 overflow-y-auto divide-y">
              {activeWorkers.length === 0 ? (
                <p className="text-sm text-slate-400 p-3 text-center">No hay empleados activos con email</p>
              ) : (
                activeWorkers.map(worker => (
                  <label
                    key={worker.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmails.includes(worker.email)}
                      onChange={() => toggleWorker(worker.email)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{worker.name}</p>
                      <p className="text-xs text-slate-500 truncate">{worker.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Asunto */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="Ej: Actualización importante del turno"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Mensaje */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mensaje</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Escribe tu mensaje aquí..."
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim() || selectedEmails.length === 0}
            className="flex items-center gap-2 px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            <Send className="w-4 h-4" />
            {sending ? 'Enviando...' : `Enviar a ${selectedEmails.length} empleado${selectedEmails.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SendEmailModal;
