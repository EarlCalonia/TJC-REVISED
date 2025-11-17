import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/client/Navbar';
import Footer from '../../components/client/Footer';
import '../../styles/Products.css';
import { inventoryAPI } from '../../utils/api';

const currency = (n) => `₱ ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null); // State for the modal

  const search = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    inventoryAPI.getProductsWithInventory()
      .then((res) => {
        const list = res?.data?.products || res?.data || res || [];
        const normalized = list.map(p => ({
          id: p.id,
          product_id: p.product_id || p.productId,
          name: p.name,
          brand: p.brand,
          category: p.category,
          price: p.price,
          status: p.status,
          image: p.image,
          stock: p.stock ?? p.currentStock ?? 0,
          description: p.description,
          vehicle_compatibility: p.vehicle_compatibility
        }));
        
        const available = normalized.filter(p => p.status === 'Active');
        
        if (isMounted) setProducts(available);
      })
      .catch((e) => setError(e.message))
      .finally(() => isMounted && setLoading(false));
    return () => { isMounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const norm = (v) => String(v || '').trim().toLowerCase();
    const base = products.filter(p => !category || norm(p.category) === norm(category));
    if (!search) return base;
    const s = search.toLowerCase();
    return base.filter(p =>
      p.name?.toLowerCase().includes(s) ||
      p.brand?.toLowerCase().includes(s) ||
      p.category?.toLowerCase().includes(s) ||
      String(p.product_id || '').toLowerCase().includes(s)
    );
  }, [products, search, category]);

  const categories = useMemo(() => {
    const set = new Set();
    products.forEach(p => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const openModal = (product) => {
    setSelectedProduct(product);
    document.body.style.overflow = 'hidden'; // Disable scrolling background
  };

  const closeModal = () => {
    setSelectedProduct(null);
    document.body.style.overflow = 'auto'; // Re-enable scrolling
  };

  return (
    <div className="products-page">
      <Navbar />

      <main className="products-main">
        <div className="search-filter-container">
          <div className="search-box">
            <input 
              type="text" 
              placeholder="Search" 
              className="search-input"
              value={search}
              onChange={(e) => { const p = new URLSearchParams(searchParams); if (e.target.value) { p.set('q', e.target.value); } else { p.delete('q'); } setSearchParams(p); }}
            />
            <button className="search-button">
              <i className="fas fa-search"></i>
            </button>
          </div>
          
          <div className="category-buttons">
            {categories.map((c) => (
              <button key={c} className="category-btn" onClick={() => { const np = new URLSearchParams(searchParams); np.set('category', c); setSearchParams(np); }}>{c}</button>
            ))}
            <button className="category-btn" onClick={() => { const np = new URLSearchParams(searchParams); np.delete('category'); setSearchParams(np); }}>All Categories</button>
          </div>
        </div>

        <h2 style={{color: "#2c3e50"}}>All Products</h2>
        <div className="products-grid">
          {!loading && !error && filtered.map((p) => {
            const isOutOfStock = Number(p.stock) <= 0;
            
            return (
            <div key={p.product_id || p.id} className="product-card" style={{ opacity: isOutOfStock ? 0.8 : 1 }}>
                <div className="product-image-wrapper">
                  <div className="stock-badge" style={{ background: isOutOfStock ? '#dc3545' : '#10b981', zIndex: 10 }}>
                    {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                  </div>
                  
                  <img 
                      src={p.image ? (p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`) : 'https://placehold.co/400x300?text=No+Image'} 
                      alt={p.name} 
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://placehold.co/400x300?text=No+Image';
                      }}
                      className="product-image"
                      style={{ filter: isOutOfStock ? 'grayscale(100%)' : 'none' }}
                  />
                </div>
                <div className="product-info">
                    <span className="product-brand">{p.brand}</span>
                    <h3 className="product-title">{p.name}</h3>
                    <div className="product-price-section">
                    <span className="product-label">Price</span>
                    <span className="product-price">{currency(p.price)}</span>
                    </div>
                    
                    {/* BUTTON THAT OPENS MODAL */}
                    <button 
                      onClick={() => openModal(p)}
                      className="view-details-button"
                      type="button"
                    >
                      View Details <span className="arrow">›</span>
                    </button>

                </div>
            </div>
            );
          })}
        </div>
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="client-modal-overlay" onClick={closeModal}>
          <div className="client-modal-content" onClick={e => e.stopPropagation()}>
            <button className="client-modal-close" onClick={closeModal}>
              &times;
            </button>
            
            <div className="product-detail-layout">
              <div className="modal-image-section">
                 <img 
                    src={selectedProduct.image ? (selectedProduct.image.startsWith('http') ? selectedProduct.image : `http://localhost:5000${selectedProduct.image}`) : 'https://placehold.co/600x450?text=No+Image'} 
                    alt={selectedProduct.name} 
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://placehold.co/600x450?text=No+Image';
                    }}
                    className="modal-product-image"
                />
              </div>
              
              <div className="modal-info-section">
                <div className="modal-brand">{selectedProduct.brand}</div>
                <h2 className="modal-title">{selectedProduct.name}</h2>
                
                <div className="modal-badges">
                  <span className="modal-badge" style={{ background: '#f1f8e9', color: '#33691e' }}>
                    {selectedProduct.category}
                  </span>
                  {Number(selectedProduct.stock) > 0 ? (
                    <span className="modal-badge" style={{ background: '#e6fffa', color: '#047481' }}>
                      {selectedProduct.stock} In Stock
                    </span>
                  ) : (
                    <span className="modal-badge" style={{ background: '#fff5f5', color: '#c53030' }}>
                      Out of Stock
                    </span>
                  )}
                </div>

                <div className="modal-price">{currency(selectedProduct.price)}</div>
                
                <div className="modal-description">
                  {selectedProduct.description || 'No description available.'}
                </div>

                {selectedProduct.vehicle_compatibility && (
                  <div className="compatibility-box">
                    <div className="compatibility-title">
                      <span>🚗</span> Vehicle Compatibility
                    </div>
                    <div className="compatibility-list">
                      {selectedProduct.vehicle_compatibility}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
};

export default Products;