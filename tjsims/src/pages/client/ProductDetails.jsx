import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../../components/client/Navbar';
import Footer from '../../components/client/Footer';
import '../../styles/Products.css';
import { inventoryAPI } from '../../utils/api';

const currency = (n) => `₱ ${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const search = searchParams.get('q') || '';
  const category = searchParams.get('category') || '';

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // Pull products with inventory so we can show stock and filter by availability
    inventoryAPI.getProductsWithInventory()
      .then((res) => {
        const list = res?.data?.products || res?.data || res || [];
        // Normalize fields and filter Active with stock > 0
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
        }));
        
        // FIX: Removed the "&& Number(p.stock) > 0" check so Out of Stock items still appear
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

  return (
    <div className="products-page">
      <Navbar />

      {/* Main Content */}
      <main className="products-main">

        {/* Search and Filter Section */}
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
          
          {/* Category Buttons */}
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
                {/* (The product-image-wrapper) */}
                <div className="product-image-wrapper">
                {/* FIX: Dynamic Badge Color and Text */}
                <div className="stock-badge" style={{ background: isOutOfStock ? '#dc3545' : '#10b981' }}>
                  {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                </div>
                
                <img 
                    src={p.image ? (p.image.startsWith('http') ? p.image : `http://localhost:5000${p.image}`) : 'https://placehold.co/400x300?text=No+Image'} 
                    alt={p.name} 
                    onError={(e) => {
                      e.currentTarget.onerror = null; // Prevent infinite loop
                      e.currentTarget.src = 'https://placehold.co/400x300?text=No+Image';
                    }}
                    className="product-image"
                    style={{ filter: isOutOfStock ? 'grayscale(100%)' : 'none' }}
                />
                </div>
                {/* (The product-info) */}
                <div className="product-info">
                    <span className="product-brand">{p.brand}</span>
                    <h3 className="product-title">{p.name}</h3>
                    <div className="product-price-section">
                    <span className="product-label">Price</span>
                    <span className="product-price">{currency(p.price)}</span>
                    </div>
                    <Link 
                    to={`/products/${encodeURIComponent(p.name.toLowerCase().replace(/\s+/g, '-'))}`} 
                    state={{ productId: p.product_id || p.id }}
                    className="view-details-button"
                    >
                    View Details <span className="arrow">›</span>
                    </Link>
                </div>
            </div>
            );
          })}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Products;