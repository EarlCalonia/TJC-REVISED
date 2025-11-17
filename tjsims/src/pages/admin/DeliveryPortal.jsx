import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BsSearch } from 'react-icons/bs';
import '../../styles/DeliveryPortal.css';
import tcjLogo from '../../assets/tcj_logo.png';
import { salesAPI } from '../../utils/api';
import { serialNumberAPI } from '../../utils/serialNumberApi';

const DeliveryPortal = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const ordersPerPage = 10;

  const riderName = localStorage.getItem('username') || localStorage.getItem('userEmail') || 'Rider';
  const riderAvatar = localStorage.getItem('avatar');

  // --- START FETCH ORDERS FUNCTION ---
  const fetchOrders = async () => {
    try {
      // 1. Fetch sales that have 'Company Delivery' type
      const list = await salesAPI.getSales({ 
        delivery_type: 'Company Delivery' 
      });
      
      // 2. Filter to keep only active delivery statuses
      // FIX: Added 'Out for Delivery' to the allowed list
      const activeDeliveryList = (list || []).filter(s => 
        s.status === 'Pending' || s.status === 'Processing' || s.status === 'Out for Delivery'
      );

      const filtered = activeDeliveryList;

      // 3. Fetch items/serials and map
      const mappedPromises = filtered.map(async (s) => {
        let productListString = 'See details';
        let items = [];
        try {
          const itemsResponse = await salesAPI.getSaleItems(s.id);
          const serialsResponse = await serialNumberAPI.getBySaleId(s.id);
          const allSerials = serialsResponse.data || [];

          items = itemsResponse.map(item => {
            const serial_numbers = allSerials
                .filter(sn => sn.sale_item_id === item.id)
                .map(sn => sn.serial_number);
            
            return { ...item, serial_numbers };
          });
          
          productListString = (items || []).map(item => {
            return `${item.product_name} (x${item.quantity})`;
          }).join(', ');

        } catch (e) {
          console.error(`Failed to fetch details for sale ${s.id}:`, e);
        }

        return {
          id: s.sale_number,
          saleId: s.id,
          customerName: s.customer_name,
          orderDate: new Date(s.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }),
          productList: productListString, 
          items: items, 
          paymentStatus: s.payment_status,
          paymentMethod: s.payment,
          // FIX: Use the real status from the database directly
          orderStatus: s.status,
          address: s.address || '',
          contact: s.contact || '',
          deliveryProof: s.delivery_proof || null
        };
      });

      const mapped = await Promise.all(mappedPromises);

      return mapped;

    } catch (e) {
      setError(e.message);
      return [];
    }
  }
  // --- END FETCH ORDERS FUNCTION ---

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchOrders().then(mapped => {
      if (mounted) setOrders(mapped);
    }).finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userName');
    localStorage.removeItem('userAvatar');
    navigate('/admin/login');
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
    setIsViewModalOpen(true);
  };

  const handleCompleteDelivery = (order) => {
    setSelectedOrder(order);
    setDeliveryProof(null);
    setIsCompleteModalOpen(true);
  };

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [deliveryProof, setDeliveryProof] = useState(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  const handlePaymentStatusChange = async (orderId, newPaymentStatus) => {
    const target = orders.find(o => o.id === orderId);
    if (!target) return;

    try {
      await salesAPI.updateSale(target.saleId, { payment_status: newPaymentStatus });
      
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, paymentStatus: newPaymentStatus } : o));
      
      if (newPaymentStatus === 'Paid' && target.paymentMethod === 'Cash on Delivery') {
          alert('Payment status updated to Paid. You can now complete the delivery.');
      }
    } catch (e) {
      alert(`Failed to update payment status: ${e.message}`);
    }
  };

  const handleOrderStatusChange = async (orderId, newStatus) => {
    const target = orders.find(o => o.id === orderId);
    if (!target) return;

    // FIX: Removed the mapping logic. We send the status exactly as selected.
    try {
      await salesAPI.updateSale(target.saleId, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, orderStatus: newStatus } : o));
    } catch (e) {
      alert(`Failed to update status: ${e.message}`);
    }
  };

  const handleSubmitCompleteDelivery = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;

    if (!deliveryProof) {
      alert('Please upload a delivery proof photo before completing the delivery');
      return;
    }

    try {
      setUploadingProof(true);
      
      // Upload delivery proof
      await salesAPI.uploadDeliveryProof(selectedOrder.saleId, deliveryProof);
      
      // Update status to Completed
      await salesAPI.updateSale(selectedOrder.saleId, { status: 'Completed' });
      
      // Refresh orders
      const mapped = await fetchOrders();
      setOrders(mapped);
      
      setDeliveryProof(null);
      setIsCompleteModalOpen(false);
      alert('Delivery completed successfully!');
    } catch (e) {
      alert(`Failed to complete delivery: ${e.message}`);
    } finally {
      setUploadingProof(false);
    }
  };

  const handleProofFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }
      setDeliveryProof(file);
    }
  };

  const filteredOrders = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return orders.filter(order =>
      order.id.toLowerCase().includes(s) ||
      (order.customerName || '').toLowerCase().includes(s) ||
      (order.productList || '').toLowerCase().includes(s)
    );
  }, [orders, searchTerm]);

  const indexOfLastOrder = currentPage * ordersPerPage;
  const indexOfFirstOrder = indexOfLastOrder - ordersPerPage;
  const currentOrders = filteredOrders.slice(indexOfFirstOrder, indexOfLastOrder);
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage) || 1;

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);

  const getPaymentStatusClass = (status) => status === 'Paid' ? 'status-paid' : 'status-unpaid';
  const getOrderStatusClass = (status) => {
    if (status === 'Completed') return 'status-completed';
    // FIX: Add class for "Out for Delivery"
    if (status === 'Out for Delivery') return 'status-delivery'; 
    return 'status-processing';
  };

  return (
    <div className="delivery-portal">
      <nav className="delivery-navbar">
        <div className="navbar-left">
          <img src={tcjLogo} alt="TJC Logo" className="navbar-logo" />
          <span className="navbar-divider">|</span>
          <span className="navbar-title">Delivery Portal</span>
        </div>
        <div className="navbar-right">
          <div className="rider-profile">
            {riderAvatar ? (
              <img 
                src={riderAvatar.startsWith('http') ? riderAvatar : `http://localhost:5000${riderAvatar}`} 
                alt="Rider" 
                className="profile-avatar" 
                style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid #2478bd' }} 
              />
            ) : (
              <div className="profile-icon">
                <i className="fas fa-user-circle"></i>
              </div>
            )}
            <span className="rider-name">{riderName}</span>
          </div>
          <span className="navbar-divider">|</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </nav>

      <div className="delivery-container">
        <div className="delivery-header">
          <h1 className="delivery-title">My Delivery Orders</h1>
          <p className="delivery-subtitle">Orders assigned for delivery today. Update status as you complete deliveries.</p>
        </div>

        <div className="search-section">
          <div className="delivery-search-box">
            <input type="text" placeholder="Search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="delivery-search-input" />
            <button className="delivery-search-btn" type="button">
              <BsSearch className="delivery-search-icon" />
            </button>
          </div>
        </div>

        <div className="delivery-table-section">
          <table className="delivery-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer Name</th>
                <th>Product List</th>
                <th>Payment Status</th>
                <th>Order Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="6" style={{ padding: 20 }}>Loading...</td></tr>
              )}
              {error && !loading && (
                <tr><td colSpan="6" style={{ padding: 20 }}>{error}</td></tr>
              )}
              {!loading && !error && currentOrders.map((order) => (
                <tr key={order.id}>
                  <td className="order-id">{order.id}</td>
                  <td>{order.customerName}</td>
                  <td className="product-list">{order.productList}</td>
                  <td>
                    {order.paymentStatus === 'Unpaid' ? (
                      <select
                        value={order.paymentStatus}
                        onChange={(e) => handlePaymentStatusChange(order.id, e.target.value)}
                        className={`status-edit-select status-${order.paymentStatus.toLowerCase()}`}
                      >
                        <option value="Unpaid">Unpaid (COD)</option>
                        <option value="Paid">Paid (COD)</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${getPaymentStatusClass(order.paymentStatus)}`}>
                        {`${order.paymentStatus} (${order.paymentMethod})`}
                      </span>
                    )}
                  </td>
                  <td>
                    {order.orderStatus !== 'Completed' ? (
                      <select
                        value={order.orderStatus}
                        onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
                        className={`status-edit-select status-${order.orderStatus.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {/* FIX: Updated options to match database values */}
                        <option value="Pending">Pending</option>
                        <option value="Processing">Processing</option>
                        <option value="Out for Delivery">Out for Delivery</option>
                      </select>
                    ) : (
                      <span className={`status-badge ${getOrderStatusClass(order.orderStatus)}`}>
                        {order.orderStatus}
                      </span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button className="view-btn" onClick={() => handleViewOrder(order)} title="View Details">
                        <i className="fas fa-eye"></i> <span>View</span>
                      </button>
                      {order.orderStatus !== 'Completed' && (
                        <button 
                          className="complete-delivery-btn" 
                          onClick={() => handleCompleteDelivery(order)} 
                          title="Complete Delivery"
                          disabled={order.paymentStatus !== 'Paid'} 
                          style={{ 
                            backgroundColor: '#28a745', 
                            color: 'white', 
                            border: 'none', 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px'
                          }}
                        >
                          <i className="fas fa-check-circle"></i> <span>Complete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <div className="showing-info">
            Showing {indexOfFirstOrder + 1} - {Math.min(indexOfLastOrder, filteredOrders.length)} of {filteredOrders.length} orders
          </div>
          <div className="pagination">
            <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="pagination-btn">Previous</button>
            {[...Array(totalPages)].map((_, index) => (
              <button key={index + 1} onClick={() => handlePageChange(index + 1)} className={`pagination-btn ${currentPage === index + 1 ? 'active' : ''}`}>{index + 1}</button>
            ))}
            <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="pagination-btn">Next</button>
          </div>
        </div>
      </div>

      {/* View Modal */}
      {isViewModalOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setIsViewModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order Details - {selectedOrder.id}</h2>
              <button className="close-btn" onClick={() => setIsViewModalOpen(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row"><span className="detail-label">Customer Name:</span><span className="detail-value">{selectedOrder.customerName}</span></div>
              <div className="detail-row"><span className="detail-label">Contact Number:</span><span className="detail-value">{selectedOrder.contact}</span></div>
              <div className="detail-row"><span className="detail-label">Delivery Address:</span><span className="detail-value">{selectedOrder.address}</span></div>
              <div className="detail-row"><span className="detail-label">Order Date:</span><span className="detail-value">{selectedOrder.orderDate}</span></div>

              {/* Products Table */}
              <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <span className="detail-label" style={{ marginBottom: '8px' }}>Products:</span>
                <div style={{ width: '100%', overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ background: '#f8f9fa' }}>
                        <th style={{ textAlign: 'left', padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Product</th>
                        <th style={{ textAlign: 'left', padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Serial Numbers</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Qty</th>
                        <th style={{ textAlign: 'right', padding: '8px 4px', borderBottom: '1px solid #ddd' }}>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.length > 0 ? (
                        selectedOrder.items.map((item, index) => (
                          <tr key={index} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '8px 4px', textAlign: 'left' }}>
                              {item.product_name || item.name}
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'left', wordBreak: 'break-word', maxWidth: '200px' }}>
                              {(item.serial_numbers?.length > 0) 
                                ? item.serial_numbers.join(', ') 
                                : 'N/A'}
                            </td>
                            <td style={{ padding: '8px 4px', textAlign: 'right' }}>{item.quantity}</td>
                            <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                              ₱{(Number(item.price) * Number(item.quantity)).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="4" style={{ textAlign: 'center', padding: '10px' }}>No items found for this order.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="detail-row">
                <span className="detail-label">Payment Status:</span>
                <span className={`status-badge ${getPaymentStatusClass(selectedOrder.paymentStatus)}`}>
                  {selectedOrder.paymentStatus === 'Paid' ? `Paid (${selectedOrder.paymentMethod})` : `Unpaid (${selectedOrder.paymentMethod})`}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Order Status:</span>
                <span className={`status-badge ${getOrderStatusClass(selectedOrder.orderStatus)}`}>{selectedOrder.orderStatus}</span>
              </div>
              {selectedOrder.orderStatus === 'Completed' && selectedOrder.deliveryProof && (
                <div className="detail-row" style={{ marginTop: '20px', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="detail-label" style={{ marginBottom: '8px' }}>Proof of Delivery:</span>
                  <img 
                    src={`http://localhost:5000${selectedOrder.deliveryProof}`} 
                    alt="Delivery Proof" 
                    style={{ maxWidth: '100%', maxHeight: '400px', borderRadius: '8px', border: '1px solid #ddd' }}
                  />
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="close-modal-btn" onClick={() => setIsViewModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Delivery Modal */}
      {isCompleteModalOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setIsCompleteModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Complete Delivery - {selectedOrder.id}</h2>
              <button className="close-btn" onClick={() => setIsCompleteModalOpen(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleSubmitCompleteDelivery}>
              <div className="modal-body">
                <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                  <span className="detail-label" style={{ marginBottom: '8px' }}>Upload Proof of Delivery *</span>
                  <p style={{ fontSize: '14px', color: '#666', marginBottom: '12px' }}>Please upload an image showing proof of delivery before completing.</p>
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={handleProofFileChange}
                    style={{ padding: '8px', border: '1px solid #ddd', borderRadius: '4px', width: '100%' }}
                    required
                  />
                  {deliveryProof && (
                    <span style={{ marginTop: '8px', color: '#28a745', fontSize: '14px' }}>
                      ✓ {deliveryProof.name} selected
                    </span>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  type="button" 
                  className="cancel-btn" 
                  onClick={() => setIsCompleteModalOpen(false)}
                  style={{ padding: '10px 20px', borderRadius: '4px', border: '1px solid #ddd', backgroundColor: '#fff', cursor: 'pointer' }}
                >
                  Back
                </button>
                <button 
                  type="submit" 
                  className="confirm-btn" 
                  disabled={uploadingProof}
                  style={{ 
                    padding: '10px 20px', 
                    borderRadius: '4px', 
                    border: 'none', 
                    backgroundColor: '#28a745', 
                    color: 'white', 
                    cursor: uploadingProof ? 'not-allowed' : 'pointer',
                    opacity: uploadingProof ? 0.6 : 1
                  }}
                >
                  {uploadingProof ? 'Completing...' : 'Complete Delivery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryPortal;