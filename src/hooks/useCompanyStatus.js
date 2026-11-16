// src/hooks/useCompanyStatus.js
import { useState, useEffect } from 'react';
import { auth, db } from '../firebase/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getUserCompanyId } from '../services/companyService';

export function useCompanyStatus() {
  const [companyStatus, setCompanyStatus] = useState({
    loading: true,
    active: true,
    status: null,
    trialDaysLeft: null,
    needsUpgrade: false,
    plan: null,
    companyId: null
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const companyId = await getUserCompanyId();
        if (!companyId) {
          setCompanyStatus(prev => ({ ...prev, loading: false }));
          return;
        }

        // Obtener documento de la empresa
        const companyDoc = await getDoc(doc(db, 'companies', companyId));

        if (!companyDoc.exists()) {
          setCompanyStatus(prev => ({ ...prev, loading: false }));
          return;
        }

        const company = companyDoc.data();

        // Detectar estados bloqueados directamente desde Firestore
        // (seteados por Cloud Functions o el backend)
        const BLOCKED_STATUSES = ['suspended', 'cancelled', 'trial_expired', 'billing_expired'];
        if (BLOCKED_STATUSES.includes(company.status)) {
          setCompanyStatus({
            loading: false,
            active: false,
            status: company.status,
            needsUpgrade: true,
            plan: company.plan,
            companyId: companyId,
            trialDaysLeft: 0,
            graceDaysLeft: 0,
          });
          return;
        }

        // Verificar trial
        if (company.status === 'trial' && company.trialEndDate) {
          const now = new Date();
          const trialEnd = company.trialEndDate.toDate();
          const daysLeft = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

          if (daysLeft <= 0) {
            // Trial expirado — calcular días hábiles de gracia restantes (5 días hábiles)
            const daysSinceExpiry = Math.floor((now - trialEnd) / (1000 * 60 * 60 * 24));
            // Contar días hábiles transcurridos desde el vencimiento
            let businessDaysPassed = 0;
            for (let i = 1; i <= daysSinceExpiry; i++) {
              const d = new Date(trialEnd);
              d.setDate(d.getDate() + i);
              const dow = d.getDay();
              if (dow !== 0 && dow !== 6) businessDaysPassed++; // Lun-Vie
            }
            const graceDaysLeft = Math.max(0, 5 - businessDaysPassed);

            setCompanyStatus({
              loading: false,
              active: graceDaysLeft > 0, // Activo si aún hay días de gracia
              status: graceDaysLeft > 0 ? 'grace_period' : 'trial_expired',
              trialDaysLeft: 0,
              graceDaysLeft,
              needsUpgrade: true,
              plan: company.plan,
              companyId: companyId
            });
          } else {
            // Trial activo
            setCompanyStatus({
              loading: false,
              active: true,
              status: 'trial',
              trialDaysLeft: daysLeft,
              graceDaysLeft: null,
              needsUpgrade: daysLeft <= 5, // Advertir 5 días antes
              plan: company.plan,
              companyId: companyId
            });
          }
          return;
        }

        // Plan de pago — verificar nextBillingDate
        const isPaidPlan = company.plan && company.plan !== 'trial' && company.plan !== 'free';
        if (isPaidPlan && company.nextBillingDate) {
          const now = new Date();
          const billingDate = company.nextBillingDate?.toDate
            ? company.nextBillingDate.toDate()
            : new Date(company.nextBillingDate);

          if (billingDate < now) {
            // Vencida — dar 2 días calendario de gracia
            const msPerDay = 1000 * 60 * 60 * 24;
            const daysSinceExpiry = Math.floor((now - billingDate) / msPerDay);
            const graceDaysLeft = Math.max(0, 2 - daysSinceExpiry);

            setCompanyStatus({
              loading: false,
              active: graceDaysLeft > 0,
              status: graceDaysLeft > 0 ? 'billing_grace' : 'billing_expired',
              needsUpgrade: true,
              plan: company.plan,
              companyId: companyId,
              trialDaysLeft: null,
              graceDaysLeft,
              billingDate,
            });
            return;
          }
        }

        // Plan activo — verificar si vence pronto
        const billingDaysLeft = company.nextBillingDate
          ? Math.ceil(((company.nextBillingDate?.toDate ? company.nextBillingDate.toDate() : new Date(company.nextBillingDate)) - new Date()) / (1000 * 60 * 60 * 24))
          : null;

        setCompanyStatus({
          loading: false,
          active: true,
          status: 'active',
          needsUpgrade: billingDaysLeft !== null && billingDaysLeft <= 3,
          plan: company.plan,
          companyId: companyId,
          trialDaysLeft: null,
          billingDaysLeft,
        });

      } catch (error) {
        console.error('Error verificando status:', error);
        setCompanyStatus(prev => ({ ...prev, loading: false }));
      }
    };

    if (auth.currentUser) {
      checkStatus();
    }
  }, []);

  return companyStatus;
}
