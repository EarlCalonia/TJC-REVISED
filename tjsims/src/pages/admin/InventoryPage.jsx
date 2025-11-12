import React, { useState, useEffect } from 'react';
import Navbar from '../../components/admin/Navbar';
import { BsSearch, BsPlus, BsPencil, BsBox, BsTags, BsTruck } from 'react-icons/bs';
import '../../styles/InventoryPage.css';
import { productAPI } from '../../utils/api';
import { inventoryAPI } from '../../utils/inventoryApi';
import { serialNumberAPI } from '../../utils/serialNumberApi';

const InventoryPage = () => {
  function getDefaultReceivedBy() {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem('username') || '';
  }

  function getDefaultDateTime() {
    return new Date().toISOString().slice(0, 16);
  }

  // State for products and inventory stats
  const [products, setProducts] = useState([]);
  const [inventoryStats, setInventoryStats] = useState({
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0
  });
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
  const [bulkStockInData, setBulkStockInData] = useState(() => ({
    supplier: '',
    receivedBy: getDefaultReceivedBy(),
    receivedDate: getDefaultDateTime(),
    products: []
  }));
  const [isReturnToSupplierOpen, setIsReturnToSupplierOpen] = useState(false);
  const [returnToSupplierData, setReturnToSupplierData] = useState(() => ({
    supplier: '',
    returnedBy: getDefaultReceivedBy(),
    returnDate: getDefaultDateTime(),
    products: []
  }));
  const [stockInModal, setStockInModal] = useState({ open: false, product: null });
  const [stockInForm, setStockInForm] = useState(() => ({
    supplier: '',
    receivedBy: getDefaultReceivedBy(),
    serialNumbers: [''], // Array of serial numbers
    receivedDate: getDefaultDateTime(),
    quantity: 1
  }));
  const [availableSerials, setAvailableSerials] = useState({}); // Store available serials per product
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);

  // Load products and inventory stats on component mount
  useEffect(() => {
    loadProducts();
    loadInventoryStats();
  }, []);

  // Load products from API
  const loadProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build filters object
      const filters = {};
      if (searchQuery) filters.search = searchQuery;
      if (selectedCategory !== 'All') filters.category = selectedCategory;
      if (selectedStatus !== 'All') filters.status = selectedStatus;

      const response = await inventoryAPI.getProducts(filters);
      if (response.success) {
        const productsWithInventory = (response.data.products || []).map(product => ({
          ...product,
          reorderPoint: product.reorder_point ?? product.reorderPoint ?? 10
        }));
        setProducts(productsWithInventory);
      } else {
        setError('Failed to load products');
      }
    } catch (error) {
      console.error('Error loading products:', error);
      setError(error.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  // Load inventory statistics
  const loadInventoryStats = async () => {
    try {
      const response = await inventoryAPI.getStats();
      if (response.success) {
        setInventoryStats(response.data);
      }
    } catch (error) {
      console.error('Error loading inventory stats:', error);
    }
  };

  // Filter products based on search and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.sku.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === 'All' || product.category === selectedCategory;
    const matchesStatus = selectedStatus === 'All' || 
                         (selectedStatus === 'In Stock' && product.stock > 10) ||
                         (selectedStatus === 'Low on Stock' && product.stock <= 10 && product.stock > 0) ||
                         (selectedStatus === 'Out of Stock' && product.stock === 0);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);
  const totalFilteredProducts = filteredProducts.length;

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, selectedStatus]);

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Handle add new product
  const handleAddProduct = () => {
    setIsAddMode(true);
    setSelectedProduct({
      name: '',
      brand: '',
      category: '',
      price: 0,
      stock: 0,
      supplier: '',
      sku: '',
      description: ''
    });
    setIsModalOpen(true);
  };

  // Handle edit product
  const handleEditProduct = (product) => {
    setIsAddMode(false);
    const existingReorderPoint = product.reorderPoint ?? product.reorder_point ?? 10;
    setSelectedProduct({
      ...product,
      currentReorderPoint: existingReorderPoint,
      newReorderPoint: existingReorderPoint
    });
    setIsModalOpen(true);
  };

  // Handle bulk stock in
  const handleOpenBulkStockIn = () => {
    setBulkStockInData({
      supplier: '',
      receivedBy: getDefaultReceivedBy(),
      receivedDate: getDefaultDateTime(),
      products: []
    });
    setIsBulkStockInOpen(true);
  };

  const handleAddProductRow = () => {
    setBulkStockInData(prev => ({
      ...prev,
      products: [...prev.products, { productId: '', productName: '', brand: '', serialNumbers: [''], quantity: 1 }]
    }));
  };

  const handleAddReturnProductRow = () => {
    setReturnToSupplierData(prev => ({
      ...prev,
      products: [...prev.products, { productId: '', productName: '', brand: '', serialNumber: '', quantity: 1 }]
    }));
  };

  const handleRemoveProductRow = (index) => {
    setBulkStockInData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleRemoveReturnProductRow = (index) => {
    setReturnToSupplierData(prev => ({
      ...prev,
      products: prev.products.filter((_, i) => i !== index)
    }));
  };

  const handleProductRowChange = (index, field, value) => {
    setBulkStockInData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };

      // Auto-fill brand when product is selected
      if (field === 'productId') {
        const selectedProduct = products.find(p => p.product_id === value);
        if (selectedProduct) {
          newProducts[index].productName = selectedProduct.name;
          newProducts[index].brand = selectedProduct.brand;
          newProducts[index].requiresSerial = selectedProduct.requires_serial; // <-- CHECK FOR THIS LINE
        }
      }

      // Adjust serialNumbers array when quantity changes
      if (field === 'quantity') {
        const qty = parseInt(value) || 1;
        const currentSerials = newProducts[index].serialNumbers || [];
        newProducts[index].serialNumbers = Array(qty).fill('').map((_, i) => currentSerials[i] || '');
      }

      return { ...prev, products: newProducts };
    });
  };

  const handleReturnProductRowChange = async (index, field, value) => {
    setReturnToSupplierData(prev => {
      const newProducts = [...prev.products];
      newProducts[index] = { ...newProducts[index], [field]: value };

      // Auto-fill brand when product is selected
      if (field === 'productId') {
        const selectedProduct = products.find(p => p.product_id === value);
        if (selectedProduct) {
          newProducts[index].productName = selectedProduct.name;
          newProducts[index].brand = selectedProduct.brand;
          newProducts[index].serialNumber = ''; // Reset serial number
        }
      }

      return { ...prev, products: newProducts };
    });

    // Fetch available serial numbers when product is selected
    if (field === 'productId' && value) {
      try {
        const response = await serialNumberAPI.getAvailableSerials(value);
        setAvailableSerials(prev => ({
          ...prev,
          [value]: response.data || []
        }));
      } catch (error) {
        console.error('Error fetching serial numbers:', error);
      }
    }
  };

  const handleOpenStockInModal = (product) => {
    setStockInModal({ open: true, product });
    setStockInForm({
      supplier: '',
      receivedBy: getDefaultReceivedBy(),
      serialNumbers: [''],
      receivedDate: getDefaultDateTime(),
      quantity: 1
    });
  };

  const handleCloseStockInModal = () => {
    setStockInModal({ open: false, product: null });
    setStockInForm({
      supplier: '',
      receivedBy: getDefaultReceivedBy(),
      serialNumbers: [''],
      receivedDate: getDefaultDateTime(),
      quantity: 1
    });
  };

  const handleSingleStockInSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !stockInModal.product) return;

    const quantityToAdd = parseInt(stockInForm.quantity, 10) || 0;
    if (quantityToAdd <= 0) {
      alert('Please enter a quantity greater than zero.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare serial numbers
      const validSerials = stockInForm.serialNumbers.filter(s => s.trim() !== '');
      
      // Create serial number records FIRST (before adding stock)
      if (validSerials.length > 0) {
        const serialsToCreate = validSerials.map(sn => ({
          serialNumber: sn,
          productId: stockInModal.product.product_id,
          notes: `Stock In - ${stockInForm.supplier}`
        }));
        
        // This will throw error if duplicates exist - preventing stock from being added
        await serialNumberAPI.createSerials(serialsToCreate);
      }

      // Only add stock if serial numbers were created successfully (or none provided)
      const payload = {
        supplier: stockInForm.supplier,
        receivedBy: stockInForm.receivedBy,
        receivedDate: stockInForm.receivedDate,
        products: [{
          productId: stockInModal.product.product_id,
          quantity: quantityToAdd,
          serialNumber: validSerials[0] || null
        }]
      };

      await inventoryAPI.bulkStockIn(payload);

      alert('Stock in recorded successfully.');
      await loadProducts();
      await loadInventoryStats();
      handleCloseStockInModal();
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error recording stock in:', error);

      // Make error messages more user-friendly
      let errorMessage = error.message;
      if (error.message.includes('already exist')) {
        errorMessage = `Serial number validation failed. Please use unique serial numbers that haven't been used for this product before.`;
      }

      alert(errorMessage || 'Failed to record stock in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkStockInSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (bulkStockInData.products.length === 0) {
      alert('Please add at least one product');
      return;
    }

    try {
      setIsSubmitting(true);

      // Collect all serial numbers FIRST
      const allSerials = [];
      for (const product of bulkStockInData.products) {
        const validSerials = (product.serialNumbers || []).filter(s => s.trim() !== '');
        if (validSerials.length > 0) {
          validSerials.forEach(sn => {
            allSerials.push({
              serialNumber: sn,
              productId: product.productId,
              notes: `Bulk Stock In - ${bulkStockInData.supplier}`
            });
          });
        }
      }

      // Create serial numbers FIRST (before adding stock)
      // This will throw error if duplicates exist - preventing stock from being added
      if (allSerials.length > 0) {
        await serialNumberAPI.createSerials(allSerials);
      }

      // Only add stock if serial numbers were created successfully (or none provided)
      const payload = {
        supplier: bulkStockInData.supplier,
        receivedBy: bulkStockInData.receivedBy,
        receivedDate: bulkStockInData.receivedDate,
        products: bulkStockInData.products.map(p => ({
          productId: p.productId,
          serialNumber: p.serialNumbers?.[0] || null,
          quantity: parseInt(p.quantity) || 0
        }))
      };

      const response = await inventoryAPI.bulkStockIn(payload);

      if (response.success) {
        alert('Bulk stock in completed successfully');
        await loadProducts();
        await loadInventoryStats();
        setIsBulkStockInOpen(false);
        // Refresh the page to show updated data
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      console.error('Error in bulk stock in:', error);

      // Make error messages more user-friendly
      let errorMessage = error.message;
      if (error.message.includes('already exist')) {
        errorMessage = ``;
      }

      alert(errorMessage || 'Failed to record bulk stock in.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenReturnToSupplier = () => {
    setReturnToSupplierData({
      supplier: '',
      returnedBy: getDefaultReceivedBy(),
      returnDate: getDefaultDateTime(),
      products: []
    });
    setIsReturnToSupplierOpen(true);
  };

  const handleReturnToSupplierSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (returnToSupplierData.products.length === 0) {
      alert('Please add at least one product');
      return;
    }

    try {
      setIsSubmitting(true);

      const payload = {
        supplier: returnToSupplierData.supplier,
        returnedBy: returnToSupplierData.returnedBy,
        returnDate: returnToSupplierData.returnDate,
        products: returnToSupplierData.products.map(p => ({
          productId: p.productId,
          serialNumber: p.serialNumber,
          quantity: parseInt(p.quantity) || 0
        }))
      };

      const response = await inventoryAPI.returnToSupplier(payload);

      if (response.success) {
        alert('Return to supplier completed successfully.');
        await loadProducts();
        await loadInventoryStats();
        setIsReturnToSupplierOpen(false);
        // Refresh the page to show updated data
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      console.error('Error in return to supplier:', error);
      alert(error.message || 'Failed to process return to supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle delete product
  const handleDeleteProduct = (productId) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(product => product.id !== productId));
    }
  };

  // Handle form submission for reorder point update
  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      const payload = {
        quantityToAdd: 0,
        reorderPoint: selectedProduct.newReorderPoint,
        notes: 'Reorder point updated',
        createdBy: localStorage.getItem('username') || 'Admin',
        transactionDate: new Date().toISOString()
      };

      const response = await inventoryAPI.updateStock(selectedProduct.product_id, payload);

      if (response.success) {
        alert('Product edited successfully.');
        await loadProducts();
        await loadInventoryStats();
        setIsModalOpen(false);
        // Refresh the page to show updated data
        setTimeout(() => window.location.reload(), 500);
      }
    } catch (error) {
      console.error('Error updating reorder point:', error);
      alert('Error updating reorder point: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle input changes in modal
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'newReorderPoint') {
      setSelectedProduct({
        ...selectedProduct,
        newReorderPoint: parseInt(value) || 0
      });
    }
  };

  return (
    
    <div className="inventory-layout">
     <Navbar />
      <main className="inventory-main">
        <div className="inventory-container">
     
          {/* Header Section */}
          <div className="inventory-header">
            <h1 className="inventory-title">Inventory Management</h1>
            <p className="inventory-subtitle">Monitor and adjust stock levels for all products</p>
          </div>

          {/* Controls Section */}
          <div className="inventory-controls">
            <div className="search-filter-section">
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                <button className="search-btn" type="button">
                  <BsSearch />
                </button>
              </div>

              <div className="filter-section">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="category-filter"
                >
                  <option value="All">All Categories</option>
                  {Array.from(new Set(products.map(p => p.category))).map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="status-filter"
                >
                  <option value="All">All Status</option>
                  <option value="In Stock">In Stock</option>
                  <option value="Low on Stock">Low on Stock</option>
                  <option value="Out of Stock">Out of Stock</option>
                </select>
              </div>

              <div className="action-buttons-section">
                <button 
                  onClick={handleOpenReturnToSupplier}
                  className="return-to-supplier-btn"
                >
                  Return to Supplier
                </button>
                <button 
                  onClick={handleOpenBulkStockIn}
                  className="stock-in-btn-header"
                >
                  + Stock In
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="inventory-stats">
            <div className="stat-card">
              <div className="stat-info">
                <h3>Total Products</h3>
                <p className="stat-number total-products">{inventoryStats.totalProducts}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <h3>In Stock</h3>
                <p className="stat-number in-stock">{inventoryStats.inStock}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <h3>Low on Stock</h3>
                <p className="stat-number low-stock">{inventoryStats.lowStock}</p>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-info">
                <h3>Out of Stock</h3>
                <p className="stat-number out-of-stock">{inventoryStats.outOfStock}</p>
              </div>
            </div>
          </div>

          {/* Products Table */}
          <div className="products-table-section">
            {error && (
              <div className="error-message">
                <strong>Error:</strong> {error}
                <button onClick={loadProducts}>Retry</button>
              </div>
            )}

            {loading ? (
              <div className="loading-message">Loading products...</div>
            ) : (
              <div className="table-container">
                <table className="products-table">
                <thead>
                  <tr>
                    <th>Product ID</th>
                    <th>Product Name</th>
                    <th>Category</th>
                    <th>Quantity</th>
                    <th>Stock Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentProducts.map(product => (
                    <tr key={product.id}>
                      <td>{product.product_id}</td>
                      <td>
                        <div className="product-info">
                          <h4>{product.name}</h4>
                          <p className="product-brand">{product.brand}</p>
                        </div>
                      </td>
                      <td>
                        <span className="category-badge">{product.category}</span>
                      </td>
                      <td className="quantity-cell">
                        {product.stock || 0}
                      </td>
                      <td>
                        <span className={`stock-status-badge ${product.stock > 10 ? 'in-stock' : product.stock > 0 ? 'low-stock' : 'out-of-stock'}`}>
                          {product.stock > 10 ? 'In Stock' : product.stock > 0 ? 'Low on Stock' : 'Out of Stock'}
                        </span>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button
                            onClick={() => handleEditProduct(product)}
                            className="edit-btn"
                            title="Edit Reorder Level"
                          >
                            <BsPencil />
                          </button>
                          <button
                            onClick={() => handleOpenStockInModal(product)}
                            className="stock-in-btn"
                            title="Record Stock In"
                          >
                            Stock In
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            )}

            {/* Pagination and Results Info */}
            <div className="table-footer">
              <div className="results-info">
                Showing {totalFilteredProducts > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, totalFilteredProducts)} of {totalFilteredProducts} products
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-btn"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Bulk Stock In Modal */}
      {isBulkStockInOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h2>Stock In</h2>
              <button onClick={() => setIsBulkStockInOpen(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleBulkStockInSubmit} className="product-form">
              <div className="form-section">
                <div className="form-group">
                  <label>Supplier/Source</label>
                  <input
                    type="text"
                    value={bulkStockInData.supplier}
                    onChange={(e) => setBulkStockInData(prev => ({ ...prev, supplier: e.target.value }))}
                    className="form-input"
                    placeholder="Enter supplier name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Received By</label>
                  <input
                    type="text"
                    value={bulkStockInData.receivedBy}
                    onChange={(e) => setBulkStockInData(prev => ({ ...prev, receivedBy: e.target.value }))}
                    className="form-input"
                    placeholder="Enter receiver name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Date and Time Received</label>
                  <input
                    type="datetime-local"
                    value={bulkStockInData.receivedDate}
                    onChange={(e) => setBulkStockInData(prev => ({ ...prev, receivedDate: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>

                <div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Product List</h3>
                  <button
                    type="button"
                    onClick={handleAddProductRow}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    + Add Product
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Product Name</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Brand</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '100px' }}>Quantity</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '250px' }}>Serial Numbers</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkStockInData.products.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                          No products added. Click "+ Add Product" to add products.
                        </td>
                      </tr>
                    ) : (
                      bulkStockInData.products.map((row, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '8px' }}>
                            <select
                              value={row.productId}
                              onChange={(e) => handleProductRowChange(index, 'productId', e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                              required
                            >
                              <option value="">Select Product</option>
                              {products.map(p => (
                                <option key={p.product_id} value={p.product_id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="text"
                              value={row.brand}
                              readOnly
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', backgroundColor: '#e9ecef' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => handleProductRowChange(index, 'quantity', e.target.value)}
                              min="1"
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            {/* --- Start of change --- */}
                            {row.requiresSerial ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                {Array.from({ length: row.quantity || 1 }, (_, serialIndex) => (
                                  <input
                                    key={serialIndex}
                                    type="text"
                                    value={row.serialNumbers?.[serialIndex] || ''}
                                    onChange={(e) => {
                                      const newSerials = [...(row.serialNumbers || [])];
                                      newSerials[serialIndex] = e.target.value;
                                      handleProductRowChange(index, 'serialNumbers', newSerials);
                                    }}
                                    placeholder={`Serial #${serialIndex + 1} (Required)`}
                                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ced4da', fontSize: '13px' }}
                                    required
                                  />
                                ))}
                              </div>
                            ) : (
                              // If no serial is required, show N/A
                              <div style={{ padding: '6px', color: '#6c757d', fontSize: '13px' }}>
                                N/A
                              </div>
                            )}
                            {/* --- End of change --- */}
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveProductRow(index)}
                              style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              x
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setIsBulkStockInOpen(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="confirm-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return to Supplier Modal */}
      {isReturnToSupplierOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h2>Return to Supplier</h2>
              <button onClick={() => setIsReturnToSupplierOpen(false)} className="close-btn">×</button>
            </div>

            <form onSubmit={handleReturnToSupplierSubmit} className="product-form">
              <div className="form-section">
                <div className="form-group">
                  <label>Supplier/Source</label>
                  <input
                    type="text"
                    value={returnToSupplierData.supplier}
                    onChange={(e) => setReturnToSupplierData(prev => ({ ...prev, supplier: e.target.value }))}
                    className="form-input"
                    placeholder="Enter supplier name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Returned By</label>
                  <input
                    type="text"
                    value={returnToSupplierData.returnedBy}
                    onChange={(e) => setReturnToSupplierData(prev => ({ ...prev, returnedBy: e.target.value }))}
                    className="form-input"
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input
                    type="datetime-local"
                    value={returnToSupplierData.returnDate}
                    onChange={(e) => setReturnToSupplierData(prev => ({ ...prev, returnDate: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>

                <div style={{ marginTop: '24px', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>Product List</h3>
                  <button
                    type="button"
                    onClick={handleAddReturnProductRow}
                    style={{
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    + Add Row
                  </button>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '2px solid #dee2e6' }}>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Product Name</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px' }}>Brand</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '150px' }}>Serial Number</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontSize: '14px', width: '100px' }}>Quantity</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontSize: '14px', width: '80px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {returnToSupplierData.products.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6c757d' }}>
                          No products added. Click "+ Add Row" to add products.
                        </td>
                      </tr>
                    ) : (
                      returnToSupplierData.products.map((row, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #dee2e6' }}>
                          <td style={{ padding: '8px' }}>
                            <select
                              value={row.productId}
                              onChange={(e) => handleReturnProductRowChange(index, 'productId', e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                              required
                            >
                              <option value="">Select Product</option>
                              {products.map(p => (
                                <option key={p.product_id} value={p.product_id}>{p.name}</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="text"
                              value={row.brand}
                              readOnly
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da', backgroundColor: '#e9ecef' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select
                              value={row.serialNumber}
                              onChange={(e) => handleReturnProductRowChange(index, 'serialNumber', e.target.value)}
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                              required
                              disabled={!row.productId}
                            >
                              <option value="">Select Serial Number</option>
                              {row.productId && availableSerials[row.productId]?.map(serial => (
                                <option key={serial.serial_number} value={serial.serial_number}>
                                  {serial.serial_number}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="number"
                              value={row.quantity}
                              onChange={(e) => handleReturnProductRowChange(index, 'quantity', e.target.value)}
                              min="1"
                              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}
                              required
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveReturnProductRow(index)}
                              style={{
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                padding: '6px 12px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px'
                              }}
                            >
                              x
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setIsReturnToSupplierOpen(false)} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="confirm-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Stock In Modal */}
      {stockInModal.open && stockInModal.product && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{`Stock In – ${stockInModal.product.name}`}</h2>
              <button onClick={handleCloseStockInModal} className="close-btn">×</button>
            </div>

            <form onSubmit={handleSingleStockInSubmit} className="product-form">
              <div className="form-section">
                <div className="form-group">
                  <label>Supplier/Source</label>
                  <input
                    type="text"
                    value={stockInForm.supplier}
                    onChange={(e) => setStockInForm(prev => ({ ...prev, supplier: e.target.value }))}
                    className="form-input"
                    placeholder="Enter supplier"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Received By</label>
                  <input
                    type="text"
                    value={stockInForm.receivedBy}
                    onChange={(e) => setStockInForm(prev => ({ ...prev, receivedBy: e.target.value }))}
                    className="form-input"
                    placeholder="Enter receiver name"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Date and Time Received</label>
                  <input
                    type="datetime-local"
                    value={stockInForm.receivedDate}
                    onChange={(e) => setStockInForm(prev => ({ ...prev, receivedDate: e.target.value }))}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={stockInForm.quantity}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value) || 1;
                      setStockInForm(prev => ({
                        ...prev,
                        quantity: qty,
                        serialNumbers: Array(qty).fill('').map((_, i) => prev.serialNumbers[i] || '')
                      }));
                    }}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Serial Numbers (1 per product)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Array.from({ length: parseInt(stockInForm.quantity) || 1 }, (_, index) => (
                      <input
                        key={`serial-${index}`}
                        type="text"
                        value={(stockInForm.serialNumbers && stockInForm.serialNumbers[index]) || ''}
                        onChange={(e) => {
                          const newSerials = Array.from({ length: parseInt(stockInForm.quantity) || 1 }, (_, i) => 
                            (stockInForm.serialNumbers && stockInForm.serialNumbers[i]) || ''
                          );
                          newSerials[index] = e.target.value;
                          setStockInForm(prev => ({ ...prev, serialNumbers: newSerials }));
                        }}
                        className="form-input"
                        placeholder={`Serial Number ${index + 1} (optional)`}
                        style={{ marginBottom: '4px' }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={handleCloseStockInModal} className="cancel-btn">
                  Cancel
                </button>
                <button type="submit" className="confirm-btn" disabled={isSubmitting}>
                  {isSubmitting ? 'Processing...' : 'Record Stock In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Modal */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{isAddMode ? 'Add New Product' : 'Edit Reorder Level'}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="close-btn"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="product-form">
              <div className="form-section">
                <div className="form-group">
                  <label>Product Name</label>
                  <input
                    type="text"
                    value={selectedProduct?.name || ''}
                    readOnly
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label>Current Stock</label>
                  <input
                    type="text"
                    value={selectedProduct?.stock || ''}
                    readOnly
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label>Current Reorder Level</label>
                  <input
                    type="text"
                    value={selectedProduct?.currentReorderPoint || ''}
                    readOnly
                    className="form-input readonly"
                  />
                </div>

                <div className="form-group">
                  <label>New Reorder Level</label>
                  <input
                    type="number"
                    name="newReorderPoint"
                    value={selectedProduct?.newReorderPoint || ''}
                    onChange={handleInputChange}
                    min="0"
                    className="form-input"
                    placeholder="Enter new reorder level"
                    required
                  />
                </div>

                <div className="alert-text">
                  <p>Alert when stock falls below this level</p>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setIsModalOpen(false)} className="cancel-btn" style={{ backgroundColor: 'white', color: '#333', border: '1px solid #ddd' }}>
                  Cancel
                </button>
                <button type="submit" className="confirm-btn" style={{ backgroundColor: '#28a745', color: 'white' }}>
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
