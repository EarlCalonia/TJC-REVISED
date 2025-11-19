import React, { useState, useEffect, useMemo } from 'react';
import { BsCartPlus, BsTrash, BsSearch } from 'react-icons/bs';
import Navbar from '../../components/admin/Navbar';
import '../../styles/SalesPage.css';
import { salesAPI, inventoryAPI, settingsAPI, customersAPI } from '../../utils/api'; 
import { serialNumberAPI } from '../../utils/serialNumberApi.js'; 
import { generateSaleReceipt } from '../../utils/pdfGenerator';

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
          <p style={{ margin: 0, fontSize: '0.95rem', color: '#4b5563', lineHeight: '1.5', whiteSpace: 'pre-line' }}>{message}</p>
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

const SalesPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [saleItems, setSaleItems] = useState([]);
  const [customerType, setCustomerType] = useState('new');

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [paymentOption, setPaymentOption] = useState('');
  const [shippingOption, setShippingOption] = useState('In-Store Pickup');
  const [address, setAddress] = useState('Manila');
  const [addressDetails, setAddressDetails] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [gcashRef, setGcashRef] = useState('');
  const [backendCustomers, setBackendCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  const [paymentSettings, setPaymentSettings] = useState({ cash_enabled: true, gcash_enabled: true, cod_enabled: true });
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [selectedProductForSerial, setSelectedProductForSerial] = useState(null);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState({});
  const [quantities, setQuantities] = useState({});

  // Message Box State
  const [msgBox, setMsgBox] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
  const showMessage = (title, message, type = 'info', onConfirm = null) => setMsgBox({ isOpen: true, title, message, type, onConfirm });
  const closeMessage = () => setMsgBox(prev => ({ ...prev, isOpen: false }));

  const getSaleTotal = () => saleItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  const isCompanyDeliveryAvailable = useMemo(() => getSaleTotal() >= 5000, [saleItems]);

  useEffect(() => { fetchProductsAndInventory(); fetchPaymentSettings(); fetchBackendCustomers(); }, []);

  const fetchPaymentSettings = async () => {
    try {
      const response = await settingsAPI.get(); 
      if (response.success && response.data) {
        const s = response.data;
        setPaymentSettings({ cash_enabled: !!s.cash_enabled, gcash_enabled: !!s.gcash_enabled, cod_enabled: !!s.cod_enabled });
      }
    } catch (e) { console.error('Failed to fetch payment settings:', e); }
  };

  const fetchBackendCustomers = async () => {
    try {
      const response = await customersAPI.getCustomers();
      const rows = response.data || [];
      const backendCustomers = rows.map((row, index) => {
        const fullName = row.customer_name || '';
        const parts = fullName.trim().split(' ').filter(Boolean);
        let first = fullName;
        let last = '';
        if (parts.length > 1) {
          last = parts[parts.length - 1];
          first = parts.slice(0, -1).join(' ');
        }
        return {
          id: `backend-${index}`,
          firstName: first,
          middleName: '',
          lastName: last,
          contactNumber: row.contact || '',
          address: row.address || '',
          addressDetails: row.address || '',
          location: ''
        };
      });
      setBackendCustomers(backendCustomers);
    } catch (e) {
      console.error('Failed to fetch backend customers:', e);
    }
  };

  useEffect(() => {
    if (paymentOption !== 'Cash' && paymentOption !== 'Cash on Delivery') setTenderedAmount('');
    if (paymentOption !== 'GCash') setGcashRef('');
    if (paymentOption === 'Cash on Delivery') setTenderedAmount('');
  }, [paymentOption]);

  const handlePaymentOptionChange = (value) => {
    const isCOD = value === 'Cash on Delivery';
    if (isCOD && !isCompanyDeliveryAvailable) {
        setPaymentOption('');
        showMessage('Unavailable', "Cash on Delivery is only available with Company Delivery for sales of ₱5,000 or more.", 'warning');
        return;
    }
    setPaymentOption(value);
    if (isCOD && isCompanyDeliveryAvailable) setShippingOption('Company Delivery');
  };

  const handleShippingOptionChange = (value) => {
    if (paymentOption === 'Cash on Delivery' && value === 'In-Store Pickup') {
      showMessage('Invalid Selection', "Cash on Delivery requires a delivery method.", 'warning');
      return;
    }
    setShippingOption(value);
  }

  useEffect(() => {
    if (!isCompanyDeliveryAvailable && shippingOption === 'Company Delivery') setShippingOption('In-Store Pickup');
    if (paymentOption === 'Cash on Delivery' && !isCompanyDeliveryAvailable) {
        setPaymentOption('');
        showMessage('Update', "Your order total dropped below ₱5,000. Cash on Delivery is no longer available and has been deselected.", 'info');
    }
    if (paymentOption === 'Cash on Delivery' && shippingOption === 'In-Store Pickup') setShippingOption('Company Delivery'); 
  }, [paymentOption, shippingOption, isCompanyDeliveryAvailable]);

  const fetchProductsAndInventory = async () => {
    try {
      setLoading(true); setError(null);
      const response = await inventoryAPI.getProductsWithInventory();
      const productsData = response.data?.products || [];
      const productsWithInventory = productsData.map(product => ({ ...product, stock: product.stock || 0 }));
      setProducts(productsWithInventory);
      const inventoryMap = {};
      productsWithInventory.forEach(product => { inventoryMap[product.product_id] = { stock: product.stock || 0, reorder_point: product.reorder_point || 10 }; });
      setInventory(inventoryMap);
    } catch (err) { setError('Failed to load products and inventory data'); } finally { setLoading(false); }
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const setProductQuantity = (productId, newQtyValue) => {
    const product = products.find(p => p.product_id === productId);
    if (!product) return;
    let newQty = parseInt(newQtyValue, 10);
    if (isNaN(newQty) || newQty < 1) { setQuantities(prev => ({ ...prev, [productId]: 1 })); return; }
    if (newQty > product.stock) {
      showMessage('Stock Limit', `Cannot exceed available stock (${product.stock} units available)`, 'warning');
      newQty = product.stock;
    }
    if (product.requires_serial) {
      const currentSerials = selectedSerials[productId] || [];
      if (currentSerials.length > newQty) {
        const removedSerials = currentSerials.slice(newQty);
        setSelectedSerials({ ...selectedSerials, [productId]: currentSerials.slice(0, newQty) });
        if (removedSerials.length > 0) showMessage('Serials Removed', `Removed ${removedSerials.length} serial number(s): ${removedSerials.join(', ')}`, 'info');
      }
    }
    setQuantities(prev => ({ ...prev, [productId]: newQty }));
  };

  const handleQuantityChange = (productId, change) => {
    const currentQty = quantities[productId] || 1;
    setProductQuantity(productId, currentQty + change);
  };

  const addToSale = async (product) => {
    const quantity = quantities[product.product_id] || 1;
    const productSerials = selectedSerials[product.product_id] || [];
    if (product.requires_serial && productSerials.length === 0) {
      showMessage('Missing Serials', 'Please select serial numbers for this product before adding to sale', 'warning');
      return;
    }
    if (product.requires_serial && productSerials.length !== quantity) {
      showMessage('Mismatch', `Please select ${quantity} serial number(s) for this product`, 'warning');
      return;
    }
    if (product.stock < quantity) {
      showMessage('Insufficient Stock', `Available: ${product.stock}, Requested: ${quantity}`, 'error');
      return;
    }
    try {
      const existingItem = saleItems.find(item => item.product_id === product.product_id);
      if (existingItem) {
        const newSerials = [...(existingItem.serialNumbers || []), ...productSerials];
        setSaleItems(saleItems.map(item => item.product_id === product.product_id ? { ...item, quantity: item.quantity + quantity, serialNumbers: newSerials } : item));
      } else {
        setSaleItems([...saleItems, { product_id: product.product_id, name: product.name, brand: product.brand, price: product.price, quantity, serialNumbers: productSerials }]);
      }
      setSelectedSerials(prev => ({ ...prev, [product.product_id]: [] }));
      setQuantities(prev => ({ ...prev, [product.product_id]: 1 }));
      setProducts(products.map(p => p.product_id === product.product_id ? { ...p, stock: p.stock - quantity } : p));
      setInventory(prev => ({ ...prev, [product.product_id]: { ...prev[product.product_id], stock: prev[product.product_id].stock - quantity } }));
    } catch (error) { showMessage('Error', 'Failed to add item to sale. Please try again.', 'error'); }
  };

  const removeFromSale = async (productId) => {
    const itemToRemove = saleItems.find(item => item.product_id === productId);
    if (!itemToRemove) return;
    try {
      setSaleItems(saleItems.filter(item => item.product_id !== productId));
      setProducts(products.map(p => p.product_id === productId ? { ...p, stock: p.stock + itemToRemove.quantity } : p));
      setInventory(prev => ({ ...prev, [productId]: { ...prev[productId], stock: prev[productId].stock + itemToRemove.quantity } }));
    } catch (error) { showMessage('Error', 'Failed to remove item from sale.', 'error'); }
  };

  const updateSaleQuantity = async (productId, change) => {
    const item = saleItems.find(item => item.product_id === productId);
    if (!item) return;
    const newQuantity = Math.max(1, item.quantity + change);
    const quantityDifference = newQuantity - item.quantity;
    if (quantityDifference === 0) return;
    const product = products.find(p => p.product_id === productId);
    const hasSerials = item.serialNumbers && item.serialNumbers.length > 0;
    if (hasSerials && product?.requires_serial) {
      showMessage('Restricted', `Cannot change quantity for items with serial numbers. Please remove the item and add it again with the correct quantity and serials.`, 'warning');
      return;
    }
    try {
      if (quantityDifference > 0) {
        const currentStock = inventory[productId]?.stock || 0;
        if (currentStock < quantityDifference) {
          showMessage('Insufficient Stock', `Available: ${currentStock}, Needed: ${quantityDifference}`, 'error');
          return;
        }
      }
      setSaleItems(saleItems.map(saleItem => saleItem.product_id === productId ? { ...saleItem, quantity: newQuantity } : saleItem));
      setProducts(products.map(p => p.product_id === productId ? { ...p, stock: p.stock - quantityDifference } : p));
      setInventory(prev => ({ ...prev, [productId]: { ...prev[productId], stock: prev[productId].stock - quantityDifference } }));
    } catch (error) { showMessage('Error', 'Failed to update quantity.', 'error'); }
  };

  const handleSaleQuantityInput = (productId, event) => {
    const value = event.target.value;
    const item = saleItems.find(item => item.product_id === productId);
    if (!item) return;
    let newQuantity = parseInt(value, 10);
    if (isNaN(newQuantity) || newQuantity < 1) newQuantity = 1;
    if (newQuantity === item.quantity) return;
    const quantityDifference = newQuantity - item.quantity;
    updateSaleQuantity(productId, quantityDifference);
  };

  const fillCustomerFields = (customer) => {
    setLastName(customer.lastName || ''); setFirstName(customer.firstName || ''); setMiddleName(customer.middleName || ''); setContactNumber(customer.contactNumber || ''); setAddress(customer.address || 'Manila'); setAddressDetails(customer.addressDetails || '');
  };

  const handleSelectCustomer = (customer) => {
    setSelectedCustomerId(customer.id); fillCustomerFields(customer); setCustomerSearch(`${customer.lastName}, ${customer.firstName} - ${customer.contactNumber}`); setIsCustomerDropdownOpen(false);
  };

  const handleCustomerSearchChange = (e) => {
    const value = e.target.value; setCustomerSearch(value); setIsCustomerDropdownOpen(true);
    if (selectedCustomerId) { setSelectedCustomerId(''); setAddress('Manila'); setAddressDetails(''); }
  }

  const filteredSavedCustomers = useMemo(() => {
    const searchLower = customerSearch.toLowerCase();
    if (!searchLower) return backendCustomers;
    return backendCustomers.filter(c =>
      (c.lastName || '').toLowerCase().includes(searchLower) ||
      (c.firstName || '').toLowerCase().includes(searchLower) ||
      (c.contactNumber || '').includes(searchLower)
    );
  }, [customerSearch, backendCustomers]);

  const clearSale = async () => {
    if (saleItems.length === 0) return;
    try {
      let tempProducts = [...products]; let tempInventory = { ...inventory };
      for (const item of saleItems) {
        tempProducts = tempProducts.map(p => p.product_id === item.product_id ? { ...p, stock: p.stock + item.quantity } : p);
        const productId = item.product_id;
        const currentInv = tempInventory[productId];
        if (currentInv) { tempInventory[productId] = { ...currentInv, stock: (currentInv.stock || 0) + item.quantity };
        } else { tempInventory[productId] = { stock: item.quantity, reorder_point: 10 }; }
    }
      setProducts(tempProducts); setInventory(tempInventory); setSaleItems([]);
    } catch (error) { console.error('Error clearing sale:', error); }
  };

  const clearCustomerInfo = () => {
    setLastName(''); setFirstName(''); setMiddleName(''); setContactNumber(''); setAddress('Manila'); setAddressDetails(''); setTenderedAmount(''); setGcashRef(''); setSelectedCustomerId(''); setCustomerSearch(''); setPaymentOption(''); setShippingOption('In-Store Pickup'); 
  };

  const handleOpenSerialModal = async (product) => {
    setSelectedProductForSerial(product); setSerialModalOpen(true);
    try {
      const response = await serialNumberAPI.getAvailableSerials(product.product_id);
      const allAvailableSerials = response.data || [];
      const saleItem = saleItems.find(item => item.product_id === product.product_id);
      const serialsInSale = saleItem?.serialNumbers || [];
      const filteredSerials = allAvailableSerials.filter(serial => !serialsInSale.includes(serial.serial_number));
      setAvailableSerials(filteredSerials);
      if (filteredSerials.length === 0 && serialsInSale.length > 0) showMessage('Info', `All available serial numbers for ${product.name} are already in your sale.`, 'info');
    } catch (error) {
      console.error('Error fetching serial numbers:', error); setAvailableSerials([]);
      showMessage('Error', 'Failed to load serial numbers. Please try again.', 'error');
    }
  };

  const handleCloseSerialModal = () => { setSerialModalOpen(false); setSelectedProductForSerial(null); setAvailableSerials([]); };

  const handleSerialSelection = (serialNumber) => {
    if (!selectedProductForSerial) return;
    const productId = selectedProductForSerial.product_id;
    const currentSerials = selectedSerials[productId] || [];
    const requiredQty = quantities[productId] || 1;
    if (currentSerials.includes(serialNumber)) {
      setSelectedSerials({ ...selectedSerials, [productId]: currentSerials.filter(s => s !== serialNumber) });
    } else {
      if (currentSerials.length >= requiredQty) {
        showMessage('Limit Reached', `You can only select ${requiredQty} serial number(s) for this quantity.`, 'warning');
        return;
      }
      setSelectedSerials({ ...selectedSerials, [productId]: [...currentSerials, serialNumber] });
    }
  };

  const handleConfirmSerialSelection = () => {
    if (!selectedProductForSerial) return;
    const productId = selectedProductForSerial.product_id;
    const selectedCount = (selectedSerials[productId] || []).length;
    const requiredQty = quantities[productId] || 1;
    if (selectedCount === 0) { showMessage('Selection Required', 'Please select at least one serial number', 'warning'); return; }
    if (selectedCount !== requiredQty) { showMessage('Mismatch', `Please select exactly ${requiredQty} serial number(s). Currently selected: ${selectedCount}`, 'warning'); return; }
    handleCloseSerialModal();
    showMessage('Success', `${selectedCount} serial number(s) selected for ${selectedProductForSerial.name}`, 'success');
  };

  const confirmSale = async () => {
    if (saleItems.length === 0) { showMessage('Empty Sale', 'Please add items to the sale before confirming', 'warning'); return; }
    if (!paymentOption) { showMessage('Payment Required', 'Please select a payment option before confirming sale', 'warning'); return; }
    const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
    if (!lastName.trim() || !firstName.trim()) { showMessage('Customer Info', 'Please enter customer last and first name', 'warning'); return; }
    const total = getSaleTotal();
    const isCOD = paymentOption === 'Cash on Delivery'; 
    if (!isCOD) {
      const payAmt = parseFloat(tenderedAmount);
      if (Number.isNaN(payAmt) || payAmt < total) { showMessage('Invalid Payment', 'Customer Payment Amount must be a valid decimal and at least equal to the sale total.', 'error'); return; }
    }
    try {
      setSubmitting(true);
      let newOrderStatus, newPaymentStatus;
      if (isCOD) { newOrderStatus = 'Pending'; newPaymentStatus = 'Unpaid'; } 
      else if (shippingOption === 'In-Store Pickup') { newOrderStatus = 'Completed'; newPaymentStatus = 'Paid'; } 
      else { newOrderStatus = 'Processing'; newPaymentStatus = 'Paid'; }

      const saleData = { customer_name: fullName, customer_last_name: lastName, customer_first_name: firstName, customer_middle_name: middleName, contact: contactNumber, payment: paymentOption, delivery_type: shippingOption, payment_status: newPaymentStatus, status: newOrderStatus, address: addressDetails ? `${addressDetails}, ${address}` : address, total: getSaleTotal(), items: saleItems.map(item => ({ product_id: item.product_id, product_name: item.name, brand: item.brand, price: item.price, quantity: item.quantity, serialNumbers: item.serialNumbers || [] })) };
      const result = await salesAPI.createSale(saleData);
      const saleNo = result?.data?.sale_number || 'N/A';
      try {
        const doc = await generateSaleReceipt({ saleNumber: saleNo, customerName: fullName, items: saleItems, totalAmount: getSaleTotal(), paymentMethod: paymentOption, tenderedAmount: isCOD ? getSaleTotal() : parseFloat(tenderedAmount || 0), changeAmount: isCOD ? 0 : Math.max(0, parseFloat(tenderedAmount || 0) - getSaleTotal()), address: addressDetails ? `${addressDetails}, ${address}` : address, shippingOption, createdAt: new Date() });
        doc.save(`${saleNo}_receipt.pdf`);
      } catch (e) { console.error('Failed to generate receipt:', e); }
      showMessage('Sale Confirmed', `Sale Number: ${saleNo}\nTotal: ₱${getSaleTotal().toLocaleString()}\nCustomer: ${fullName}`, 'success', async () => {
        await clearSale(); clearCustomerInfo(); setLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500)); await fetchProductsAndInventory();
      });
    } catch (error) { console.error('Error creating sale:', error); showMessage('Error', 'Failed to create sale. Please try again.', 'error'); await fetchProductsAndInventory(); } finally { setSubmitting(false); }
  };

  const isCOD = paymentOption === 'Cash on Delivery'; 
  const isPaymentInvalidOrMissing = isCOD ? false : !paymentOption || Number.isNaN(parseFloat(tenderedAmount)) || (parseFloat(tenderedAmount) < getSaleTotal());

  return (
    <div className="admin-layout">
      <Navbar />
      <main className="admin-main">
        <div className="admin-container">
          <div className="page-header">
            <h1 className="page-title">Sales Transaction</h1>
            <p className="page-subtitle">Process customer purchases and manage inventory</p>
          </div>
          {error && ( <div className="error-state"> <p>{error}</p> <button onClick={fetchProductsAndInventory} className="btn btn-danger">Retry</button> </div> )}
          <div className="sales-content">
            <div className="products-section">
              <div className="products-header"> <h2>Product Catalog</h2> <div className="search-box"> <input type="text" placeholder="Search Product Name" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" /> <button className="search-btn" type="button"><BsSearch /></button> </div> </div>
              <div className="products-table-container">
                {loading ? ( <div className="loading-state"><p>Loading products...</p></div> ) : (
                  <table className="products-table">
                    <thead><tr><th>Product Name</th><th>Brand</th><th>Price</th><th>Stock</th><th>Quantity</th><th>Serial</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredProducts.map(product => {
                        const productSerials = selectedSerials[product.product_id] || [];
                        const requiredQty = quantities[product.product_id] || 1;
                        return (
                          <tr key={product.product_id} className={product.stock === 0 ? 'row-disabled' : ''}>
                            <td className="product-name-text">{product.name}</td><td>{product.brand}</td><td className="price-cell">₱{product.price.toLocaleString()}</td>
                            <td className="stock-cell-sales"><span className={ product.stock === 0 ? 'out-of-stock' : product.stock <= (product.reorder_point || 10) ? 'low-stock' : 'good-stock' }>{product.stock}</span></td>
                            <td>{product.stock > 0 ? (<div className="quantity-controls"><button onClick={() => handleQuantityChange(product.product_id, -1)} disabled={(quantities[product.product_id] || 1) <= 1} className="quantity-btn">-</button><input type="number" value={quantities[product.product_id] || 1} onChange={(e) => setProductQuantity(product.product_id, e.target.value)} className="quantity-input" min="1" max={product.stock} /><button onClick={() => handleQuantityChange(product.product_id, 1)} className="quantity-btn">+</button></div>) : (<span className="quantity-disabled">—</span>)}</td>
                            <td>{product.requires_serial ? (<div style={{ fontSize: '12px' }}>{productSerials.length > 0 ? (<div style={{ color: productSerials.length === requiredQty ? '#28a745' : '#ffc107' }}>{productSerials.length}/{requiredQty} selected<div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{productSerials.join(', ')}</div></div>) : (<span style={{ color: '#dc3545' }}>None selected</span>)}</div>) : (<span style={{ color: '#999', fontSize: '12px' }}>N/A</span>)}</td>
                            <td><div className="action-buttons-cell">{!!product.requires_serial && (<button onClick={() => handleOpenSerialModal(product)} disabled={product.stock === 0} className="btn btn-info">Select Serial</button>)}<button onClick={() => addToSale(product)} disabled={product.stock === 0} className="btn btn-primary"><BsCartPlus className="sale-icon" />Add to Sale</button></div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            <div className="right-panel">
              <div className="sale-section">
                <div className="sale-header"><h2>Current Sale</h2></div>
                <div className="sale-items">
                  {saleItems.length === 0 ? (<div className="empty-sale"><p>No items in current sale.</p></div>) : (
                    <>
                      {saleItems.map(item => {
                        const hasSerials = item.serialNumbers && item.serialNumbers.length > 0;
                        return (
                          <div key={item.product_id} className="sale-item">
                            <div className="sale-item-info"><h4>{item.name}</h4><p>{item.brand}</p><p>₱{item.price.toLocaleString()}</p>{hasSerials && (<p style={{ fontSize: '11px', color: '#667eea', marginTop: '4px', fontWeight: '600' }}>🔒 Serial: {item.serialNumbers.join(', ')}</p>)}</div>
                            <div className="sale-item-quantity"><div className="quantity-controls"><button onClick={() => updateSaleQuantity(item.product_id, -1)} className="quantity-btn" disabled={hasSerials} title={hasSerials ? "Cannot change quantity for items with serial numbers" : "Decrease quantity"}>-</button><input type="number" value={item.quantity} onChange={(e) => handleSaleQuantityInput(item.product_id, e)} className="quantity-input" min="1" disabled={hasSerials} style={{ width: '40px', textAlign: 'center' }} title={hasSerials ? "Cannot change quantity for items with serial numbers" : "Enter quantity"} /><button onClick={() => updateSaleQuantity(item.product_id, 1)} className="quantity-btn" disabled={hasSerials} title={hasSerials ? "Cannot change quantity for items with serial numbers" : "Increase quantity"}>+</button></div></div>
                            <div className="sale-item-total">₱{(item.price * item.quantity).toLocaleString()}</div>
                            <button onClick={() => removeFromSale(item.product_id)} className="remove-btn" title="Remove from sale"><BsTrash /></button>
                          </div>
                        );
                      })}
                      <div className="sale-total"><strong>Total: ₱{getSaleTotal().toLocaleString()}</strong></div>
                    </>
                  )}
                </div>
              </div>
              <div className="customer-section">
                <h2>Customer Information</h2>
                <div className="customer-type-selection"><label className="customer-type-label">Customer Type</label><div className="radio-group"><label className="radio-option"><input type="radio" name="customerType" value="new" checked={customerType === 'new'} onChange={(e) => { setCustomerType(e.target.value); setSelectedCustomerId(''); clearCustomerInfo(); }} /><span>New Customer</span></label><label className="radio-option"><input type="radio" name="customerType" value="existing" checked={customerType === 'existing'} onChange={(e) => { setCustomerType(e.target.value); }} /><span>Existing Customer</span></label></div></div>
                <h3 className="customer-detail-heading">Customer Detail</h3>
                {customerType === 'existing' && (
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Select Customer:</label>
                    <input
                      type="text"
                      value={customerSearch}
                      onChange={handleCustomerSearchChange}
                      onFocus={() => setIsCustomerDropdownOpen(true)}
                      onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 200)}
                      placeholder={backendCustomers.length === 0 ? 'No customers found in system' : 'Type to search name or number...'}
                      className="form-input"
                      disabled={backendCustomers.length === 0}
                      autoComplete="off"
                    />
                    {isCustomerDropdownOpen && (
                      <div className="customer-search-dropdown">
                        {filteredSavedCustomers.length === 0 ? (
                          <div className="customer-search-item-none">No customer found.</div>
                        ) : (
                          filteredSavedCustomers.map(customer => (
                            <div
                              key={customer.id}
                              className="customer-search-item"
                              onMouseDown={() => handleSelectCustomer(customer)}
                            >
                              <strong>{customer.lastName}, {customer.firstName}</strong>
                              <small>{customer.contactNumber}</small>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="customer-info">
                  <div className="form-group"><label>First Name</label><input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Enter First Name" className="form-input" disabled={customerType === 'existing'} /></div>
                  <div className="form-group"><label>Middle Name</label><input type="text" value={middleName} onChange={(e) => setMiddleName(e.target.value)} placeholder="Enter Middle Name" className="form-input" disabled={customerType === 'existing'} /></div>
                  <div className="form-group"><label>Last Name</label><input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Enter Last Name" className="form-input" disabled={customerType === 'existing'} /></div>
                  <div className="form-group"><label>Contact Number</label><input type="text" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Enter Contact Number" className="form-input" disabled={customerType === 'existing'} /></div>
                  <div className="form-group"><label>Full Address</label><input type="text" value={addressDetails} onChange={(e) => setAddressDetails(e.target.value)} placeholder="Street/Barangay/City" className="form-input" disabled={customerType === 'existing'} /></div>
                  <div className="form-group"><label>Location</label><select value={address} onChange={(e) => setAddress(e.target.value)} className="form-select" disabled={customerType === 'existing'}><option value="">Choose Location</option><option value="Manila">Manila</option><option value="Pampanga">Pampanga</option><option value="Bulacan">Bulacan</option></select></div>
                  <div className="customer-form-actions"><button onClick={clearCustomerInfo} className="btn btn-outline">Clear Form</button></div>
                </div>
              </div>
              <div className="payment-shipping-section">
                <div className="form-row">
                  <div className="form-group"><label>Payment Option</label><select value={paymentOption} onChange={(e) => handlePaymentOptionChange(e.target.value)} className="form-select"><option value="">Select payment option</option>{paymentSettings.cash_enabled && (<option value="Cash">Cash</option>)}{paymentSettings.gcash_enabled && (<option value="GCash">GCash</option>)}{paymentSettings.cod_enabled && (<option value="Cash on Delivery" disabled={!isCompanyDeliveryAvailable}>Cash on Delivery</option>)}</select></div>
                  <div className="form-group"><label>Shipping Option</label><select value={shippingOption} onChange={(e) => handleShippingOptionChange(e.target.value)} className="form-select"><option value="In-Store Pickup" disabled={paymentOption === 'Cash on Delivery'}>In-Store Pickup</option><option value="Company Delivery" disabled={!isCompanyDeliveryAvailable}>Company Delivery (Free)</option></select></div>
                </div>
                <div className="form-row">
                  {paymentOption !== 'Cash on Delivery' && (<div className="form-group"><label>Customer Payment Amount</label><input type="number" min={0} step={0.01} value={tenderedAmount} onChange={(e) => setTenderedAmount(e.target.value)} className="form-input" placeholder={!paymentOption ? 'Select payment option first' : paymentOption === 'Cash' ? 'Cash tendered' : 'Amount paid'} disabled={!paymentOption} /></div>)}
                  {paymentOption === 'GCash' && (<div className="form-group"><label>GCash Reference Number</label><input type="text" value={gcashRef} onChange={(e) => setGcashRef(e.target.value)} className="form-input" placeholder="Enter GCash reference" /></div>)}
                  {paymentOption === 'Cash' && (<div className="form-group"><label>Change</label><input type="text" readOnly value={`₱${Math.max(0, (parseFloat(tenderedAmount || 0) - getSaleTotal())).toLocaleString()}`} className="form-input readonly" /></div>)}
                </div>
              </div>
              <div className="action-buttons-right"><button onClick={confirmSale} disabled={submitting || saleItems.length === 0 || !paymentOption || isPaymentInvalidOrMissing} className="btn btn-primary">{submitting ? 'Processing...' : 'Confirm Sale'}</button><button onClick={clearSale} className="btn btn-secondary">Clear Sale</button></div>
            </div>
          </div>
        </div>
        <MessageBox isOpen={msgBox.isOpen} title={msgBox.title} message={msgBox.message} type={msgBox.type} onClose={closeMessage} onConfirm={msgBox.onConfirm} />
        {serialModalOpen && selectedProductForSerial && (
          <div className="modal-overlay" onClick={handleCloseSerialModal}>
            <div className="modal-content serial-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header"><h2>Select Serial Numbers</h2><button onClick={handleCloseSerialModal} className="close-btn">×</button></div>
              <div className="modal-body">
                <div className="product-info-header"><h3>{selectedProductForSerial.name}</h3><p className="product-brand">{selectedProductForSerial.brand}</p><p className="selected-count" style={{ color: (selectedSerials[selectedProductForSerial.product_id] || []).length === (quantities[selectedProductForSerial.product_id] || 1) ? '#28a745' : '#dc3545' }}>Selected: {(selectedSerials[selectedProductForSerial.product_id] || []).length} / {quantities[selectedProductForSerial.product_id] || 1} required</p><p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>Available serial numbers: {availableSerials.length}</p></div>
                <div className="serial-list">
                  {availableSerials.map((serial) => {
                    const isSelected = (selectedSerials[selectedProductForSerial.product_id] || []).includes(serial.serial_number);
                    return (<div key={serial.serial_number} className={`serial-item ${isSelected ? 'selected' : ''} ${!isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1) ? 'disabled' : ''}`} onClick={() => handleSerialSelection(serial.serial_number)} style={{ cursor: !isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1) ? 'not-allowed' : 'pointer', opacity: !isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1) ? 0.5 : 1 }}><input type="checkbox" checked={isSelected} onChange={() => {}} className="serial-checkbox" disabled={!isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1)} /><span className="serial-number">{serial.serial_number}</span><span className={`serial-status ${serial.status}`}>{serial.status}</span></div>);
                  })}
                </div>
              </div>
              <div className="modal-actions"><button onClick={handleCloseSerialModal} className="cancel-btn">Cancel</button><button onClick={handleConfirmSerialSelection} className="confirm-btn">Confirm Selection</button></div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SalesPage;