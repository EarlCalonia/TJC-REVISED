import React, { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from '../../components/admin/Navbar';
import { BsSearch, BsEye, BsArrowReturnLeft, BsFileText, BsFileEarmarkText, BsFillExclamationTriangleFill, BsFillCheckCircleFill, BsPiggyBank } from 'react-icons/bs';
import '../../styles/OrdersPage.css'; 
import { salesAPI, returnsAPI } from '../../utils/api';
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

const OrderModal = ({ order, onClose, showMessage }) => {
  if (!order) return null;
  const total = Number(order.total || 0);
  const handlePrintReceipt = async () => {
    try {
      const doc = await generateSaleReceipt({ saleNumber: order.sale_number, customerName: order.customer_name, items: order.items, totalAmount: total, paymentMethod: order.payment, tenderedAmount: total, changeAmount: 0, address: order.address, shippingOption: order.delivery_type, createdAt: new Date(order.created_at) });
      doc.save(`${order.sale_number}_receipt.pdf`);
    } catch (e) { console.error('Failed to generate receipt:', e); showMessage('Error', 'Failed to generate receipt.', 'error'); }
  };
  return (
    <div className="modal-overlay" onClick={onClose}><div className="modal-content order-modal-content"><div className="modal-header"><h2>Order Details</h2><button onClick={onClose} className="close-btn">×</button></div><div className="modal-body"><div className="order-id-section"><h3>Order ID: {order.sale_number}</h3></div><div className="order-details-grid"><div className="customer-info-section"><h4>Customer Information</h4><div className="customer-details"><p><strong>Name:</strong> {order.customer_name}</p><p><strong>Contact:</strong> {order.contact || 'N/A'}</p><p><strong>Address:</strong> {order.address || 'N/A'}</p></div></div><div className="delivery-payment-section"><h4>Delivery & Payment</h4><div className="delivery-details"><p><strong>Delivery:</strong> {order.delivery_type || 'In-Store Pickup'}</p><p><strong>Payment:</strong> {order.payment || 'N/A'}</p><p><strong>Order Status:</strong> {order.status || 'N/A'}</p><p><strong>Payment Status:</strong> {order.payment_status || 'N/A'}</p></div></div></div><div className="items-display"><h4>Ordered Items</h4><div className="table-responsive"><table className="items-table"><thead><tr><th>Product Name</th><th>Brand</th><th>Serials</th><th>Quantity</th><th>Unit Price</th><th>Total</th></tr></thead><tbody>{order.items.map((item, index) => (<tr key={item.id || index}><td className="product-name-text">{item.product_name}</td><td>{item.brand}</td><td>{(item.serial_numbers && item.serial_numbers.length > 0) ? item.serial_numbers.join(', ') : 'N/A'}</td><td><span className="quantity-badge">{item.quantity}</span></td><td className="price-text">₱{Number(item.price || 0).toLocaleString()}</td><td className="price-text">₱{Number(item.subtotal || 0).toLocaleString()}</td></tr>))}<tr className="item-total-row"><td colSpan="5" className="total-label-cell"><strong>Total:</strong></td><td className="final-total"><strong>₱{Number(total).toLocaleString()}</strong></td></tr></tbody></table></div></div>{order.delivery_proof && (<div className="form-group" style={{ marginTop: '16px' }}><label>Proof of Delivery</label><div style={{ marginTop: '8px' }}><img src={`http://localhost:5000${order.delivery_proof}`} alt="Delivery Proof" style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid #ddd', display: 'block' }} /></div></div>)}</div><div className="modal-actions"><button onClick={handlePrintReceipt} className="btn btn-info"><BsFileText /> Print Receipt</button><button onClick={onClose} className="btn btn-secondary">Close</button></div></div></div>
  );
};

const OrdersPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderStatus, setSelectedOrderStatus] = useState('All Order Statuses');
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState('All Payment Statuses');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState({ total_sales: 0, pendingOrders: 0, paidOrders: 0, total_revenue: 0 });
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [orderToReturn, setOrderToReturn] = useState(null);
  const [returnItems, setReturnItems] = useState([]);
  const [returnReason, setReturnReason] = useState('');
  const [refundMethod, setRefundMethod] = useState('Cash');
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [photoProof, setPhotoProof] = useState(null);
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [isViewReturnsModalOpen, setIsViewReturnsModalOpen] = useState(false);
  const [returnsForOrder, setReturnsForOrder] = useState([]);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptData, setReceiptData] = useState(null);
  const printRef = useRef();

  // Message Box State
  const [msgBox, setMsgBox] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
  const showMessage = (title, message, type = 'info', onConfirm = null) => setMsgBox({ isOpen: true, title, message, type, onConfirm });
  const closeMessage = () => setMsgBox(prev => ({ ...prev, isOpen: false }));

  useEffect(() => { fetchOrdersWithItems(); fetchOrderStats(); }, []);

  const fetchOrdersWithItems = async () => {
    try {
      setLoading(true); setError(null);
      // Using getSales() defaults to 10 items which is fine for the table display
      const response = await salesAPI.getSales(); 
      const ordersWithItems = await Promise.all(response.map(async (order) => {
          try {
            const itemsResponse = await salesAPI.getSaleItems(order.id);
            const serialsResponse = await serialNumberAPI.getBySaleId(order.id);
            const allSerials = serialsResponse.data || [];
            const itemsWithSerials = itemsResponse.map(item => { const serial_numbers = allSerials.filter(s => s.sale_item_id === item.id).map(s => s.serial_number); return { ...item, serial_numbers }; });
            return { ...order, items: itemsWithSerials };
          } catch (itemError) { console.error(`Failed to fetch items for order ${order.id}:`, itemError); return { ...order, items: [] }; }
        }));
      setOrders(ordersWithItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
    } catch (err) { console.error('Error fetching orders:', err); setError(err.message || 'Failed to load orders'); } finally { setLoading(false); }
  };

  // UPDATED: Use backend pre-calculated stats
  const fetchOrderStats = async () => {
    try {
      const response = await salesAPI.getSalesStats();
      if (response.success) {
        setStats({ 
            total_sales: response.data.total_sales, 
            pendingOrders: response.data.pending_orders, 
            paidOrders: response.data.paid_orders, 
            total_revenue: response.data.total_revenue 
        });
      }
    } catch (error) { console.error('Error fetching order stats:', error); }
  };

  const orderStatuses = ['All Order Statuses', 'Pending', 'Processing', 'Completed', 'Cancelled', 'Returned', 'Partially Returned'];
  const paymentStatuses = ['All Payment Statuses', 'Paid', 'Unpaid', 'Refunded', 'Partially Refunded'];
  const filteredOrders = useMemo(() => {
    return orders.filter(order => {
      const matchesSearch = order.sale_number.toLowerCase().includes(searchQuery.toLowerCase()) || order.customer_name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesOrderStatus = selectedOrderStatus === 'All Order Statuses' || order.status === selectedOrderStatus;
      const matchesPaymentStatus = selectedPaymentStatus === 'All Payment Statuses' || (order.payment_status || 'Unpaid') === selectedPaymentStatus;
      return matchesSearch && matchesOrderStatus && matchesPaymentStatus;
    });
  }, [orders, searchQuery, selectedOrderStatus, selectedPaymentStatus]);

  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);
  const totalFilteredOrders = filteredOrders.length;
  const handlePageChange = (page) => { setCurrentPage(page); };
  const handleViewOrder = (order) => { setSelectedOrder(order); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setSelectedOrder(null); };

  const handleOpenReturnModal = (order) => {
    const items = order.items || [];
    const initReturnItems = items.map(item => ({ saleItemId: item.id, productId: item.product_id, productName: item.product_name, sku: item.sku || '', price: parseFloat(item.price || 0), orderedQuantity: parseInt(item.quantity || 0) - parseInt(item.returned_quantity || 0), soldSerials: item.serial_numbers || [], selectedSerials: [], returnQuantity: 0, selected: false })).filter(item => item.orderedQuantity > 0);
    setOrderToReturn(order); setReturnItems(initReturnItems); setReturnReason(''); setRefundMethod('Cash'); setPhotoProof(null); setAdditionalNotes(''); setIsReturnModalOpen(true);
  };

  const handleCloseReturnModal = () => { setIsReturnModalOpen(false); setOrderToReturn(null); };
  const handleReturnItemToggle = (index) => { setReturnItems(prev => prev.map((item, i) => { if (i !== index) return item; const newSelected = !item.selected; return { ...item, selected: newSelected, selectedSerials: [], returnQuantity: newSelected && item.soldSerials.length === 0 ? item.orderedQuantity : 0 }; })); };
  const handleReturnQuantityChange = (index, value) => { const qty = parseInt(value) || 0; setReturnItems(prev => prev.map((item, i) => { if (i !== index) return item; if (item.soldSerials.length > 0) return item; return { ...item, returnQuantity: Math.min(Math.max(0, qty), item.orderedQuantity) }; })); };
  const handleSerialToggle = (itemIndex, serial) => { setReturnItems(prev => prev.map((item, i) => { if (i !== itemIndex) return item; const isAlreadySelected = item.selectedSerials.includes(serial); let newSelectedSerials; if (isAlreadySelected) { newSelectedSerials = item.selectedSerials.filter(s => s !== serial); } else { newSelectedSerials = [...item.selectedSerials, serial]; } return { ...item, selectedSerials: newSelectedSerials, returnQuantity: newSelectedSerials.length, selected: newSelectedSerials.length > 0 }; })); };
  const calculateRefundAmount = () => { return returnItems.filter(item => item.selected && item.returnQuantity > 0).reduce((total, item) => total + (item.price * item.returnQuantity), 0); };

  const handleSubmitReturn = async (e) => {
    e.preventDefault(); if (isSubmittingReturn) return;
    const itemsToReturn = returnItems.filter(item => item.selected && item.returnQuantity > 0);
    if (itemsToReturn.length === 0) { showMessage('Selection Required', 'Please select at least one item to return.', 'warning'); return; }
    if (!returnReason) { showMessage('Reason Required', 'Please provide a reason for the return.', 'warning'); return; }
    if (!photoProof) { showMessage('Proof Required', 'Please upload a photo proof for the return.', 'warning'); return; }
    try {
      setIsSubmittingReturn(true);
      const formData = new FormData();
      formData.append('orderId', orderToReturn.id); formData.append('saleNumber', orderToReturn.sale_number); formData.append('customerName', orderToReturn.customer_name); formData.append('returnReason', returnReason); formData.append('refundMethod', refundMethod); formData.append('restocked', true); formData.append('additionalNotes', additionalNotes); formData.append('processedBy', localStorage.getItem('username') || 'Admin'); formData.append('photoProof', photoProof);
      const returnItemsPayload = itemsToReturn.map(item => ({ saleItemId: item.saleItemId, productId: item.productId, productName: item.productName, sku: item.sku, quantity: item.returnQuantity, price: item.price, serialNumbers: item.selectedSerials }));
      formData.append('returnItems', JSON.stringify(returnItemsPayload));
      const response = await returnsAPI.processReturn(formData);
      if (response.success) {
        showMessage('Success', 'Return processed successfully!', 'success');
        const receiptPayload = { ...response.data, saleNumber: orderToReturn.sale_number, customerName: orderToReturn.customer_name, returnReason: returnReason, refundMethod: refundMethod, processedBy: localStorage.getItem('username') || 'Admin', returnItems: returnItemsPayload, refundAmount: calculateRefundAmount() };
        setReceiptData(receiptPayload); setIsReceiptModalOpen(true); handleCloseReturnModal(); await fetchOrdersWithItems(); await fetchOrderStats();
      } else { throw new Error(response.message || 'Failed to process return.'); }
    } catch (error) { console.error('Error processing return:', error); showMessage('Error', 'Error: ' + error.message, 'error'); } finally { setIsSubmittingReturn(false); }
  };

  const handleOpenViewReturnsModal = async (order) => {
    try {
      setLoading(true);
      const response = await returnsAPI.getReturnsByOrder(order.id);
      if (response.success) { setReturnsForOrder(response.data || []); setIsViewReturnsModalOpen(true); } else { throw new Error(response.message || 'Failed to fetch returns.'); }
    } catch (error) { console.error('Error fetching returns:', error); showMessage('Error', 'Error: ' + error.message, 'error'); } finally { setLoading(false); }
  };
  const handleCloseViewReturnsModal = () => { setIsViewReturnsModalOpen(false); setReturnsForOrder([]); };

  return (
    <>
      <div className="admin-layout">
        <Navbar />
        <main className="admin-main">
          <div className="admin-container orders-page-content">
            <div className="page-header"><h1 className="page-title">Transaction History</h1><p className="page-subtitle">Review, filter, and process returns for all transactions.</p></div>
            {error && (<div className="error-state"><p>{error}</p><button onClick={fetchOrdersWithItems} className="btn btn-danger">Retry</button></div>)}
            <div className="card">
              <div className="orders-controls">
                <div className="search-filter-section">
                  <div className="search-box"><input type="text" placeholder="Search orders..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="search-input" /><button className="search-btn" type="button"><BsSearch /></button></div>
                  <select value={selectedOrderStatus} onChange={(e) => setSelectedOrderStatus(e.target.value)} className="filter-dropdown">{orderStatuses.map(status => (<option key={status} value={status}>{status}</option>))}</select>
                  <select value={selectedPaymentStatus} onChange={(e) => setSelectedPaymentStatus(e.target.value)} className="filter-dropdown">{paymentStatuses.map(status => (<option key={status} value={status}>{status}</option>))}</select>
                </div>
              </div>
            </div>
            <div className="dashboard-stats">
              <div className="stat-card sales"><div className="stat-info-flex"><div><h3 className="stat-title">Total Transactions</h3><p className="stat-value sales">{stats.total_sales}</p></div><div className="stat-icon sales"><BsFileEarmarkText /></div></div></div>
              <div className="stat-card low-stock"><div className="stat-info-flex"><div><h3 className="stat-title">Pending Orders</h3><p className="stat-value low-stock">{stats.pendingOrders}</p></div><div className="stat-icon low-stock"><BsFillExclamationTriangleFill /></div></div></div>
              <div className="stat-card revenue"><div className="stat-info-flex"><div><h3 className="stat-title">Paid Orders</h3><p className="stat-value revenue">{stats.paidOrders}</p></div><div className="stat-icon in-stock"><BsFillCheckCircleFill /></div></div></div>
              <div className="stat-card inventory"><div className="stat-info-flex"><div><h3 className="stat-title">Total Revenue</h3><p className="stat-value inventory">₱{Number(stats.total_revenue).toLocaleString()}</p></div><div className="stat-icon inventory"><BsPiggyBank /></div></div></div>
            </div>
            <div className="table-section">
              <div className="table-container">
                {loading ? (<div className="loading-state"><p>Loading transactions...</p></div>) : (
                  <table className="table">
                    <thead><tr><th>Order ID</th><th>Customer Name</th><th>Order Date</th><th>Items</th><th>Payment Method</th><th>Payment Status</th><th>Order Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {currentOrders.length === 0 ? (<tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No transactions found matching your criteria.</td></tr>) : (
                        currentOrders.map(order => (
                          <tr key={order.id}>
                            <td className="order-id-cell">{order.sale_number}</td><td>{order.customer_name}</td><td>{new Date(order.created_at).toLocaleDateString()}</td><td className="product-list"><div className="product-names">{order.items.map(item => item.product_name).join(', ')}</div></td>
                            <td><span className={`payment-status-badge ${order.payment?.toLowerCase().replace(/\s+/g, '-')}`}>{order.payment}</span></td>
                            <td><span className={`payment-status-badge ${order.payment_status?.toLowerCase().replace(/\s+/g, '-')}`}>{order.payment_status}</span></td>
                            <td><span className={`order-status-badge ${order.status?.toLowerCase().replace(/\s+/g, '-')}`}>{order.status}</span></td>
                            <td><div className="action-buttons"><button onClick={() => handleViewOrder(order)} className="view-btn" title="View Order Details"><BsEye /></button>{['Returned', 'Partially Returned'].includes(order.status) && (<button onClick={() => handleOpenViewReturnsModal(order)} className="view-returns-btn" title="View Returns"><BsFileText /></button>)}{['Completed', 'Partially Returned'].includes(order.status) && (<button onClick={() => handleOpenReturnModal(order)} className="return-btn" title="Process Return"><BsArrowReturnLeft /></button>)}</div></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="table-footer"><div className="results-info">Showing {totalFilteredOrders > 0 ? startIndex + 1 : 0} to {Math.min(endIndex, totalFilteredOrders)} of {totalFilteredOrders} transactions</div>{totalPages > 1 && (<div className="pagination"><button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="pagination-btn">Previous</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (<button key={page} onClick={() => handlePageChange(page)} className={`pagination-btn ${currentPage === page ? 'active' : ''}`}>{page}</button>))}<button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="pagination-btn">Next</button></div>)}</div>
            </div>
          </div>
        </main>
      </div>
      {isModalOpen && <OrderModal order={selectedOrder} onClose={handleCloseModal} showMessage={showMessage} />}
      {isReturnModalOpen && orderToReturn && (
        <div className="modal-overlay" onClick={handleCloseReturnModal}>
          <div className="modal-content" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Process Return for Order: {orderToReturn.sale_number}</h2><button onClick={handleCloseReturnModal} className="close-btn">×</button></div>
            <form onSubmit={handleSubmitReturn} className="modal-body return-modal-body">
              <div className="return-header-info"><div className="info-row"><div className="info-item"><span className="info-label">Customer</span><span className="info-value">{orderToReturn.customer_name}</span></div><div className="info-item"><span className="info-label">Order Date</span><span className="info-value">{new Date(orderToReturn.created_at).toLocaleDateString()}</span></div></div></div>
              <div className="return-items-section">
                <h4>Select items to return:</h4>
                <div className="table-container">
                  <table className="return-items-table">
                    <thead><tr><th>Return?</th><th>Product Name</th><th>Available Qty</th><th>Return Qty</th><th>Price</th></tr></thead>
                    <tbody>
                      {returnItems.map((item, index) => (
                        <React.Fragment key={index}>
                          <tr className={item.selected ? 'selected-row' : ''}>
                            <td style={{ textAlign: 'center' }}><input type="checkbox" checked={item.selected} disabled={item.soldSerials && item.soldSerials.length > 0} onChange={() => handleReturnItemToggle(index)} style={{ transform: 'scale(1.2)' }} /></td>
                            <td>{item.productName}{item.soldSerials && item.soldSerials.length > 0 && (<div className="serial-selection-container" style={{ marginTop: '8px', padding: '8px', backgroundColor: '#f8f9fa', border: '1px solid #dee2e6', borderRadius: '4px' }}><p style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '4px', color: '#495057' }}>Select Serials to Return:</p><div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{item.soldSerials.map(serial => (<label key={serial} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}><input type="checkbox" checked={item.selectedSerials.includes(serial)} onChange={() => handleSerialToggle(index, serial)} /><span style={{fontFamily: 'monospace'}}>{serial}</span></label>))}</div></div>)}</td>
                            <td>{item.orderedQuantity}</td>
                            <td><input type="number" min="0" max={item.orderedQuantity} value={item.returnQuantity} onChange={(e) => handleReturnQuantityChange(index, e.target.value)} disabled={!item.selected || (item.soldSerials && item.soldSerials.length > 0)} className="form-input" style={{ width: '80px', padding: '6px', height: 'auto' }} /></td>
                            <td>₱{Number(item.price).toLocaleString()}</td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="return-details-section">
                <div className="form-group"><label>Reason for Return <span style={{color: 'red'}}>*</span></label><select value={returnReason} onChange={(e) => setReturnReason(e.target.value)} className="form-input" required><option value="">Select a reason</option><option value="Defective/Damaged">Defective/Damaged</option><option value="Wrong Item">Wrong Item</option><option value="Not as Described">Not as Described</option><option value="Customer Changed Mind">Customer Changed Mind</option><option value="Compatibility Issue">Compatibility Issue</option><option value="Other">Other</option></select></div>
                <div className="form-group"><label>Refund Method <span style={{color: 'red'}}>*</span></label><div className="refund-method-radios"><label><input type="radio" value="Cash" checked={refundMethod === 'Cash'} onChange={(e) => setRefundMethod(e.target.value)} /> Cash</label><label><input type="radio" value="GCash" checked={refundMethod === 'GCash'} onChange={(e) => setRefundMethod(e.target.value)} /> GCash</label></div></div>
                <div className="form-group"><label>Photo Proof <span style={{color: 'red'}}>*</span></label><input type="file" accept="image/*" onChange={(e) => setPhotoProof(e.target.files[0])} className="form-input" required /></div>
                <div className="form-group"><label>Additional Notes</label><textarea value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} className="form-textarea" rows="2" placeholder="Optional notes..." /></div>
              </div>
              <div className="refund-summary"><div className="summary-row"><span className="summary-label">Total Refund:</span><span className="summary-value">₱{calculateRefundAmount().toLocaleString()}</span></div></div>
              <div className="modal-actions"><button type="button" onClick={handleCloseReturnModal} className="cancel-btn">Cancel</button><button type="submit" className="confirm-btn" disabled={isSubmittingReturn} style={{backgroundColor: 'var(--color-danger)'}}>{isSubmittingReturn ? 'Processing...' : 'Confirm Return'}</button></div>
            </form>
          </div>
        </div>
      )}
      {isViewReturnsModalOpen && (
        <div className="modal-overlay" onClick={handleCloseViewReturnsModal}>
          <div className="modal-content" style={{ maxWidth: '900px' }}>
            <div className="modal-header"><h2>Return History for Order</h2><button onClick={handleCloseViewReturnsModal} className="close-btn">×</button></div>
            <div className="modal-body">
              {returnsForOrder.length === 0 ? (<p>No return history found for this order.</p>) : (
                <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Return ID</th><th>Return Date</th><th>Items</th><th>Reason</th><th>Refund Method</th><th>Amount</th></tr></thead>
                    <tbody>
                      {returnsForOrder.map(ret => (
                        <tr key={ret.id}><td>{ret.return_id}</td><td>{new Date(ret.return_date).toLocaleDateString()}</td><td>{ret.items.map(item => (<div key={item.id}>{item.product_name} (x{item.quantity})</div>))}</td><td>{ret.return_reason}</td><td>{ret.refund_method}</td><td className="price-cell">₱{Number(ret.refund_amount).toLocaleString()}</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-actions"><button type="button" onClick={handleCloseViewReturnsModal} className="btn btn-secondary">Close</button></div>
          </div>
        </div>
      )}
      {isReceiptModalOpen && receiptData && (
        <div className="modal-overlay refund-receipt-modal" onClick={() => setIsReceiptModalOpen(false)}>
          <div className="modal-content" style={{ maxWidth: '400px', maxHeight: 'none' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h2>Return Receipt</h2><button onClick={() => setIsReceiptModalOpen(false)} className="close-btn">×</button></div>
            <div className="modal-body" ref={printRef}>
              <div className="receipt-content">
                <div className="receipt-header" style={{ textAlign: 'center', marginBottom: '20px' }}><h3 style={{ margin: '0', fontSize: '1.2rem', fontWeight: '700' }}>TJC Auto-Electrical</h3><p style={{ margin: '0', fontSize: '0.8rem' }}>Manila, Philippines</p><h4 style={{ margin: '10px 0 5px 0', borderTop: '1px dashed #333', borderBottom: '1px dashed #333', padding: '5px 0' }}>RETURN RECEIPT</h4></div>
                <div className="receipt-info" style={{ fontSize: '0.8rem', marginBottom: '15px' }}><div><strong>Return ID:</strong> {receiptData.returnId}</div><div><strong>Date:</strong> {new Date().toLocaleString()}</div><div><strong>Original Order:</strong> {receiptData.saleNumber}</div><div><strong>Customer:</strong> {receiptData.customerName}</div><div><strong>Processed By:</strong> {receiptData.processedBy}</div><div><strong>Reason:</strong> {receiptData.returnReason}</div><div><strong>Refund:</strong> {receiptData.refundMethod}</div></div>
                <div className="receipt-details" style={{ fontSize: '0.8rem', borderTop: '1px solid #333', paddingTop: '10px' }}><div style={{ fontWeight: '700', marginBottom: '5px' }}><span style={{ float: 'left', width: '50%' }}>ITEM</span><span style={{ float: 'right', width: '20%', textAlign: 'right' }}>TOTAL</span><span style={{ float: 'right', width: '15%', textAlign: 'center' }}>QTY</span></div>{receiptData.returnItems.map((item, idx) => (<div key={idx} style={{ clear: 'both', overflow: 'hidden', marginBottom: '5px' }}><span style={{ float: 'left', width: '100%' }}>{item.productName}</span><span style={{ float: 'right', width: '20%', textAlign: 'right' }}>₱{Number(item.price * item.quantity).toLocaleString()}</span><span style={{ float: 'right', width: '15%', textAlign: 'center' }}>{item.quantity}</span>{item.serialNumbers && item.serialNumbers.length > 0 && (<div style={{ clear: 'both', fontSize: '0.7rem', marginLeft: '10px', color: '#555' }}>SN: {item.serialNumbers.join(', ')}</div>)}</div>))}</div>
                <div className="receipt-footer" style={{ fontSize: '0.9rem', fontWeight: '700', borderTop: '1px solid #333', marginTop: '15px', paddingTop: '10px' }}><div><span style={{ float: 'left', width: '50%' }}>TOTAL REFUND</span><span style={{ float: 'right', width: '50%', textAlign: 'right' }}>₱{Number(receiptData.refundAmount).toLocaleString()}</span></div></div><p className="receipt-title" style={{ marginTop: '20px', fontSize: '0.75rem' }}>*** THANK YOU ***</p>
              </div>
            </div>
            <div className="modal-actions"><button type="button" onClick={() => setIsReceiptModalOpen(false)} className="cancel-btn">Close</button><button type="button" onClick={() => window.print()} className="confirm-btn">Print</button></div>
          </div>
        </div>
      )}
      <MessageBox isOpen={msgBox.isOpen} title={msgBox.title} message={msgBox.message} type={msgBox.type} onClose={closeMessage} onConfirm={msgBox.onConfirm} />
    </>
  );
};
export default OrdersPage;