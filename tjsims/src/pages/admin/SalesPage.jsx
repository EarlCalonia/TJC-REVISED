import React, { useState, useEffect } from 'react';
import { BsCartPlus, BsTrash, BsSearch } from 'react-icons/bs';
import Navbar from '../../components/admin/Navbar';
import '../../styles/SalesPage.css';
import { productAPI, salesAPI, inventoryAPI } from '../../utils/api';
import { serialNumberAPI } from '../../utils/serialNumberApi';
import { generateSaleReceipt } from '../../utils/pdfGenerator';

const SalesPage = () => {
  const SAVED_CUSTOMERS_KEY = 'sales_saved_customers';

  const [searchQuery, setSearchQuery] = useState('');
  // REVISION: Renamed cart state to saleItems
  const [saleItems, setSaleItems] = useState([]);
  const [customerType, setCustomerType] = useState('new'); // 'new' or 'existing'
  const [saveCustomerInfo, setSaveCustomerInfo] = useState(false);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [paymentOption, setPaymentOption] = useState('');
  const [shippingOption, setShippingOption] = useState('In-Store Pickup');
  
  // REVISION: This state is no longer needed, it's set dynamically
  // const [orderStatus, setOrderStatus] = useState('Pending'); 
  
  const [paymentStatus, setPaymentStatus] = useState('Paid');
  const [address, setAddress] = useState('Manila');
  const [addressDetails, setAddressDetails] = useState('');
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [gcashRef, setGcashRef] = useState('');

  const [savedCustomers, setSavedCustomers] = useState(() => {
    if (typeof window === 'undefined') return [];
    try {
      const stored = window.localStorage.getItem(SAVED_CUSTOMERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Failed to load saved customers:', err);
      return [];
    }
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState('');

  // New state for API integration
  const [products, setProducts] = useState([]);
  const [inventory, setInventory] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Serial number selection state
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [selectedProductForSerial, setSelectedProductForSerial] = useState(null);
  const [availableSerials, setAvailableSerials] = useState([]);
  const [selectedSerials, setSelectedSerials] = useState({});

  // Fetch products and inventory data on component mount
  useEffect(() => {
    fetchProductsAndInventory();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SAVED_CUSTOMERS_KEY, JSON.stringify(savedCustomers));
  }, [savedCustomers]);

  useEffect(() => {
    if (!paymentOption) {
      setTenderedAmount('');
    }
    if (paymentOption !== 'GCash') {
      setGcashRef('');
    }
  }, [paymentOption]);

  const fetchProductsAndInventory = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch products with inventory data
      const response = await inventoryAPI.getProductsWithInventory();

      // The API returns { success: true, data: { products: [...] } }
      const productsData = response.data?.products || [];

      // The API returns an array of products with inventory info
      const productsWithInventory = productsData.map(product => ({
        ...product,
        stock: product.stock || 0
      }));

      setProducts(productsWithInventory);

      // Create inventory lookup map
      const inventoryMap = {};
      productsWithInventory.forEach(product => {
        inventoryMap[product.product_id] = {
          stock: product.stock || 0,
          reorder_point: product.reorder_point || 10
        };
      });
      setInventory(inventoryMap);

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load products and inventory data');
    } finally {
      setLoading(false);
    }
  };

  const [quantities, setQuantities] = useState({});

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.brand.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleQuantityChange = (productId, change) => {
    const product = products.find(p => p.product_id === productId);
    if (!product) return;

    const currentQty = quantities[productId] || 1;
    const newQty = currentQty + change;

    // Enforce minimum of 1
    if (newQty < 1) return;

    // Enforce maximum of available stock
    if (newQty > product.stock) {
      alert(`Cannot exceed available stock (${product.stock} units available)`);
      return;
    }

    // Handle serial numbers when decreasing quantity
    if (change < 0 && product.requires_serial) {
      const currentSerials = selectedSerials[productId] || [];
      if (currentSerials.length > newQty) {
        // Auto-remove excess serials from the end
        const removedSerials = currentSerials.slice(newQty);
        setSelectedSerials({
          ...selectedSerials,
          [productId]: currentSerials.slice(0, newQty)
        });
        if (removedSerials.length > 0) {
          alert(`Removed ${removedSerials.length} serial number(s): ${removedSerials.join(', ')}`);
        }
      }
    }

    // Handle serial numbers when increasing quantity
    if (change > 0 && product.requires_serial) {
      const currentSerials = selectedSerials[productId] || [];
      if (currentSerials.length < newQty) {
        alert(`Please select ${newQty - currentSerials.length} more serial number(s) after increasing quantity`);
      }
    }

    setQuantities(prev => ({
      ...prev,
      [productId]: newQty
    }));
  };

  // REVISION: Renamed function
  const addToSale = async (product) => {
    const quantity = quantities[product.product_id] || 1;
    const productSerials = selectedSerials[product.product_id] || [];

    // Check if product requires serial numbers
    if (product.requires_serial && productSerials.length === 0) {
      alert('Please select serial numbers for this product before adding to sale');
      return;
    }

    // Check if serial count matches quantity for products requiring serials
    if (product.requires_serial && productSerials.length !== quantity) {
      alert(`Please select ${quantity} serial number(s) for this product`);
      return;
    }

    // Check if we have enough stock
    if (product.stock < quantity) {
      alert(`Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`);
      return;
    }

    try {
      // REVISION: Renamed state variables
      const existingItem = saleItems.find(item => item.product_id === product.product_id);

      if (existingItem) {
        // Add to existing sale item
        const newSerials = [...(existingItem.serialNumbers || []), ...productSerials];
        setSaleItems(saleItems.map(item =>
          item.product_id === product.product_id
            ? { ...item, quantity: item.quantity + quantity, serialNumbers: newSerials }
            : item
        ));
      } else {
        // Add new sale item
        setSaleItems([...saleItems, {
          product_id: product.product_id,
          name: product.name,
          brand: product.brand,
          price: product.price,
          quantity,
          serialNumbers: productSerials
        }]);
      }

      // Clear selected serials for this product
      setSelectedSerials(prev => ({
        ...prev,
        [product.product_id]: []
      }));

      // Reset quantity
      setQuantities(prev => ({
        ...prev,
        [product.product_id]: 1
      }));

      // Update local state to reflect stock change
      setProducts(products.map(p =>
        p.product_id === product.product_id
          ? { ...p, stock: p.stock - quantity }
          : p
      ));

      // Update inventory map
      setInventory(prev => ({
        ...prev,
        [product.product_id]: {
          ...prev[product.product_id],
          stock: prev[product.product_id].stock - quantity
        }
      }));

    } catch (error) {
      console.error('Error adding to sale:', error);
      alert('Failed to add item to sale. Please try again.');
    }
  };

  // REVISION: Renamed function
  const removeFromSale = async (productId) => {
    // REVISION: Renamed state variable
    const itemToRemove = saleItems.find(item => item.product_id === productId);
    if (!itemToRemove) return;

    try {
      // Remove from sale
      // REVISION: Renamed state variable
      setSaleItems(saleItems.filter(item => item.product_id !== productId));

      // Update local state to reflect stock change
      setProducts(products.map(p =>
        p.product_id === productId
          ? { ...p, stock: p.stock + itemToRemove.quantity }
          : p
      ));

      // Update inventory map
      setInventory(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          stock: prev[productId].stock + itemToRemove.quantity
        }
      }));

    } catch (error) {
      console.error('Error removing from sale:', error);
      alert('Failed to remove item from sale. Please try again.');
    }
  };

  // REVISION: Renamed function
  const updateSaleQuantity = async (productId, change) => {
    // REVISION: Renamed state variable
    const item = saleItems.find(item => item.product_id === productId);
    if (!item) return;

    const newQuantity = Math.max(1, item.quantity + change);
    const quantityDifference = newQuantity - item.quantity;

    // If quantity is not changing, return early
    if (quantityDifference === 0) return;

    // Check if product requires serial numbers
    const product = products.find(p => p.product_id === productId);
    const hasSerials = item.serialNumbers && item.serialNumbers.length > 0;

    // Prevent changing quantity if item has serial numbers
    if (hasSerials && product?.requires_serial) {
      alert(`Cannot change quantity for items with serial numbers. Please remove the item and add it again with the correct quantity and serials.`);
      return;
    }

    try {
      // Check stock availability for increases
      if (quantityDifference > 0) {
        const currentStock = inventory[productId]?.stock || 0;
        if (currentStock < quantityDifference) {
          alert(`Insufficient stock. Available: ${currentStock}, Needed: ${quantityDifference}`);
          return;
        }
      }

      // Update sale
      // REVISION: Renamed state variable
      setSaleItems(saleItems.map(saleItem =>
        saleItem.product_id === productId
          ? { ...saleItem, quantity: newQuantity }
          : saleItem
      ));

      // Update local state to reflect stock change
      setProducts(products.map(p =>
        p.product_id === productId
          ? { ...p, stock: p.stock - quantityDifference }
          : p
      ));

      // Update inventory map
      setInventory(prev => ({
        ...prev,
        [productId]: {
          ...prev[productId],
          stock: prev[productId].stock - quantityDifference
        }
      }));

    } catch (error) {
      console.error('Error updating sale quantity:', error);
      alert('Failed to update quantity. Please try again.');
    }
  };

  const fillCustomerFields = (customer) => {
    setLastName(customer.lastName || '');
    setFirstName(customer.firstName || '');
    setMiddleName(customer.middleName || '');
    setContactNumber(customer.contactNumber || '');
    setAddress(customer.address || 'Manila');
    setAddressDetails(customer.addressDetails || '');
  };

  const handleSelectCustomer = (customerId) => {
    setSelectedCustomerId(customerId);
    if (!customerId) {
      return;
    }

    const customer = savedCustomers.find(item => item.id === customerId);
    if (customer) {
      fillCustomerFields(customer);
    }
  };

  const handleSaveCustomer = () => {
    const normalizedLastName = lastName.trim();
    const normalizedFirstName = firstName.trim();
    const normalizedContact = contactNumber.trim();

    if (!normalizedLastName || !normalizedFirstName || !normalizedContact) {
      alert('Please provide last name, first name, and contact number before saving.');
      return;
    }

    const existingIndex = savedCustomers.findIndex(
      customer => customer.id === selectedCustomerId || customer.contactNumber === normalizedContact
    );

    const id = existingIndex >= 0
      ? savedCustomers[existingIndex].id
      : Date.now().toString();

    const updatedCustomer = {
      id,
      lastName: normalizedLastName,
      firstName: normalizedFirstName,
      middleName: middleName.trim(),
      contactNumber: normalizedContact,
      address,
      addressDetails: addressDetails.trim()
    };

    setSavedCustomers(prev => {
      const updated = [...prev];
      if (existingIndex >= 0) {
        updated[existingIndex] = updatedCustomer;
      } else {
        updated.push(updatedCustomer);
      }
      return updated.sort((a, b) => {
        const lastCompare = a.lastName.localeCompare(b.lastName);
        if (lastCompare !== 0) return lastCompare;
        return a.firstName.localeCompare(b.firstName);
      });
    });

    setSelectedCustomerId(id);
    alert('Customer saved successfully.');
  };

  const handleRemoveCustomer = () => {
    if (!selectedCustomerId) {
      alert('Please select a saved customer to remove.');
      return;
    }

    setSavedCustomers(prev => prev.filter(customer => customer.id !== selectedCustomerId));
    setSelectedCustomerId('');
    alert('Saved customer removed.');
  };

  // REVISION: Renamed function
  const getSaleTotal = () => {
    // REVISION: Renamed state variable
    return saleItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  // REVISION: Renamed function
  const clearSale = async () => {
    // REVISION: Renamed state variable
    if (saleItems.length === 0) return;

    try {
      // Add all stock back for each item in sale LOCALLY
      let tempProducts = [...products];
      let tempInventory = { ...inventory };

      // REVISION: Renamed state variable
      for (const item of saleItems) {
        tempProducts = tempProducts.map(p =>
          p.product_id === item.product_id
            ? { ...p, stock: p.stock + item.quantity }
            : p
        );

        tempInventory = {
          ...tempInventory,
          [item.product_id]: {
            ...tempInventory[item.product_id],
            stock: tempInventory[item.product_id].stock + item.quantity
          }
        };
      }

      setProducts(tempProducts);
      setInventory(tempInventory);

      // Clear the sale
      // REVISION: Renamed state variable
      setSaleItems([]);

    } catch (error) {
      console.error('Error clearing sale:', error);
      alert('Failed to clear sale. Please try again.');
    }
  };

  const clearCustomerInfo = () => {
    setLastName('');
    setFirstName('');
    setMiddleName('');
    setContactNumber('');
    setAddress('Manila');
    setAddressDetails('');
    setTenderedAmount('');
    setGcashRef('');
    setSelectedCustomerId('');
    setPaymentOption('');
  };

  const handleOpenSerialModal = async (product) => {
    setSelectedProductForSerial(product);
    setSerialModalOpen(true);
    
    try {
      // Fetch available serial numbers from backend
      const response = await serialNumberAPI.getAvailableSerials(product.product_id);
      const allAvailableSerials = response.data || [];
      
      // Get serial numbers already in the sale for this product
      // REVISION: Renamed state variable
      const saleItem = saleItems.find(item => item.product_id === product.product_id);
      const serialsInSale = saleItem?.serialNumbers || [];
      
      // Filter out serials that are already in the sale
      const filteredSerials = allAvailableSerials.filter(
        serial => !serialsInSale.includes(serial.serial_number)
      );
      
      setAvailableSerials(filteredSerials);
      
      if (filteredSerials.length === 0 && serialsInSale.length > 0) {
        alert(`All available serial numbers for ${product.name} are already in your sale.`);
      }
    } catch (error) {
      console.error('Error fetching serial numbers:', error);
      setAvailableSerials([]);
      alert('Failed to load serial numbers. Please try again.');
    }
  };

  const handleCloseSerialModal = () => {
    setSerialModalOpen(false);
    setSelectedProductForSerial(null);
    setAvailableSerials([]);
  };

  const handleSerialSelection = (serialNumber) => {
    if (!selectedProductForSerial) return;
    
    const productId = selectedProductForSerial.product_id;
    const currentSerials = selectedSerials[productId] || [];
    const requiredQty = quantities[productId] || 1;
    
    if (currentSerials.includes(serialNumber)) {
      // Remove serial if already selected
      setSelectedSerials({
        ...selectedSerials,
        [productId]: currentSerials.filter(s => s !== serialNumber)
      });
    } else {
      // Check if we've reached the limit
      if (currentSerials.length >= requiredQty) {
        alert(`You can only select ${requiredQty} serial number(s) for this quantity. Please deselect one first or increase the quantity.`);
        return;
      }
      
      // Add serial if not selected and under limit
      setSelectedSerials({
        ...selectedSerials,
        [productId]: [...currentSerials, serialNumber]
      });
    }
  };

  const handleConfirmSerialSelection = () => {
    if (!selectedProductForSerial) return;
    
    const productId = selectedProductForSerial.product_id;
    const selectedCount = (selectedSerials[productId] || []).length;
    const requiredQty = quantities[productId] || 1;
    
    if (selectedCount === 0) {
      alert('Please select at least one serial number');
      return;
    }
    
    // Validate that selected count matches required quantity
    if (selectedCount !== requiredQty) {
      alert(`Please select exactly ${requiredQty} serial number(s). Currently selected: ${selectedCount}`);
      return;
    }
    
    handleCloseSerialModal();
    alert(`${selectedCount} serial number(s) selected for ${selectedProductForSerial.name}`);
  };

  const confirmSale = async () => {
    if (saleItems.length === 0) {
      alert('Please add items to the sale before confirming');
      return;
    }
    if (!paymentOption) {
      alert('Please select a payment option before confirming sale');
      return;
    }
    const fullName = `${firstName} ${middleName} ${lastName}`.replace(/\s+/g, ' ').trim();
    if (!lastName.trim() || !firstName.trim()) {
      alert('Please enter customer last and first name');
      return;
    }
    const total = getSaleTotal();
    const payAmt = parseFloat(tenderedAmount);
    if (Number.isNaN(payAmt) || payAmt < total) {
      alert('Customer Payment Amount must be a valid decimal and at least equal to the sale total.');
      return;
    }

    try {
      setSubmitting(true);

      // Enforce shipping option rule
      if (getSaleTotal() < 5000 && shippingOption !== 'In-Store Pickup') {
        setShippingOption('In-Store Pickup');
      }
      
      // REVISION: Set status based on shipping option
      const newOrderStatus = shippingOption === 'In-Store Pickup' ? 'Completed' : 'Processing';

      const saleData = {
        customer_name: fullName,
        contact: contactNumber,
        payment: paymentOption,
        payment_status: paymentStatus,
        status: newOrderStatus, // REVISION: Use dynamic status
        address: addressDetails ? `${addressDetails}, ${address}` : address,
        total: getSaleTotal(),
        items: saleItems.map(item => ({
          product_id: item.product_id,
          product_name: item.name,
          brand: item.brand,
          price: item.price,
          quantity: item.quantity,
          serialNumbers: item.serialNumbers || [] // Include serial numbers
        }))
      };

      const result = await salesAPI.createSale(saleData);
      const saleNo = result?.data?.sale_number || 'N/A';
      const saleId = result?.data?.sale_id;

      // Auto-generate and download receipt
      try {
        const doc = await generateSaleReceipt({
          saleNumber: saleNo,
          customerName: fullName,
          items: saleItems,
          totalAmount: getSaleTotal(),
          paymentMethod: paymentOption,
          tenderedAmount: parseFloat(tenderedAmount || 0),
          changeAmount: Math.max(0, parseFloat(tenderedAmount || 0) - getSaleTotal()),
          address: addressDetails ? `${addressDetails}, ${address}` : address,
          shippingOption,
          createdAt: new Date()
        });
        doc.save(`${saleNo}_receipt.pdf`);
      } catch (e) {
        console.error('Failed to generate receipt:', e);
      }

      alert(`Sale confirmed successfully!\nSale Number: ${saleNo}\nTotal: ₱${getSaleTotal().toLocaleString()}\nCustomer: ${fullName}`);
      
      await clearSale(); 
      clearCustomerInfo();

      // Show refresh indicator and refresh inventory data
      setLoading(true);
      await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for visual feedback
      await fetchProductsAndInventory();

    } catch (error) {
      console.error('Error creating sale:', error);
      alert('Failed to create sale. Please try again.');
      await fetchProductsAndInventory();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="sales-layout">
      <Navbar />
      <main className="sales-main">
        <div className="sales-container">
          <div className="sales-header">
            <h1 className="sales-title">Sales Transaction</h1>
            <p className="sales-subtitle">Process customer purchases and manage inventory</p>
          </div>

          {error && (
            <div className="error-banner">
              <p>{error}</p>
              <button onClick={fetchProductsAndInventory} className="retry-btn">
                Retry
              </button>
            </div>
          )}

          <div className="sales-content">
            {/* Products Section */}
            <div className="products-section">
              <div className="products-header">
                <h2>Product List</h2>
                <div className="search-box">
                  <BsSearch className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              <div className="products-table-container">
                {loading ? (
                  <div className="loading-state">
                    <p>Loading products...</p>
                  </div>
                ) : (
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Brand</th>
                        <th>Price</th>
                        <th>Stock</th>
                        <th>Quantity</th>
                        <th>Serial Numbers</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map(product => {
                        const productSerials = selectedSerials[product.product_id] || [];
                        const requiredQty = quantities[product.product_id] || 1;
                        return (
                          <tr key={product.product_id} className={product.stock === 0 ? 'row-disabled' : ''}>
                            <td className="product-name-text">{product.name}</td>
                            <td>{product.brand}</td>
                            <td className="price-cell">₱{product.price.toLocaleString()}</td>
                            
                            {/* --- THIS IS THE FIXED STOCK CELL --- */}
                            <td className="stock-cell-sales">
                              <span className={
                                product.stock === 0 ? 'out-of-stock' : 
                                product.stock <= (product.reorder_point || 10) / 2 ? 'low-stock' : 
                                'good-stock'
                              }>
                                {product.stock === 0 ? 'Out of Stock' :
                                 product.stock <= (product.reorder_point || 10) / 2 ? 'Low on Stock' :
                                 'In Stock'}
                              </span>
                            </td>
                            {/* --- END OF FIX --- */}

                            <td>
                              {product.stock > 0 ? (
                                <div className="quantity-controls">
                                  <button
                                    onClick={() => handleQuantityChange(product.product_id, -1)}
                                    disabled={(quantities[product.product_id] || 1) <= 1}
                                    className="quantity-btn"
                                  >
                                    -
                                  </button>
                                  <span className="quantity-display">
                                    {quantities[product.product_id] || 1}
                                  </span>
                                  <button
                                    onClick={() => handleQuantityChange(product.product_id, 1)}
                                    className="quantity-btn"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <span className="quantity-disabled">—</span>
                              )}
                            </td>

                            <td>
                              {product.requires_serial ? (
                                <div style={{ fontSize: '12px' }}>
                                  {productSerials.length > 0 ? (
                                    <div style={{ color: productSerials.length === requiredQty ? '#28a745' : '#ffc107' }}>
                                      {productSerials.length}/{requiredQty} selected
                                      <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                        {productSerials.join(', ')}
                                      </div>
                                    </div>
                                  ) : (
                                    <span style={{ color: '#dc3545' }}>None selected</span>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: '#999', fontSize: '12px' }}>N/A</span>
                              )}
                            </td>
                            
                            <td>
                              <div className="action-buttons-cell">
                                {!!product.requires_serial && (
                                  <button
                                    onClick={() => handleOpenSerialModal(product)}
                                    disabled={product.stock === 0}
                                    className="select-serial-btn"
                                  >
                                    Select Serial
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => addToSale(product)}
                                  disabled={product.stock === 0}
                                  className="add-to-sale-btn"
                                >
                                  <BsCartPlus className="sale-icon" />
                                  Add to Sale
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Right Panel - Shopping Cart & Forms */}
            <div className="right-panel">
              <div className="sale-section">
                <div className="sale-header">
                  <h2>Current Sale</h2>
                </div>

                <div className="sale-items">
                  {saleItems.length === 0 ? (
                    <div className="empty-sale">
                      <p>No items in current sale.</p>
                    </div>
                  ) : (
                    <>
                      {saleItems.map(item => {
                        const hasSerials = item.serialNumbers && item.serialNumbers.length > 0;
                        return (
                          <div key={item.product_id} className="sale-item">
                            <div className="sale-item-info">
                              <h4>{item.name}</h4>
                              <p>{item.brand}</p>
                              <p>₱{item.price.toLocaleString()}</p>
                              {hasSerials && (
                                <p style={{ fontSize: '11px', color: '#667eea', marginTop: '4px', fontWeight: '600' }}>
                                  🔒 Serial: {item.serialNumbers.join(', ')}
                                </p>
                              )}
                            </div>
                            <div className="sale-item-quantity">
                              <div className="quantity-controls">
                                <button
                                  onClick={() => updateSaleQuantity(item.product_id, -1)}
                                  className="quantity-btn"
                                  disabled={hasSerials}
                                  title={hasSerials ? "Cannot change quantity for items with serial numbers" : "Decrease quantity"}
                                >
                                  -
                                </button>
                                <span className="quantity-display">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => updateSaleQuantity(item.product_id, 1)}
                                  className="quantity-btn"
                                  disabled={hasSerials}
                                  title={hasSerials ? "Cannot change quantity for items with serial numbers" : "Increase quantity"}
                                >
                                  +
                                </button>
                              </div>
                            </div>
                            <div className="sale-item-total">
                              ₱{(item.price * item.quantity).toLocaleString()}
                            </div>
                            <button
                              onClick={() => removeFromSale(item.product_id)}
                              className="remove-btn"
                              title="Remove from sale"
                            >
                              <BsTrash />
                            </button>
                          </div>
                        );
                      })}
                      <div className="sale-total">
                        <strong>Total: ₱{getSaleTotal().toLocaleString()}</strong>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Customer Information Section */}
              <div className="customer-section">
                <h2>Customer Information</h2>
                
                {/* Customer Type Selection */}
                <div className="customer-type-selection">
                  <label className="customer-type-label">Customer Type</label>
                  <div className="radio-group">
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="customerType"
                        value="new"
                        checked={customerType === 'new'}
                        onChange={(e) => {
                          setCustomerType(e.target.value);
                          setSelectedCustomerId('');
                          clearCustomerInfo();
                        }}
                      />
                      <span>New Customer</span>
                    </label>
                    <label className="radio-option">
                      <input
                        type="radio"
                        name="customerType"
                        value="existing"
                        checked={customerType === 'existing'}
                        onChange={(e) => {
                          setCustomerType(e.target.value);
                          setSaveCustomerInfo(false);
                        }}
                      />
                      <span>Existing Customer</span>
                    </label>
                  </div>
                </div>

                <h3 className="customer-detail-heading">Customer Detail</h3>

                {/* Existing Customer Selection */}
                {customerType === 'existing' && (
                  <div className="info-row">
                    <label>Select Customer:</label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => handleSelectCustomer(e.target.value)}
                      className="info-input"
                      disabled={savedCustomers.length === 0}
                    >
                      <option value="">
                        {savedCustomers.length === 0 ? 'No saved customers yet' : 'Select saved customer'}
                      </option>
                      {savedCustomers.map(customer => (
                        <option key={customer.id} value={customer.id}>
                          {`${customer.lastName}, ${customer.firstName} - ${customer.contactNumber}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="customer-info">
                  <div className="info-row">
                    <label>First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="Enter First Name"
                      className="info-input"
                      disabled={customerType === 'existing'}
                    />
                  </div>
                  <div className="info-row">
                    <label>Middle Name</label>
                    <input
                      type="text"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      placeholder="Enter Middle Name"
                      className="info-input"
                      disabled={customerType === 'existing'}
                    />
                  </div>
                  <div className="info-row">
                    <label>Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Enter Last Name"
                      className="info-input"
                      disabled={customerType === 'existing'}
                    />
                  </div>
                  <div className="info-row">
                    <label>Contact Number</label>
                    <input
                      type="text"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="Enter Contact Number"
                      className="info-input"
                      disabled={customerType === 'existing'}
                    />
                  </div>
                  <div className="info-row">
                    <label>Full Address</label>
                    <input
                      type="text"
                      value={addressDetails}
                      onChange={(e) => setAddressDetails(e.target.value)}
                      placeholder="Street/Barangay/City"
                      className="info-input"
                      disabled={customerType === 'existing'}
                    />
                  </div>
                  <div className="info-row">
                    <label>Location</label>
                    <select
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="info-input"
                      disabled={customerType === 'existing'}
                    >
                      <option value="">Choose Location</option>
                      <option value="Manila">Manila</option>
                      <option value="Pampanga">Pampanga</option>
                      <option value="Bulacan">Bulacan</option>
                    </select>
                  </div>

                  {/* Save Customer Info Checkbox - Only for New Customer */}
                  {customerType === 'new' && (
                    <div className="info-row">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={saveCustomerInfo}
                          onChange={(e) => setSaveCustomerInfo(e.target.checked)}
                          className="checkbox-input"
                        />
                        <span>Save this Customer Information</span>
                      </label>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="customer-form-actions">
                    <button onClick={clearCustomerInfo} className="clear-form-btn">
                      Clear Form
                    </button>
                    {customerType === 'new' && saveCustomerInfo && (
                      <button onClick={handleSaveCustomer} className="save-form-btn">
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment and Shipping Section */}
              <div className="payment-shipping-section">
                <div className="form-row">
                  <div className="form-group">
                    <label>Payment Option</label>
                    <select
                      value={paymentOption}
                      onChange={(e) => setPaymentOption(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select payment option</option>
                      <option value="Cash">Cash</option>
                      <option value="GCash">GCash</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Shipping Option</label>
                    <select
                      value={shippingOption}
                      onChange={(e) => setShippingOption(e.target.value)}
                      className="form-select"
                    >
                      <option value="In-Store Pickup">In-Store Pickup</option>
                      {getSaleTotal() >= 5000 && (
                        <option value="Company Delivery">Company Delivery</option>
                      )}
                    </select>
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Customer Payment Amount</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={tenderedAmount}
                      onChange={(e) => setTenderedAmount(e.target.value)}
                      className="form-input"
                      placeholder={!paymentOption ? 'Select payment option first' : paymentOption === 'Cash' ? 'Cash tendered' : 'Amount paid'}
                      disabled={!paymentOption}
                    />
                  </div>
                  {paymentOption === 'GCash' && (
                    <div className="form-group">
                      <label>GCash Reference Number</label>
                      <input
                        type="text"
                        value={gcashRef}
                        onChange={(e) => setGcashRef(e.target.value)}
                        className="form-input"
                        placeholder="Enter GCash reference"
                      />
                    </div>
                  )}
                  {paymentOption === 'Cash' && (
                    <div className="form-group">
                      <label>Change</label>
                      <input
                        type="text"
                        readOnly
                        value={`₱${Math.max(0, (parseFloat(tenderedAmount || 0) - getSaleTotal())).toLocaleString()}`}
                        className="form-input readonly"
                      />
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Action Buttons - Right Side */}
          <div className="action-buttons-right">
            {(() => {
              const total = getSaleTotal();
              const payAmt = parseFloat(tenderedAmount);
              var _isPaymentValid = !Number.isNaN(payAmt) && payAmt >= total;
              window.__sales_isPaymentValid = _isPaymentValid; // minimal debug aid
              return null;
            })()}
            <button
              onClick={confirmSale}
              disabled={submitting || saleItems.length === 0 || !paymentOption || Number.isNaN(parseFloat(tenderedAmount)) || parseFloat(tenderedAmount) < getSaleTotal()}
              className="confirm-btn"
            >
              {submitting ? 'Processing...' : 'Confirm Sale'}
            </button>
            <button onClick={clearSale} className="clear-sale-btn">
              Clear Sale
            </button>
          </div>
        </div>

        {/* Serial Number Selection Modal */}
        {serialModalOpen && selectedProductForSerial && (
          <div className="modal-overlay" onClick={handleCloseSerialModal}>
            <div className="modal-content serial-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Select Serial Numbers</h2>
                <button onClick={handleCloseSerialModal} className="close-btn">×</button>
              </div>
              
              <div className="modal-body">
                <div className="product-info-header">
                  <h3>{selectedProductForSerial.name}</h3>
                  <p className="product-brand">{selectedProductForSerial.brand}</p>
                  <p className="selected-count" style={{
                    color: (selectedSerials[selectedProductForSerial.product_id] || []).length === (quantities[selectedProductForSerial.product_id] || 1) ? '#28a745' : '#dc3545'
                  }}>
                    Selected: {(selectedSerials[selectedProductForSerial.product_id] || []).length} / {quantities[selectedProductForSerial.product_id] || 1} required
                  </p>
                  <p style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                    Available serial numbers: {availableSerials.length}
                  </p>
                </div>

                <div className="serial-list">
                  {availableSerials.map((serial) => {
                    const isSelected = (selectedSerials[selectedProductForSerial.product_id] || []).includes(serial.serial_number);
                    return (
                      <div
                        key={serial.serial_number}
                        className={`serial-item ${isSelected ? 'selected' : ''} ${
                          !isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1) ? 'disabled' : ''
                        }`}
                        onClick={() => handleSerialSelection(serial.serial_number)}
                        style={{
                          cursor: !isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1) ? 'not-allowed' : 'pointer',
                          opacity: !isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1) ? 0.5 : 1
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="serial-checkbox"
                          disabled={!isSelected && (selectedSerials[selectedProductForSerial.product_id] || []).length >= (quantities[selectedProductForSerial.product_id] || 1)}
                        />
                        <span className="serial-number">{serial.serial_number}</span>
                        <span className={`serial-status ${serial.status}`}>{serial.status}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="modal-footer">
                <button onClick={handleCloseSerialModal} className="cancel-btn">
                  Cancel
                </button>
                <button onClick={handleConfirmSerialSelection} className="confirm-btn">
                  Confirm Selection
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SalesPage;