import React, { useState, useEffect } from 'react';
import Navbar from '../../components/admin/Navbar';
import { BsSearch, BsPencil, BsFillArchiveFill, BsFillCheckCircleFill, BsFillExclamationTriangleFill, BsFillXCircleFill, BsListUl } from 'react-icons/bs';
import '../../styles/InventoryPage.css';
import { inventoryAPI, serialNumberAPI, suppliersAPI } from '../../utils/api';

// --- CUSTOM MESSAGE BOX COMPONENT ---
const MessageBox = ({ isOpen, title, message, type, onClose, onConfirm }) => {
  if (!isOpen) return null;
  let headerColor = '#f8f9fa';
  let titleColor = '#2c3e50';
  if (type === 'error') { headerColor = '#fee2e2'; titleColor = '#b91c1c'; } 
  else if (type === 'success') { headerColor = '#dcfce7'; titleColor = '#166534'; } 
  else if (type === 'warning') { headerColor = '#fff7ed'; titleColor = '#c2410c'; }

  return (
    <div className="modal-overlay" style={{ zIndex: 9999 }}>
      <div className="modal-content" style={{ maxWidth: '400px', width: '90%', borderRadius: '12px', overflow: 'hidden' }}>
        <div className="modal-header" style={{ backgroundColor: headerColor, borderBottom: '1px solid rgba(0,0,0,0.05)', padding: '15px 20px' }}>
          <h3 style={{ color: titleColor, fontSize: '1.1rem', margin: 0, fontWeight: '600' }}>{title}</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <div className="modal-body" style={{ padding: '25px 20px' }}>
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#4b5563', lineHeight: '1.5' }}>{message}</p>
        </div>
        <div className="modal-actions" style={{ padding: '15px 20px', backgroundColor: '#f9fafb' }}>
          {onConfirm ? (
            <>
              <button onClick={onClose} className="cancel-btn">Cancel</button>
              <button onClick={() => { onConfirm(); onClose(); }} className="confirm-btn" style={{ backgroundColor: type === 'error' || type === 'warning' ? '#dc3545' : 'var(--color-primary)' }}>Confirm</button>
            </>
          ) : (
            <button onClick={onClose} className="confirm-btn" style={{ marginLeft: 'auto' }}>OK</button>
          )}
        </div>
      </div>
    </div>
  );
};

