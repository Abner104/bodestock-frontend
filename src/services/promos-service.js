// src/services/promos-service.js
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  getDocs, query, orderBy, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../firebase/firebase.js';
import { getUserCompanyId } from './companyService.js';

const getPromosRef = async () => {
  const companyId = await getUserCompanyId();
  if (!companyId) throw new Error('No se pudo obtener el companyId');
  return { ref: collection(db, `companies/${companyId}/promos`), companyId };
};

export const savePromo = async (promo) => {
  const { ref } = await getPromosRef();
  const docRef = await addDoc(ref, {
    ...promo,
    activa: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const updatePromo = async (promoId, data) => {
  const { companyId } = await getPromosRef();
  const ref = doc(db, `companies/${companyId}/promos`, promoId);
  await updateDoc(ref, { ...data, updatedAt: serverTimestamp() });
};

export const deletePromo = async (promoId) => {
  const { companyId } = await getPromosRef();
  const ref = doc(db, `companies/${companyId}/promos`, promoId);
  await deleteDoc(ref);
};

export const getPromos = async (soloActivas = true) => {
  const { ref } = await getPromosRef();
  const constraints = [orderBy('createdAt', 'desc')];
  if (soloActivas) constraints.unshift(where('activa', '==', true));
  const snap = await getDocs(query(ref, ...constraints));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};
