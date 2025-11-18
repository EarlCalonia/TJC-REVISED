import React, { useMemo, useState } from 'react';
import Navbar from '../../components/client/Navbar';
import Footer from '../../components/client/Footer';
import { salesAPI } from '../../utils/api';

const peso = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Badge = ({ children, color }) => (
  <span style={{
    display: 'inline-block',
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    background: color.bg,
    color: color.fg
  }}>{children}</span>
);

const statusColor = (s) => {
  const v = (s || '').toLowerCase();
  if (v.includes('pending')) return { bg: '#fff3cd', fg: '#856404' };
  if (v.includes('process')) return { bg: '#cce5ff', fg: '#004085' };
  if (v.includes('complete')) return { bg: '#d4edda', fg: '#155724' };
  if (v.includes('cancel')) return { bg: '#f8d7da', fg: '#721c24' };
  if (v.includes('delivery')) return { bg: '#fff3cd', fg: '#856404' };
  return { bg: '#e9ecef', fg: '#495057' };
};

const paymentColor = (s) => ((s || '').toLowerCase() === 'paid'
  ? { bg: '#d4edda', fg: '#155724' }
  : { bg: '#f8d7da', fg: '#721c24' });

const OrderStatus = () => {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null); // { header, items }

  const grandTotal = useMemo(() => {
    if (!order?.items) return 0;
    return order.items.reduce((sum, it) => sum + Number(it.subtotal || it.totalPrice || 0), 0);
  }, [order]);

  const handleSearch = async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    setError('');
    setOrder(null);
    try {
      // Try filter by sale_number on backend; use exact match only, no fallback
      const list = await salesAPI.getSales({ sale_number: orderId.trim() });
      const found = (list || []).find(s => (s.sale_number || '').toLowerCase() === orderId.trim().toLowerCase());
      
      if (!found) {
        setError('Order not found.');
        return;
      }
      
      // REMOVED: The block that checked for "Company Delivery" was deleted here.
      // Now it will proceed to show the order regardless of delivery_type.
      
      const items = await salesAPI.getSaleItems(found.id);
      const isCancelled = String(found.status || '').toLowerCase().includes('cancel');
      if (isCancelled) {
        setError('Order not found.');
        return;
      }
      setOrder({ header: found, items });
    } catch (e) {
      setError(e.message || 'Failed to fetch order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="order-status-page" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />

      <main style={{ maxWidth: 900, margin: '0 auto', padding: '30px 16px', flex: '1 0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <h1 style={{ margin: 0, color: '#0f2544', letterSpacing: 1 }}>CHECK ORDER STATUS</h1>
          <p style={{ color: '#5a6c7d' }}>Enter your Order ID to view current status and payment information</p>
        </div>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: 16, marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 12, color: '#334155', marginBottom: 6 }}>Order ID</label>
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
            placeholder="Enter your Order ID"
            style={{ width: '100%', height: 40, borderRadius: 6, border: '1px solid #cbd5e1', padding: '0 12px', outline: 'none' }}
          />
          <button onClick={handleSearch} disabled={loading} style={{
            marginTop: 12,
            width: '100%',
            height: 44,
            background: '#0b63c5',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontWeight: 700,
            cursor: 'pointer'
          }}>Check Status</button>
          {error && <div style={{ marginTop: 10, color: '#b91c1c', fontSize: 14 }}>{error}</div>}
        </div>

        {loading && <div className="card">Loading...</div>}

        {order?.header && (
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', padding: 16, position: 'relative' }}>
            <div style={{ textAlign: 'center', marginBottom: 6 }}>
              <h2 style={{ margin: 0, color: '#0f2544' }}>ORDER INFORMATION</h2>
              <div style={{ color: '#0b63c5' }}>Order ID: <strong>{order.header.sale_number}</strong></div>
            </div>

            <div style={{ display: 'grid', gap: 10, marginTop: 12, marginBottom: 16 }}>
              {(() => {
                const customerName = (order.header.customer_name || order.header.customerName || order.header.customer || order.header.name || '').trim();
                return customerName ? (
                  <div>
                    <div style={{ color: '#334155', fontSize: 14 }}>Customer Name:</div>
                    <Badge color={{ bg: '#e2e8f0', fg: '#0f172a' }}>{customerName}</Badge>
                  </div>
                ) : null;
              })()}
              <div>
                <div style={{ color: '#334155', fontSize: 14 }}>Order Status:</div>
                <Badge color={statusColor(order.header.status)}>{order.header.status}</Badge>
              </div>
              <div>
                <div style={{ color: '#334155', fontSize: 14 }}>Payment Status:</div>
                <Badge color={paymentColor(order.header.payment_status)}>{order.header.payment_status}</Badge>
              </div>
              <div>
                <div style={{ color: '#334155', fontSize: 14 }}>Shipping/Pickup:</div>
                {/* CHANGED: Display delivery_type instead of payment here to show In-Store vs Delivery */}
                <Badge color={{ bg: '#e2e8f0', fg: '#0f172a' }}>{order.header.delivery_type || order.header.payment}</Badge>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#0b63c5', color: '#fff' }}>
                    <th style={{ textAlign: 'left', padding: 10 }}>PRODUCT NAME</th>
                    <th style={{ textAlign: 'left', padding: 10 }}>BRAND</th>
                    <th style={{ textAlign: 'right', padding: 10 }}>QUANTITY</th>
                    <th style={{ textAlign: 'right', padding: 10 }}>UNIT PRICE</th>
                    <th style={{ textAlign: 'right', padding: 10 }}>TOTAL PRICE</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items || []).map((it, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 10 }}>{it.product_name || it.productName}</td>
                      <td style={{ padding: 10 }}>{it.brand}</td>
                      <td style={{ padding: 10, textAlign: 'right' }}>{it.quantity}</td>
                      <td style={{ padding: 10, textAlign: 'right' }}>{peso(it.price)}</td>
                      <td style={{ padding: 10, textAlign: 'right' }}>{peso(it.subtotal || (Number(it.price) * Number(it.quantity)))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'right', padding: 10, fontSize: 18, fontWeight: 800, color: '#0b63c5' }}>
              Grand Total: {peso(grandTotal)}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default OrderStatus;