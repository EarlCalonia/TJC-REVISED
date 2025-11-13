import React, { useState, useEffect } from 'react';
import Navbar from '../../components/admin/Navbar';
import { generateSalesReportPDF, generateInventoryReportPDF } from '../../utils/pdfGenerator';
import { reportsAPI } from '../../utils/api';
import { BsFileEarmarkPdf } from 'react-icons/bs';
import '../../styles/ReportsPage.css';

const ReportsPage = () => {
  const [activeTab, setActiveTab] = useState('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [adminName] = useState(localStorage.getItem('username') || 'Admin User');
  const [rangeLabel, setRangeLabel] = useState('Daily'); // Sales report granularity (Daily, Weekly, Monthly)
  const [stockStatus, setStockStatus] = useState('All Status'); // Inventory report filter
  const [brandFilter, setBrandFilter] = useState('All Brand'); // Inventory brand filter
  const [categoryFilter, setCategoryFilter] = useState('All Categories'); // Inventory category filter
  const [brands, setBrands] = useState([]); // Available brands
  const [categories, setCategories] = useState([]); // Available categories
  
  // Helper functions for date range calculations
  // Helper to format date as YYYY-MM-DD without timezone conversion
  const formatLocalDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getWeekRange = (dateStr) => {
    // Handle week input format: "2025-W45" or regular date
    let date;
    if (dateStr.includes('W')) {
      // Week format: YYYY-Www
      const [year, week] = dateStr.split('-W');
      // Calculate date from week number
      date = new Date(year, 0, 1 + (week - 1) * 7);
      // Adjust to nearest Monday
      const day = date.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      date.setDate(date.getDate() + diff);
    } else {
      date = new Date(dateStr);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
    }
    
    const monday = new Date(date);
    const sunday = new Date(date);
    sunday.setDate(monday.getDate() + 6);
    
    return {
      start: formatLocalDate(monday),
      end: formatLocalDate(sunday)
    };
  };
  
  const getMonthRange = (dateStr) => {
    // Handle month input format: "2025-11" or regular date
    let year, month;
    if (dateStr.match(/^\d{4}-\d{2}$/)) {
      // Month format: YYYY-MM
      [year, month] = dateStr.split('-').map(Number);
      month = month - 1; // JavaScript months are 0-indexed (0=Jan, 10=Nov)
    } else {
      const date = new Date(dateStr);
      year = date.getFullYear();
      month = date.getMonth();
    }
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0); // Day 0 of next month = last day of this month
    
    return {
      start: formatLocalDate(firstDay),
      end: formatLocalDate(lastDay)
    };
  };
  
  // Handle range label change - auto-adjust dates
  const handleRangeLabelChange = (newLabel) => {
    setRangeLabel(newLabel);
    if (startDate) {
      if (newLabel === 'Weekly') {
        const range = getWeekRange(startDate);
        setStartDate(range.start);
        setEndDate(range.end);
      } else if (newLabel === 'Monthly') {
        const range = getMonthRange(startDate);
        setStartDate(range.start);
        setEndDate(range.end);
      }
    }
  };
  
  // Handle date change based on range label
  const handleDateChange = (value, isStart = true) => {
    if (!value) return; // Ignore empty values
    
    try {
      if (rangeLabel === 'Weekly') {
        const range = getWeekRange(value);
        setStartDate(range.start);
        setEndDate(range.end);
      } else if (rangeLabel === 'Monthly') {
        const range = getMonthRange(value);
        setStartDate(range.start);
        setEndDate(range.end);
      } else {
        // Daily - normal date picker
        if (isStart) {
          setStartDate(value);
        } else {
          setEndDate(value);
        }
      }
    } catch (error) {
      console.error('Error handling date change:', error);
    }
  };

  // API state
  const [salesData, setSalesData] = useState([]);
  const [inventoryData, setInventoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});

  // Fetch filter options on mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch data from API
  useEffect(() => {
    fetchReportData();
  }, [activeTab, startDate, endDate, currentPage, stockStatus, brandFilter, categoryFilter]);

  const fetchFilterOptions = async () => {
    try {
      const result = await reportsAPI.getFilterOptions();
      if (result.success) {
        setBrands(result.data.brands || []);
        setCategories(result.data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching filter options:', error);
    }
  };

  const fetchReportData = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters = {
        page: currentPage,
        limit: itemsPerPage,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate })
      };

      if (activeTab === 'sales') {
        const result = await reportsAPI.getSalesReport(filters);
        setSalesData(result.data?.sales || result.sales || []);
        setPagination(result.data?.pagination || result.pagination || {});
      } else {
        const inventoryFilters = {
          ...filters,
          ...(stockStatus && stockStatus !== 'All Status' ? { stock_status: stockStatus } : {}),
          ...(brandFilter && brandFilter !== 'All Brand' ? { brand: brandFilter } : {}),
          ...(categoryFilter && categoryFilter !== 'All Categories' ? { category: categoryFilter } : {})
        };
        const result = await reportsAPI.getInventoryReport(inventoryFilters);
        setInventoryData(result.data?.inventory || result.inventory || []);
        setPagination(result.data?.pagination || result.pagination || {});
      }
    } catch (err) {
      console.error('Error fetching report data:', err);
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  // Get current data for display
  const getCurrentData = () => {
    if (activeTab === 'sales') {
      // Flatten per-item rows for display (backend already handles pagination)
      const flattenedSales = salesData.flatMap(order =>
        (order.items || []).map(item => ({
          id: `${order.id}-${item.productName}-${item.quantity}-${item.unitPrice}`,
          orderId: order.orderId,
          customerName: order.customerName,
          orderDate: order.orderDate,
          totalAmount: order.totalAmount,
          ...item
        }))
      );
      return flattenedSales;
    } else {
      // Backend already handles pagination, just return the data
      return inventoryData;
    }
  };

  const getTotalItems = () => {
    // Use pagination.total from backend instead of calculating from current page data
    return pagination.total || 0;
  };

  const getTotalPages = () => {
    return pagination.total_pages || Math.ceil(getTotalItems() / itemsPerPage);
  };

  // Handle page change
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // REVISION: This entire function is corrected
  const handleExportPDF = async () => {
    try {
      if (!startDate || !endDate) {
        alert('Please select a valid date range to export.');
        return;
      }
      
      if (activeTab === 'sales') {
        // Export all sales data within the selected range (no pagination)
        const allSalesResult = await reportsAPI.getSalesReport({
          start_date: startDate,
          end_date: endDate,
          page: 1,
          limit: 999999 // Fetch all
        });
        
        const salesDataForPDF = allSalesResult.data?.sales || allSalesResult.sales || [];
        
        if (salesDataForPDF.length === 0) {
          alert('No sales data found for this period.');
          return;
        }

        const doc = await generateSalesReportPDF(
          salesDataForPDF,
          startDate,
          endDate,
          adminName,
          rangeLabel
        );
        doc.save(`Sales_Report_${startDate}_to_${endDate}.pdf`);
        
      } else { // activeTab is 'inventory'
      
        // Export inventory report
        const allInventoryResult = await reportsAPI.getInventoryReport({
          stock_status: stockStatus && stockStatus !== 'All Status' ? stockStatus : undefined,
          brand: brandFilter && brandFilter !== 'All Brand' ? brandFilter : undefined,
          category: categoryFilter && categoryFilter !== 'All Categories' ? categoryFilter : undefined,
          page: 1,
          limit: 999999 // Fetch all
        });

        const inventoryDataForPDF = allInventoryResult.data?.inventory || allInventoryResult.data?.products || allInventoryResult.inventory || [];

        if (inventoryDataForPDF.length === 0) {
          alert('No inventory data found for these filters.');
          return;
        }

        // Corrected arguments: (inventoryData, startDate, endDate, adminName)
        const doc = await generateInventoryReportPDF(
          inventoryDataForPDF,
          startDate,
          endDate,
          adminName
        );
        doc.save(`Inventory_Report_${startDate}_to_${endDate}.pdf`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF: ' + error.message);
    }
  };
  
  // Reset to first page when tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  return (
    <>
      <div className="reports-layout">
        <Navbar />
        <main className="reports-main">
          <div className="reports-container">

            {/* Header Section */}
            <div className="reports-header">
              <h1 className="reports-title">Reports</h1>
              <p className="reports-subtitle">Generate and export sales and inventory reports.</p>
            </div>

            {/* Tab System */}
            <div className="reports-tabs">
              <button
                className={`tab-btn ${activeTab === 'sales' ? 'active' : ''}`}
                onClick={() => setActiveTab('sales')}
              >
                Sales Report
              </button>
              <button
                className={`tab-btn ${activeTab === 'inventory' ? 'active' : ''}`}
                onClick={() => setActiveTab('inventory')}
              >
                Inventory Report
              </button>
            </div>

            {/* Controls Section */}
            <div className="reports-controls">
              <div className="filters-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                {activeTab === 'sales' && (
                  <div className="date-input-group">
                    <label htmlFor="range-label">Range Label</label>
                    <select id="range-label" value={rangeLabel} onChange={(e)=>handleRangeLabelChange(e.target.value)} className="date-input">
                      <option>Daily</option>
                      <option>Weekly</option>
                      <option>Monthly</option>
                    </select>
                  </div>
                )}
                <div className="date-input-group">
                  <label htmlFor="start-date">
                    {rangeLabel === 'Weekly' ? 'Select Week' : rangeLabel === 'Monthly' ? 'Select Month' : 'From'}
                  </label>
                  <input
                    type={rangeLabel === 'Weekly' ? 'week' : rangeLabel === 'Monthly' ? 'month' : 'date'}
                    id="start-date"
                    // REVISION: Use value={startDate} for Daily, otherwise let it be handled by onChange
                    value={rangeLabel === 'Daily' ? startDate : undefined}
                    onChange={(e) => handleDateChange(e.target.value, true)}
                    className="date-input"
                  />
                </div>
                {rangeLabel === 'Daily' && (
                  <div className="date-input-group">
                    <label htmlFor="end-date">To</label>
                    <input
                      type="date"
                      id="end-date"
                      value={endDate}
                      onChange={(e) => handleDateChange(e.target.value, false)}
                      className="date-input"
                    />
                  </div>
                )}
                {rangeLabel !== 'Daily' && startDate && endDate && (
                  <div className="date-input-group">
                    <label>Calculated Range</label>
                    <input
                      type="text"
                      value={`${startDate} to ${endDate}`}
                      readOnly
                      className="date-input"
                      style={{ background: '#f5f5f5', cursor: 'not-allowed', minWidth: '280px' }}
                    />
                  </div>
                )}
                {activeTab === 'inventory' && (
                  <>
                    {/* REVISION: Added date pickers for inventory tab as well */}
                    <div className="date-input-group">
                      <label htmlFor="start-date-inv">From</label>
                      <input
                        type="date"
                        id="start-date-inv"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="date-input"
                      />
                    </div>
                    <div className="date-input-group">
                      <label htmlFor="end-date-inv">To</label>
                      <input
                        type="date"
                        id="end-date-inv"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="date-input"
                      />
                    </div>
                    {/* End of added date pickers */}
                    <div className="date-input-group">
                      <label htmlFor="brand-filter">Brand</label>
                      <select id="brand-filter" value={brandFilter} onChange={(e)=>setBrandFilter(e.target.value)} className="date-input">
                        <option>All Brand</option>
                        {brands.map(brand => (
                          <option key={brand} value={brand}>{brand}</option>
                        ))}
                      </select>
                    </div>
                    <div className="date-input-group">
                      <label htmlFor="category-filter">Category</label>
                      <select id="category-filter" value={categoryFilter} onChange={(e)=>setCategoryFilter(e.target.value)} className="date-input">
                        <option>All Categories</option>
                        {categories.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </div>
                    <div className="date-input-group">
                      <label htmlFor="stock-status">Stock Status</label>
                      <select id="stock-status" value={stockStatus} onChange={(e)=>setStockStatus(e.target.value)} className="date-input">
                        <option>All Status</option>
                        <option>In Stock</option>
                        <option>Low Stock</option>
                        <option>Out of Stock</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div className="export-buttons">
                <button onClick={handleExportPDF} className="export-btn pdf-btn">
                  <BsFileEarmarkPdf className="export-icon" />
                  Export PDF
                </button>
              </div>
            </div>

            {/* Reports Table */}
            <div className="reports-table-section">
              <div className="table-container">
                {loading ? (
                  <div className="loading-state">
                    <p>Loading report data...</p>
                  </div>
                ) : error ? (
                  <div className="error-state">
                    <p>{error}</p>
                    <button onClick={fetchReportData} className="retry-btn">
                      Retry
                    </button>
                  </div>
                ) : getCurrentData().length === 0 ? (
                  <div className="empty-state">
                    <p>No data available for the selected period</p>
                  </div>
                ) : activeTab === 'sales' ? (
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer Name</th>
                        <th>Product Name</th>
                        <th>Quantity Sold</th>
                        <th>Unit Price</th>
                        <th>Total Sales</th>
                        <th>Order Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCurrentData().map(item => (
                        <tr key={item.id}>
                          <td className="order-id-cell">{item.orderId}</td>
                          <td>{item.customerName}</td>
                          <td>{item.productName}</td>
                          <td>{item.quantity}</td>
                          <td className="amount-cell">₱{Number(item.unitPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="amount-cell">₱{Number(item.totalPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td>{item.orderDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <table className="reports-table">
                    <thead>
                      <tr>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Brand</th>
                        <th>Current Stock</th>
                        <th>Stock Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCurrentData().map(item => (
                        <tr key={item.id}>
                          <td className="product-name-cell">{item.productName}</td>
                          <td>{item.category}</td>
                          <td>{item.brand}</td>
                          <td className="stock-cell">{item.currentStock}</td>
                          <td>
                            <span
  className={`stock-status-badge ${(item.stockStatus || '')
    .toLowerCase()
    .replace(/\s+/g, '-')}`}
>
  {item.stockStatus || 'N/A'}
</span>

                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination and Results Info */}
              <div className="table-footer">
                <div className="results-info">
                  Showing {pagination.from || 0} to {pagination.to || 0} of {getTotalItems()} {activeTab === 'sales' ? 'sales' : 'products'}
                </div>

                {getTotalPages() > 1 && (
                  <div className="pagination">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="pagination-btn"
                    >
                      Previous
                    </button>

                    {Array.from({ length: getTotalPages() }, (_, index) => index + 1).map(page => (
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
                      disabled={currentPage === getTotalPages()}
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
      </div>

    </>
  );
};

export default ReportsPage;