const InventoryPage = () => {
  function getDefaultReceivedBy() { if (typeof window === 'undefined') return ''; return window.localStorage.getItem('username') || ''; }
  function getDefaultDateTime() { return new Date().toISOString().slice(0, 16); }

  const [products, setProducts] = useState([]);
  const [suppliersList, setSuppliersList] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({ totalProducts: 0, inStock: 0, lowStock: 0, outOfStock: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAddMode, setIsAddMode] = useState(true);
  const [isBulkStockInOpen, setIsBulkStockInOpen] = useState(false);
  const [bulkStockInData, setBulkStockInData] = useState(() => ({ supplierId: '', receivedBy: getDefaultReceivedBy(), receivedDate: getDefaultDateTime(), products: [] }));
  const [isReturnToSupplierOpen, setIsReturnToSupplierOpen] = useState(false);
  const [returnToSupplierData, setReturnToSupplierData] = useState(() => ({ supplierId: '', returnedBy: getDefaultReceivedBy(), returnDate: getDefaultDateTime(), reason: '', products: [] }));
  const [stockInModal, setStockInModal] = useState({ open: false, product: null });
  const [stockInForm, setStockInForm] = useState(() => ({ supplierId: '', receivedBy: getDefaultReceivedBy(), serialNumbers: [''], receivedDate: getDefaultDateTime(), quantity: 1 }));
  const [availableSerials, setAvailableSerials] = useState({}); 
  
  // --- NEW STATE FOR VIEWING SERIALS ---
  const [viewSerialsModal, setViewSerialsModal] = useState({ open: false, product: null, serials: [] });
  
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  // Message Box State
  const [msgBox, setMsgBox] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
  const showMessage = (title, message, type = 'info', onConfirm = null) => setMsgBox({ isOpen: true, title, message, type, onConfirm });
  const closeMessage = () => setMsgBox(prev => ({ ...prev, isOpen: false }));

  useEffect(() => { 
    loadProducts(); 
    loadInventoryStats(); 
    loadSuppliers();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true); setError(null);
      const filters = {}; if (searchQuery) filters.search = searchQuery; if (selectedCategory !== 'All') filters.category = selectedCategory; if (selectedStatus !== 'All') filters.status = selectedStatus;
      const response = await inventoryAPI.getProducts(filters);
      if (response.success) {
        const productsWithInventory = (response.data.products || []).map(product => ({ ...product, reorderPoint: product.reorder_point ?? product.reorderPoint ?? 10 }));
        setProducts(productsWithInventory);
      } else { setError('Failed to load products'); }
    } catch (error) { console.error('Error loading products:', error); setError(error.message || 'Failed to load products'); } finally { setLoading(false); }
  };
  
  const loadInventoryStats = async () => { try { const response = await inventoryAPI.getStats(); if (response.success) setInventoryStats(response.data); } catch (error) { console.error('Error loading inventory stats:', error); } };

  const loadSuppliers = async () => {
    try {
      const res = await suppliersAPI.getAll();
      if (res.success) setSuppliersList(res.data || []);
    } catch (e) { console.error('Failed to load suppliers'); }
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = (product.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || (product.brand || '').toLowerCase().includes(searchQuery.toLowerCase()) || (product.product_id || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const stock = product.stock || 0; const reorderPoint = product.reorderPoint || 10;
    const matchesStatus = selectedStatus === 'All' || (selectedStatus === 'In Stock' && stock > reorderPoint) || (selectedStatus === 'Low on Stock' && stock <= reorderPoint && stock > 0) || (selectedStatus === 'Out of Stock' && stock === 0);
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);
  const totalFilteredProducts = filteredProducts.length;

  useEffect(() => { setCurrentPage(1); }, [searchQuery, selectedCategory, selectedStatus]);
  const handlePageChange = (page) => { setCurrentPage(page); };

  const handleAddProduct = () => { setIsAddMode(true); setSelectedProduct({ name: '', brand: '', category: '', price: 0, stock: 0, supplier: '', sku: '', description: '' }); setIsModalOpen(true); };
  const handleEditProduct = (product) => { setIsAddMode(false); const existingReorderPoint = product.reorderPoint ?? product.reorder_point ?? 10; setSelectedProduct({ ...product, currentReorderPoint: existingReorderPoint, newReorderPoint: existingReorderPoint }); setIsModalOpen(true); };
  const handleOpenBulkStockIn = () => { setBulkStockInData({ supplierId: '', receivedBy: getDefaultReceivedBy(), receivedDate: getDefaultDateTime(), products: [] }); setIsBulkStockInOpen(true); };
  const handleAddProductRow = () => { setBulkStockInData(prev => ({ ...prev, products: [...prev.products, { productId: '', productName: '', brand: '', serialNumbers: [''], quantity: 1 }] })); };
  const handleAddReturnProductRow = () => { setReturnToSupplierData(prev => ({ ...prev, products: [...prev.products, { productId: '', productName: '', brand: '', serialNumbers: [''], quantity: 1 }] })); };
  const handleRemoveProductRow = (index) => { setBulkStockInData(prev => ({ ...prev, products: prev.products.filter((_, i) => i !== index) })); };
  const handleRemoveReturnProductRow = (index) => { setReturnToSupplierData(prev => ({ ...prev, products: prev.products.filter((_, i) => i !== index) })); };
  const handleProductRowChange = (index, field, value) => { setBulkStockInData(prev => { const newProducts = [...prev.products]; newProducts[index] = { ...newProducts[index], [field]: value }; if (field === 'productId') { const selectedProduct = products.find(p => p.product_id === value); if (selectedProduct) { newProducts[index].productName = selectedProduct.name; newProducts[index].brand = selectedProduct.brand; newProducts[index].requiresSerial = selectedProduct.requires_serial; } } if (field === 'quantity') { const qty = parseInt(value) || 1; const currentSerials = newProducts[index].serialNumbers || []; newProducts[index].serialNumbers = Array(qty).fill('').map((_, i) => currentSerials[i] || ''); } return { ...prev, products: newProducts }; }); };
  
  const refreshSerialsForSupplier = async (supplierId, currentProducts) => {
    if (!currentProducts || currentProducts.length === 0) return;
    const newSerialsMap = {};
    for (const row of currentProducts) {
        if (row.productId) {
            try {
                const response = await serialNumberAPI.getAvailableSerials(row.productId);
                const allSerials = response.data || [];
                const filtered = supplierId 
                    ? allSerials.filter(sn => sn.supplier_id == supplierId) 
                    : allSerials;
                newSerialsMap[row.productId] = filtered;
            } catch (e) {
                console.error(`Failed to refresh serials for ${row.productId}`, e);
            }
        }
    }
    setAvailableSerials(newSerialsMap);
  };

  const handleReturnProductRowChange = async (index, field, value) => {
    setReturnToSupplierData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };
      if (field === 'productId') {
        const selectedProduct = products.find(p => p.product_id === value);
        if (selectedProduct) {
          newProducts[index].productName = selectedProduct.name;
          newProducts[index].brand = selectedProduct.brand;
          newProducts[index].serialNumbers = ['']; 
          newProducts[index].requiresSerial = selectedProduct.requires_serial;
        }
      }
      if (field === 'quantity') {
         const qty = parseInt(value) || 1;
         const currentSerials = newProducts[index].serialNumbers || [];
         newProducts[index].serialNumbers = Array(qty).fill('').map((_, i) => currentSerials[i] || '');
      }
      return { ...prev, products: newProducts };
    });

    if (field === 'productId' && value) {
      try {
        const response = await serialNumberAPI.getAvailableSerials(value);
        const allSerials = response.data || [];
        const filteredSerials = returnToSupplierData.supplierId
            ? allSerials.filter(sn => sn.supplier_id == returnToSupplierData.supplierId) 
            : allSerials;
            
        setAvailableSerials(prev => ({ ...prev, [value]: filteredSerials }));
      } catch (error) {
        console.error('Error fetching serial numbers:', error);
      }
    }
  };
  
  const handleReturnSerialChange = (rowIndex, serialIndex, value) => {
      setReturnToSupplierData(prev => {
          const newProducts = [...prev.products];
          const newSerials = [...(newProducts[rowIndex].serialNumbers || [])];
          newSerials[serialIndex] = value;
          newProducts[rowIndex].serialNumbers = newSerials;
          return { ...prev, products: newProducts };
      });
  };

  const handleOpenStockInModal = (product) => { setStockInModal({ open: true, product }); setStockInForm({ supplierId: '', receivedBy: getDefaultReceivedBy(), serialNumbers: [''], receivedDate: getDefaultDateTime(), quantity: 1 }); };
  const handleCloseStockInModal = () => { setStockInModal({ open: false, product: null }); setStockInForm({ supplierId: '', receivedBy: getDefaultReceivedBy(), serialNumbers: [''], receivedDate: getDefaultDateTime(), quantity: 1 }); };

  // --- NEW: FUNCTION TO HANDLE VIEWING SERIALS ---
  const handleViewSerials = async (product) => {
    try {
        const response = await serialNumberAPI.getAvailableSerials(product.product_id);
        if (response.success) {
            setViewSerialsModal({
                open: true,
                product: product,
                serials: response.data || []
            });
        } else {
            showMessage('Error', 'Failed to load serial numbers', 'error');
        }
    } catch (error) {
        console.error('Error fetching serials:', error);
        showMessage('Error', 'Failed to load serial numbers', 'error');
    }
  };

  const handleSingleStockInSubmit = async (e) => {
    e.preventDefault(); if (isSubmitting || !stockInModal.product) return;
    const quantityToAdd = parseInt(stockInForm.quantity, 10) || 0;
    if (quantityToAdd <= 0) { showMessage('Invalid Quantity', 'Please enter a quantity greater than zero.', 'warning'); return; }
    
    const selectedSupplier = suppliersList.find(s => s.id == stockInForm.supplierId);
    const supplierName = selectedSupplier ? selectedSupplier.name : 'Unknown';

    let validSerials = []; const { product } = stockInModal; 
    if (product.requires_serial) {
      validSerials = stockInForm.serialNumbers.filter(s => s.trim() !== '');
      if (validSerials.length !== quantityToAdd) { showMessage('Mismatch', `This product requires serial numbers. Please provide exactly ${quantityToAdd} unique serial number(s).`, 'warning'); return; }
      const uniqueSerials = new Set(validSerials);
      if (uniqueSerials.size !== validSerials.length) { showMessage('Duplicate', 'Please enter unique serial numbers. Duplicates are not allowed.', 'warning'); return; }
    }
    try {
      setIsSubmitting(true);
      if (product.requires_serial && validSerials.length > 0) {
        const serialsToCreate = validSerials.map(sn => ({
            serialNumber: sn, 
            productId: product.product_id, 
            notes: `Stock In - ${supplierName}`,
            supplierId: stockInForm.supplierId 
        }));
        await serialNumberAPI.createSerials(serialsToCreate);
      }
      const payload = { supplier: supplierName, receivedBy: stockInForm.receivedBy, receivedDate: stockInForm.receivedDate, products: [{ productId: product.product_id, quantity: quantityToAdd, serialNumber: (product.requires_serial && validSerials.length > 0) ? validSerials[0] : null }] };
      await inventoryAPI.bulkStockIn(payload);
      showMessage('Success', 'Stock in recorded successfully.', 'success', () => { handleCloseStockInModal(); window.location.reload(); });
    } catch (error) {
      console.error('Error recording stock in:', error);
      let errorMessage = error.message; if (error.message.includes('already exist')) errorMessage = `One or more serial numbers already exist in the database. Please use unique serial numbers.`;
      showMessage('Error', errorMessage || 'Failed to record stock in.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleBulkStockInSubmit = async (e) => {
    e.preventDefault(); if (isSubmitting) return;
    if (bulkStockInData.products.length === 0) { showMessage('No Products', 'Please add at least one product', 'warning'); return; }
    
    const selectedSupplier = suppliersList.find(s => s.id == bulkStockInData.supplierId);
    const supplierName = selectedSupplier ? selectedSupplier.name : 'Unknown';

    try {
      setIsSubmitting(true);
      const allSerials = [];
      for (const product of bulkStockInData.products) {
        const validSerials = (product.serialNumbers || []).filter(s => s.trim() !== '');
        if (validSerials.length > 0) { 
            validSerials.forEach(sn => { 
                allSerials.push({ 
                    serialNumber: sn, 
                    productId: product.productId, 
                    notes: `Bulk Stock In - ${supplierName}`,
                    supplierId: bulkStockInData.supplierId 
                }); 
            }); 
        }
      }
      if (allSerials.length > 0) { await serialNumberAPI.createSerials(allSerials); }
      const payload = { supplier: supplierName, receivedBy: bulkStockInData.receivedBy, receivedDate: bulkStockInData.receivedDate, products: bulkStockInData.products.map(p => ({ productId: p.productId, serialNumber: p.serialNumbers?.[0] || null, quantity: parseInt(p.quantity) || 0 })) };
      const response = await inventoryAPI.bulkStockIn(payload);
      if (response.success) {
        showMessage('Success', 'Bulk stock in completed successfully', 'success', () => { setIsBulkStockInOpen(false); window.location.reload(); });
      }
    } catch (error) {
      console.error('Error in bulk stock in:', error);
      let errorMessage = error.message; if (error.message.includes('already exist')) errorMessage = `One or more serial numbers already exist in the database.`;
      showMessage('Error', errorMessage || 'Failed to record bulk stock in.', 'error');
    } finally { setIsSubmitting(false); }
  };

  const handleOpenReturnToSupplier = () => { setReturnToSupplierData({ supplierId: '', returnedBy: getDefaultReceivedBy(), returnDate: getDefaultDateTime(), reason: '', products: [] }); setIsReturnToSupplierOpen(true); };

  const handleReturnToSupplierSubmit = async (e) => {
    e.preventDefault(); if (isSubmitting) return;
    if (returnToSupplierData.products.length === 0) { showMessage('No Products', 'Please add at least one product', 'warning'); return; }
    
    const selectedSupplier = suppliersList.find(s => s.id == returnToSupplierData.supplierId);
    const supplierName = selectedSupplier ? selectedSupplier.name : 'Unknown';

    try {
      setIsSubmitting(true);
      const payload = { 
          supplier: supplierName, 
          returnedBy: returnToSupplierData.returnedBy, 
          returnDate: returnToSupplierData.returnDate, 
          reason: returnToSupplierData.reason, 
          products: returnToSupplierData.products.map(p => ({ 
              productId: p.productId, 
              serialNumbers: p.serialNumbers, 
              quantity: parseInt(p.quantity) || 0 
          })) 
      };
      const response = await inventoryAPI.returnToSupplier(payload);
      if (response.success) {
        showMessage('Success', 'Return to supplier completed successfully.', 'success', () => { setIsReturnToSupplierOpen(false); window.location.reload(); });
      }
    } catch (error) { console.error('Error in return to supplier:', error); showMessage('Error', error.message || 'Failed to process return to supplier.', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault(); if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      const payload = { quantityToAdd: 0, reorderPoint: selectedProduct.newReorderPoint, notes: 'Reorder point updated', createdBy: localStorage.getItem('username') || 'Admin', transactionDate: new Date().toISOString() };
      const response = await inventoryAPI.updateStock(selectedProduct.product_id, payload);
      if (response.success) {
        showMessage('Success', 'Product edited successfully.', 'success', () => { setIsModalOpen(false); window.location.reload(); });
      }
    } catch (error) { console.error('Error updating reorder point:', error); showMessage('Error', 'Error updating reorder point: ' + error.message, 'error'); } finally { setIsSubmitting(false); }
  };

  const handleInputChange = (e) => { const { name, value } = e.target; if (name === 'newReorderPoint') { setSelectedProduct({ ...selectedProduct, newReorderPoint: parseInt(value) || 0 }); } };

  return (
    <div className="admin-layout">
      <Navbar />
      <main className="admin-main">
        <div className="admin-container inventory-page-content">
          <div className="page-header"><h1 className="page-title">Inventory Management</h1><p className="page-subtitle">Monitor and adjust stock levels for all products</p></div>
          <div className="card">
            <div className="inventory-controls">
              <div className="search-filter-section">
                <div className="search-box"><input type="text" placeholder="Search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" /><button className="search-btn" type="button"><BsSearch /></button></div>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="filter-dropdown"><option value="All">All Categories</option>{Array.from(new Set(products.map(p => p.category))).map(category => (<option key={category} value={category}>{category}</option>))}</select>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)} className="filter-dropdown"><option value="All">All Status</option><option value="In Stock">In Stock</option><option value="Low on Stock">Low on Stock</option><option value="Out of Stock">Out of Stock</option></select>
              </div>
              <div className="action-buttons-section"><button onClick={handleOpenReturnToSupplier} className="btn btn-danger">Return to Supplier</button><button onClick={handleOpenBulkStockIn} className="btn btn-warning">+ Bulk Stock In</button></div>
            </div>
          </div>
          <div className="dashboard-stats">
            <div className="stat-card inventory"><div className="stat-info-flex"><div><h3 className="stat-title">Total Products</h3><p className="stat-value inventory">{inventoryStats.totalProducts}</p></div><div className="stat-icon inventory"><BsFillArchiveFill /></div></div></div>
            <div className="stat-card in-stock"><div className="stat-info-flex"><div><h3 className="stat-title">In Stock</h3><p className="stat-value in-stock">{inventoryStats.inStock}</p></div><div className="stat-icon in-stock"><BsFillCheckCircleFill /></div></div></div>
            <div className="stat-card low-stock"><div className="stat-info-flex"><div><h3 className="stat-title">Low on Stock</h3><p className="stat-value low-stock">{inventoryStats.lowStock}</p></div><div className="stat-icon low-stock"><BsFillExclamationTriangleFill /></div></div></div>
            <div className="stat-card out-of-stock"><div className="stat-info-flex"><div><h3 className="stat-title">Out of Stock</h3><p className="stat-value out-of-stock">{inventoryStats.outOfStock}</p></div><div className="stat-icon out-of-stock"><BsFillXCircleFill /></div></div></div>
          </div>
          <div className="table-section">
            {error && (<div className="error-state"><strong>Error:</strong> {error}<button onClick={loadProducts} className="btn btn-danger">Retry</button></div>)}
            {loading ? (<div className="loading-state">Loading products...</div>) : (
              <div className="table-container">
                <table className="table">
                  <thead><tr><th>Product ID</th><th>Product Name</th><th>Category</th><th>Quantity</th><th>Stock Status</th><th>Actions</th></tr></thead>
                  <tbody>
                    {currentProducts.map(product => (
                      <tr key={product.id}>
                        <td className="order-id-cell">{product.product_id}</td>
                        <td><div className="product-info"><h4>{product.name}</h4><p className="product-brand">{product.brand}</p></div></td>
                        <td><span className="category-badge">{product.category}</span></td>
                        <td className="quantity-cell">{product.stock || 0}</td>
                        <td><span className={`status-badge ${product.stock > product.reorderPoint ? 'in-stock' : product.stock > 0 ? 'low-stock' : 'out-of-stock'}`}>{product.stock > product.reorderPoint ? 'In Stock' : product.stock > 0 ? 'Low Stock' : 'Out of Stock'}</span></td>
                        <td>
                            <div className="action-buttons">
                                <button onClick={() => handleEditProduct(product)} className="edit-btn" title="Edit Reorder Level"><BsPencil /></button>
                                <button onClick={() => handleOpenStockInModal(product)} className="stock-in-btn" title="Record Stock In">Stock In</button>
                                {/* --- VIEW SERIALS BUTTON --- */}
                                {!!product.requires_serial && (
                                    <button 
                                        onClick={() => handleViewSerials(product)} 
                                        className="btn btn-outline" 
                                        style={{ padding: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#17a2b8', borderColor: '#17a2b8' }}
                                        title="View Available Serials"
                                    >
                                        <BsListUl />
                                    </button>
                                )}
                            </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="table-footer">
              <div className="results-info">Showing {totalFilteredProducts > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, totalFilteredProducts)} of {totalFilteredProducts} products</div>
              {totalPages > 1 && (<div className="pagination"><button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="pagination-btn">Previous</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (<button key={page} onClick={() => handlePageChange(page)} className={`pagination-btn ${currentPage === page ? 'active' : ''}`}>{page}</button>))}<button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="pagination-btn">Next</button></div>)}
            </div>
          </div>
        </div>
      </main>
      <MessageBox isOpen={msgBox.isOpen} title={msgBox.title} message={msgBox.message} type={msgBox.type} onClose={closeMessage} onConfirm={msgBox.onConfirm} />
      
      {/* VIEW SERIALS MODAL */}
      {viewSerialsModal.open && viewSerialsModal.product && (
        <div className="modal-overlay" onClick={() => setViewSerialsModal({ open: false, product: null, serials: [] })}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Available Serials: {viewSerialsModal.product.name}</h3>
                    <button className="close-btn" onClick={() => setViewSerialsModal({ open: false, product: null, serials: [] })}>×</button>
                </div>
                <div className="modal-body">
                    {viewSerialsModal.serials.length > 0 ? (
                        <div className="serial-list-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ padding: '10px', textAlign: 'left', backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee' }}>Serial Number</th>
                                        <th style={{ padding: '10px', textAlign: 'left', backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee' }}>Date Added</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viewSerialsModal.serials.map((sn, idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                                            <td style={{ padding: '10px', fontWeight: '500', color: '#2c3e50' }}>{sn.serial_number}</td>
                                            <td style={{ padding: '10px', color: '#666' }}>{new Date(sn.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p style={{ textAlign: 'center', color: '#666', padding: '20px', margin: 0 }}>No available serial numbers found in inventory.</p>
                    )}
                </div>
                <div className="modal-actions">
                    <button className="confirm-btn" onClick={() => setViewSerialsModal({ open: false, product: null, serials: [] })}>Close</button>
                </div>
            </div>
        </div>
      )}

      {isBulkStockInOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header"><h2>Stock In</h2><button onClick={() => setIsBulkStockInOpen(false)} className="close-btn">×</button></div>
            <form onSubmit={handleBulkStockInSubmit} className="modal-body">
              <div className="form-section">
                <div className="form-group">
                    <label>Supplier/Source</label>
                    <select 
                        value={bulkStockInData.supplierId} 
                        onChange={(e) => setBulkStockInData(prev => ({ ...prev, supplierId: e.target.value }))}
                        className="form-input" 
                        required
                    >
                        <option value="">Select Supplier</option>
                        {suppliersList.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group"><label>Received By</label><input type="text" value={bulkStockInData.receivedBy} onChange={(e) => setBulkStockInData(prev => ({ ...prev, receivedBy: e.target.value }))} className="form-input" placeholder="Enter receiver name" required /></div>
                <div className="form-group"><label>Date and Time Received</label><input type="datetime-local" value={bulkStockInData.receivedDate} onChange={(e) => setBulkStockInData(prev => ({ ...prev, receivedDate: e.target.value }))} className="form-input" required /></div>
                <div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ fontSize: '16px', fontWeight: '600' }}>Product List</h3><button type="button" onClick={handleAddProductRow} className="btn btn-primary" style={{height: '36px'}}>+ Add Product</button></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Product Name</th><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Brand</th><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '100px' }}>Quantity</th><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '250px' }}>Serial Numbers</th><th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', width: '80px' }}>Action</th></tr></thead>
                  <tbody>
                    {bulkStockInData.products.length === 0 ? (<tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>No products added. Click "+ Add Product" to add products.</td></tr>) : (
                      bulkStockInData.products.map((row, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '8px' }}><select value={row.productId} onChange={(e) => handleProductRowChange(index, 'productId', e.target.value)} className="form-input" style={{height: '36px'}} required><option value="">Select Product</option>{products.map(p => (<option key={p.product_id} value={p.product_id}>{p.name}</option>))}</select></td>
                          <td style={{ padding: '8px' }}><input type="text" value={row.brand} readOnly className="form-input readonly" style={{height: '36px'}} /></td>
                          <td style={{ padding: '8px' }}><input type="number" value={row.quantity} onChange={(e) => handleProductRowChange(index, 'quantity', e.target.value)} min="1" className="form-input" style={{height: '36px'}} required /></td>
                          <td style={{ padding: '8px' }}>{row.requiresSerial ? (<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{Array.from({ length: row.quantity || 1 }, (_, serialIndex) => (<input key={serialIndex} type="text" value={row.serialNumbers?.[serialIndex] || ''} onChange={(e) => { const newSerials = [...(row.serialNumbers || [])]; newSerials[serialIndex] = e.target.value; handleProductRowChange(index, 'serialNumbers', newSerials); }} placeholder={`Serial #${serialIndex + 1} (Required)`} className="form-input" style={{height: '32px', fontSize: '13px'}} required />))}</div>) : (<div style={{ padding: '6px', color: '#6c757d', fontSize: '13px' }}>N/A</div>)}</td>
                          <td style={{ padding: '8px', textAlign: 'center' }}><button type="button" onClick={() => handleRemoveProductRow(index)} className="btn btn-danger" style={{height: '36px', padding: '0 12px'}}>x</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions"><button type="button" onClick={() => setIsBulkStockInOpen(false)} className="cancel-btn">Cancel</button><button type="submit" className="confirm-btn" disabled={isSubmitting}>{isSubmitting ? 'Processing...' : 'Confirm'}</button></div>
            </form>
          </div>
        </div>
      )}
      
      {isReturnToSupplierOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header"><h2>Return to Supplier</h2><button onClick={() => setIsReturnToSupplierOpen(false)} className="close-btn">×</button></div>
            <form onSubmit={handleReturnToSupplierSubmit} className="modal-body">
              <div className="form-section">
                <div className="form-group">
                    <label>Supplier/Source</label>
                    <select 
                        value={returnToSupplierData.supplierId} 
                        onChange={(e) => {
                            const newSupplierId = e.target.value;
                            setReturnToSupplierData(prev => ({ ...prev, supplierId: newSupplierId }));
                            refreshSerialsForSupplier(newSupplierId, returnToSupplierData.products);
                        }}
                        className="form-input" 
                        required
                    >
                        <option value="">Select Supplier</option>
                        {suppliersList.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group"><label>Returned By</label><input type="text" value={returnToSupplierData.returnedBy} onChange={(e) => setReturnToSupplierData(prev => ({ ...prev, returnedBy: e.target.value }))} className="form-input" placeholder="Enter your name" required /></div>
                <div className="form-group"><label>Date</label><input type="datetime-local" value={returnToSupplierData.returnDate} onChange={(e) => setReturnToSupplierData(prev => ({ ...prev, returnDate: e.target.value }))} className="form-input" required /></div>
                <div className="form-group"><label>Reason for Return</label><select value={returnToSupplierData.reason} onChange={(e) => setReturnToSupplierData(prev => ({ ...prev, reason: e.target.value }))} className="form-input" required><option value="">Select Reason</option><option value="Defective">Defective</option><option value="Wrong Item">Wrong Item</option><option value="Overstock">Overstock</option><option value="Other">Other</option></select></div>
                <div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><h3 style={{ fontSize: '16px', fontWeight: '600' }}>Product List</h3><button type="button" onClick={handleAddReturnProductRow} className="btn btn-primary" style={{height: '36px'}}>+ Add Row</button></div>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead><tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Product Name</th><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Brand</th><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '150px' }}>Serial Number</th><th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '100px' }}>Quantity</th><th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', width: '80px' }}>Action</th></tr></thead>
                  <tbody>
                    {returnToSupplierData.products.length === 0 ? (<tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>No products added. Click "+ Add Row" to add products.</td></tr>) : (
                      returnToSupplierData.products.map((row, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '8px' }}><select value={row.productId} onChange={(e) => handleReturnProductRowChange(index, 'productId', e.target.value)} className="form-input" style={{height: '36px'}} required disabled={!returnToSupplierData.supplierId}><option value="">Select Product</option>{products.map(p => (<option key={p.product_id} value={p.product_id}>{p.name}</option>))}</select></td>
                          <td style={{ padding: '8px' }}><input type="text" value={row.brand} readOnly className="form-input readonly" style={{height: '36px'}} /></td>
                          
                          <td style={{ padding: '8px' }}>
                            {row.requiresSerial ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {Array.from({ length: row.quantity || 1 }, (_, serialIndex) => (
                                        <select
                                            key={serialIndex}
                                            value={(row.serialNumbers && row.serialNumbers[serialIndex]) || ''}
                                            onChange={(e) => handleReturnSerialChange(index, serialIndex, e.target.value)}
                                            className="form-input"
                                            style={{height: '36px', fontSize: '13px'}}
                                            required
                                            disabled={!row.productId}
                                        >
                                            <option value="">Select Serial</option>
                                            {row.productId && availableSerials[row.productId]?.map(serial => (
                                                <option key={serial.serial_number} value={serial.serial_number}>{serial.serial_number}</option>
                                            ))}
                                        </select>
                                    ))}
                                </div>
                            ) : (
                                <div style={{ padding: '8px', color: '#6c757d', fontSize: '13px', textAlign: 'left' }}>N/A</div>
                            )}
                          </td>
                          
                          <td style={{ padding: '8px', verticalAlign: 'top' }}><input type="number" value={row.quantity} onChange={(e) => handleReturnProductRowChange(index, 'quantity', e.target.value)} min="1" className="form-input" style={{height: '36px'}} required /></td>
                          <td style={{ padding: '8px', textAlign: 'center', verticalAlign: 'top' }}><button type="button" onClick={() => handleRemoveReturnProductRow(index)} className="btn btn-danger" style={{height: '36px', padding: '0 12px'}}>x</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="modal-actions"><button type="button" onClick={() => setIsReturnToSupplierOpen(false)} className="cancel-btn">Cancel</button><button type="submit" className="confirm-btn" disabled={isSubmitting}>{isSubmitting ? 'Processing...' : 'Confirm'}</button></div>
            </form>
          </div>
        </div>
      )}
      
      {stockInModal.open && stockInModal.product && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>{`Stock In – ${stockInModal.product.name}`}</h2><button onClick={handleCloseStockInModal} className="close-btn">×</button></div>
            <form onSubmit={handleSingleStockInSubmit} className="modal-body">
              <div className="form-section">
                <div className="form-group">
                    <label>Supplier/Source</label>
                    <select 
                        value={stockInForm.supplierId} 
                        onChange={(e) => setStockInForm(prev => ({ ...prev, supplierId: e.target.value }))}
                        className="form-input" 
                        required
                    >
                        <option value="">Select Supplier</option>
                        {suppliersList.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="form-group"><label>Received By</label><input type="text" value={stockInForm.receivedBy} onChange={(e) => setStockInForm(prev => ({ ...prev, receivedBy: e.target.value }))} className="form-input" placeholder="Enter receiver name" required /></div>
                <div className="form-group"><label>Date and Time Received</label><input type="datetime-local" value={stockInForm.receivedDate} onChange={(e) => setStockInForm(prev => ({ ...prev, receivedDate: e.target.value }))} className="form-input" required /></div>
                <div className="form-group"><label>Quantity</label><input type="number" min="1" value={stockInForm.quantity} onChange={(e) => { const qty = parseInt(e.target.value) || 1; setStockInForm(prev => ({ ...prev, quantity: qty, serialNumbers: Array(qty).fill('').map((_, i) => prev.serialNumbers[i] || '') })); }} className="form-input" required /></div>
                {!!stockInModal.product.requires_serial && (<div className="form-group"><label>Serial Numbers (1 per product)</label><div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{Array.from({ length: parseInt(stockInForm.quantity) || 1 }, (_, index) => (<input key={`serial-${index}`} type="text" value={(stockInForm.serialNumbers && stockInForm.serialNumbers[index]) || ''} onChange={(e) => { const newSerials = Array.from({ length: parseInt(stockInForm.quantity) || 1 }, (_, i) => (stockInForm.serialNumbers && stockInForm.serialNumbers[i]) || ''); newSerials[index] = e.target.value; setStockInForm(prev => ({ ...prev, serialNumbers: newSerials })); }} className="form-input" placeholder={`Serial Number ${index + 1} (Required)`} style={{ marginBottom: '4px' }} required />))}</div></div>)}
              </div>
              <div className="modal-actions"><button type="button" onClick={handleCloseStockInModal} className="cancel-btn">Cancel</button><button type="submit" className="confirm-btn" disabled={isSubmitting}>{isSubmitting ? 'Processing...' : 'Record Stock In'}</button></div>
            </form>
          </div>
        </div>
      )}
      
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header"><h2>{isAddMode ? 'Add New Product' : 'Edit Reorder Level'}</h2><button onClick={() => setIsModalOpen(false)} className="close-btn">×</button></div>
            <form onSubmit={handleSubmitProduct} className="modal-body">
              <div className="form-section">
                <div className="form-group"><label>Product Name</label><input type="text" value={selectedProduct?.name || ''} readOnly className="form-input readonly" /></div>
                <div className="form-group"><label>Current Stock</label><input type="text" value={selectedProduct?.stock || ''} readOnly className="form-input readonly" /></div>
                <div className="form-group"><label>Current Reorder Level</label><input type="text" value={selectedProduct?.currentReorderPoint || ''} readOnly className="form-input readonly" /></div>
                <div className="form-group"><label>New Reorder Level</label><input type="number" name="newReorderPoint" value={selectedProduct?.newReorderPoint || ''} onChange={handleInputChange} min="0" className="form-input" placeholder="Enter new reorder level" required /></div>
                <div className="alert-text"><p>Alert when stock falls below this level</p></div>
              </div>
              <div className="modal-actions"><button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn">Cancel</button><button type="submit" className="save-btn">Save Changes</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;