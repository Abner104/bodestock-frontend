// src/components/ProtectedRoute.jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase/firebase.js';
import GlobalLoading from './GlobalLoading.jsx';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = useState(auth.currentUser);
  const [checked, setChecked] = useState(!!auth.currentUser);

  useEffect(() => {
    if (auth.currentUser) {
      setUser(auth.currentUser);
      setChecked(true);
      return;
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setChecked(true);
      unsub();
    });
    return () => unsub();
  }, []);

  if (!checked) return <GlobalLoading />;

  if (!user) {
    const loginPath = location.pathname.includes('/salida-inventario') && location.search
      ? `/login${location.search}`
      : '/login';
    return <Navigate to={loginPath} replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.string),
  adminOnly: PropTypes.bool,
  requiredPermissions: PropTypes.arrayOf(PropTypes.string),
};

ProtectedRoute.defaultProps = {
  allowedRoles: [],
  adminOnly: false,
  requiredPermissions: [],
};

export default ProtectedRoute;
