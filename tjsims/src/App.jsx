import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RecoveryPage from './pages/RecoveryPage';
import LandingPage from './pages/client/LandingPage';
import ContactUs from './pages/client/ContactUs';
import Products from './pages/client/Products';
import OrderStatus from './pages/client/OrderStatus';
import DashboardPage from './pages/admin/DashboardPage';
import SalesPage from './pages/admin/SalesPage';
import InventoryPage from './pages/admin/InventoryPage';
import OrdersPage from './pages/admin/OrdersPage';
import ReportsPage from './pages/admin/ReportsPage';
import ProductPage from './pages/admin/ProductPage';
import SettingsPage from './pages/admin/SettingsPage';
import DeliveryPortal from './pages/admin/DeliveryPortal';
import SuppliersPage from './pages/admin/SuppliersPage'; // <--- IMPORT THIS

// A wrapper component to handle authentication and optional role restriction
const PrivateRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  const isAuthenticated = localStorage.getItem('isAuthenticated') === 'true';
  const role = localStorage.getItem('userRole');
  
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
};

const App = () => {
  return (
    <Router>
      <Routes>
        {/* Client Routes */}
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/home" element={<LandingPage />} />
        <Route path="/products" element={<Products />} />
        <Route path="/order-status" element={<OrderStatus />} />
        <Route path="/contact-us" element={<ContactUs />} />
        
        {/* Admin Routes */}
        <Route path="/admin/login" element={<LoginPage />} />
        <Route path="/admin/recover-password" element={<RecoveryPage />} />
        <Route 
          path="/admin/dashboard" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <DashboardPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/admin/sales" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <SalesPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/admin/orders" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <OrdersPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/admin/inventory" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <InventoryPage />
            </PrivateRoute>
          } 
        />
        {/* NEW SUPPLIER ROUTE */}
        <Route 
          path="/admin/suppliers" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <SuppliersPage />
            </PrivateRoute>
          } 
        />
         <Route 
          path="/admin/reports" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <ReportsPage />
            </PrivateRoute>
          } 
        />
          <Route 
          path="/admin/products" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <ProductPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/admin/settings" 
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <SettingsPage />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/admin/delivery" 
          element={
            <PrivateRoute allowedRoles={['admin','driver']}>
              <DeliveryPortal />
            </PrivateRoute>
          } 
        />
        <Route 
          path="/admin" 
          element={
            <PrivateRoute>
              <Navigate to="/admin/dashboard" replace />
            </PrivateRoute>
          } 
        />
        
        <Route path="*" element={<Navigate to="/products" replace />} />
      </Routes>
    </Router>
  );
};

export default App;