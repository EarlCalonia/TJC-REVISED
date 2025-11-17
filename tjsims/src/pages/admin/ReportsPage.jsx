import React, { useState, useEffect } from 'react';
import Navbar from '../../components/admin/Navbar';
import { generateSalesReportPDF, generateInventoryReportPDF, generateReturnsReportPDF } from '../../utils/pdfGenerator';
import { reportsAPI } from '../../utils/api';
import { 
  BsFileEarmarkPdf, 
  BsPiggyBank, 
  BsFileEarmarkText, 
  BsFillArchiveFill, 
  BsFillXCircleFill, 
  BsFillExclamationTriangleFill,
  BsArrowReturnLeft 
} from 'react-icons/bs';
import '../../styles/ReportsPage.css';


// --- Summary Cards Component ---
const ReportSummary = ({ summary, activeTab }) => {
  // Show loading placeholders if summary is null
  if (!summary) {
    return (
      <div className="reports-stats">
        <div className="stat-card-placeholder"></div>
        <div className="stat-card-placeholder"></div>
        <div className="stat-card-placeholder"></div>
        {activeTab === 'inventory' && <div className="stat-card-placeholder"></div>}
      </div>
    );
  }

  return (
    <div className="reports-stats">
      {activeTab === 'sales' && (
        <>
          <div className="stat-card revenue">
            <div className="stat-info-flex">
              <div>
                <h3>Total Revenue</h3>
                <p className="stat-value revenue">₱{Number(summary.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="stat-icon in-stock">
                <BsPiggyBank />
              </div>
            </div>
          </div>
          <div className="stat-card sales">
            <div className="stat-info-flex">
              <div>
                <h3>Total Sales</h3>
                <p className="stat-value sales">{summary.totalSales || 0}</p>
              </div>
              <div className="stat-icon sales">
                <BsFileEarmarkText />
              </div>
            </div>
          </div>
          <div className="stat-card avg-sale">
            <div className="stat-info-flex">
              <div>
                <h3>Avg. Sale Value</h3>
                <p className="stat-value avg-sale">₱{Number(summary.averageSale || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="stat-icon avg-sale">
                <BsPiggyBank />
              </div>
            </div>
          </div>
        </>
      )}
      {activeTab === 'inventory' && (
        <>
          <div className="stat-card inventory">
            <div className="stat-info-flex">
              <div>
                <h3>Total Products</h3>
                <p className="stat-value inventory">{summary.totalProducts || 0}</p>
              </div>
              <div className="stat-icon inventory">
                <BsFillArchiveFill />
              </div>
            </div>
          </div>
          <div className="stat-card revenue">
            <div className="stat-info-flex">
              <div>
                <h3>Total Inventory Value</h3>
                <p className="stat-value revenue">₱{Number(summary.totalInventoryValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="stat-icon in-stock">
                <BsPiggyBank />
              </div>
            </div>
          </div>
          <div className="stat-card out-of-stock">
            <div className="stat-info-flex">
              <div>
                <h3>Out of Stock</h3>
                <p className="stat-value out-of-stock">{summary.outOfStockProducts || 0}</p>
              </div>
              <div className="stat-icon out-of-stock">
                <BsFillXCircleFill />
              </div>
            </div>
          </div>
          <div className="stat-card low-stock">
            <div className="stat-info-flex">
              <div>
                <h3>Low Stock</h3>
                <p className="stat-value low-stock">{summary.lowStockProducts || 0}</p>
              </div>
              <div className="stat-icon low-stock">
                <BsFillExclamationTriangleFill />
              </div>
            </div>
          </div>
        </>
      )}
      {activeTab === 'returns' && (
        <>
          <div className="stat-card returns">
            <div className="stat-info-flex">
              <div>
                <h3>Total Returns</h3>
                <p className="stat-value returns">{summary.totalReturns || 0}</p>
              </div>
              <div className="stat-icon returns">
                <BsArrowReturnLeft />
              </div>
            </div>
          </div>
          <div className="stat-card revenue out-of-stock"> {/* Use out-of-stock for red color */}
            <div className="stat-info-flex">
              <div>
                <h3>Total Refunded</h3>
                <p className="stat-value revenue out-of-stock">₱{Number(summary.totalRefundAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="stat-icon out-of-stock">
                <BsPiggyBank />
              </div>
            </div>
          </div>
          <div className="stat-card out-of-stock">
            <div className="stat-info-flex">
              <div>
                <h3>Defective Items</h3>
                <p className="stat-value out-of-stock">{summary.defectiveReturns || 0}</p>
              </div>
              <div className="stat-icon out-of-stock">
                <BsFillXCircleFill />
              </div>
            </div>
          </div>
          <div className="stat-card inventory">
            <div className="stat-info-flex">
              <div>
                <h3>Items Restocked</h3>
                <p className="stat-value inventory">{summary.restockedReturns || 0}</p>
              </div>
              <div className="stat-icon inventory">
                <BsFillArchiveFill />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};


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
  const [returnsData, setReturnsData] = useState([]); // --- NEW STATE ---
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({});
  const [summary, setSummary] = useState(null); // --- NEW STATE ---

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
      setSummary(null); // --- ADDED: Clear summary on each fetch ---

      const filters = {
        page: currentPage,
        limit: itemsPerPage,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate })
      };

      if (activeTab === 'sales') {
        const result = await reportsAPI.getSalesReport(filters);
        setSalesData(result.sales || []);
        setPagination(result.pagination || {});
        setSummary(result.summary || null); // --- ADDED: Set summary ---
      } else if (activeTab === 'inventory') { // --- UPDATED: else if ---
        const inventoryFilters = {
          ...filters,
          ...(stockStatus && stockStatus !== 'All Status' ? { stock_status: stockStatus } : {}),
          ...(brandFilter && brandFilter !== 'All Brand' ? { brand: brandFilter } : {}),
          ...(categoryFilter && categoryFilter !== 'All Categories' ? { category: categoryFilter } : {})
        };
        const result = await reportsAPI.getInventoryReport(inventoryFilters);
        setInventoryData(result.inventory || []);
        setPagination(result.pagination || {});
        setSummary(result.summary || null); // --- ADDED: Set summary ---
      } else if (activeTab === 'returns') { // --- NEW BLOCK ---
        const returnsFilters = { ...filters }; // Add any specific filters if needed
        const result = await reportsAPI.getReturnsReport(returnsFilters);
        setReturnsData(result.returns || []);
        setPagination(result.pagination || {});
        setSummary(result.summary || null); // --- ADDED: Set summary ---
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
    } else if (activeTab === 'inventory') { // --- UPDATED: else if ---
      // Backend already handles pagination, just return the data
      return inventoryData;
    } else if (activeTab === 'returns') { // --- NEW BLOCK ---
      return returnsData;
    }
    return []; // Default empty
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
        
        const salesDataForPDF = allSalesResult.sales || [];
        
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
        
      } else if (activeTab === 'inventory') { // activeTab is 'inventory'
      
        // Export inventory report
        const allInventoryResult = await reportsAPI.getInventoryReport({
          stock_status: stockStatus && stockStatus !== 'All Status' ? stockStatus : undefined,
          brand: brandFilter && brandFilter !== 'All Brand' ? brandFilter : undefined,
          category: categoryFilter && categoryFilter !== 'All Categories' ? categoryFilter : undefined,
          page: 1,
          limit: 999999 // Fetch all
        });

        const inventoryDataForPDF = allInventoryResult.inventory || [];

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
      } else if (activeTab === 'returns') { // --- NEW: activeTab is 'returns'
        // Export returns report
        const allReturnsResult = await reportsAPI.getReturnsReport({
          startDate: startDate,
          endDate: endDate,
          limit: 999999 // Fetch all
        });

        const returnsDataForPDF = allReturnsResult.returns || [];

        if (returnsDataForPDF.length === 0) {
            alert('No returns data found for this period.');
            return;
        }

        const doc = await generateReturnsReportPDF(
            returnsDataForPDF,
            startDate,
            endDate,
            adminName
        );
        doc.save(`Returns_Report_${startDate}_to_${endDate}.pdf`);
      }
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF: ' + error.message);
    }
  };
  
  // Reset to first page when tab changes
  useEffect(() => {
    setCurrentPage(1);
    // --- ADDED: Clear dates when tab changes ---
    setStartDate(''); 
    setEndDate('');
  }, [activeTab]);

  return (
    <>
      <div className="admin-layout">
        <Navbar />
        <main className="admin-main">
          <div className="admin-container">

            {/* Header Section */}
            <div className="page-header">
              <h1 className="page-title">Reports</h1>
              <p className="page-subtitle">Generate and export sales and inventory reports.</p>
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
              {/* --- NEW TAB --- */}
              <button
                className={`tab-btn ${activeTab === 'returns' ? 'active' : ''}`}
                onClick={() => setActiveTab('returns')}
              >
                Returns Report
              </button>
            </div>

            {/* --- NEW: Summary Cards --- */}
            <ReportSummary summary={summary} activeTab={activeTab} />

            {/* Controls Section */}
            <div className="card">
              <div className="reports-controls-inner">
                <div className="filters-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  
                  {/* --- UPDATED: Sales Tab Filters --- */}
                  {activeTab === 'sales' && (
                    <>
                      <div className="date-input-group">
                        <label htmlFor="range-label">Range Label</label>
                        <select id="range-label" value={rangeLabel} onChange={(e)=>handleRangeLabelChange(e.target.value)} className="date-input">
                          <option>Daily</option>
                          <option>Weekly</option>
                          <option>Monthly</option>
                        </select>
                      </div>
                      <div className="date-input-group">
                        <label htmlFor="start-date">
                          {rangeLabel === 'Weekly' ? 'Select Week' : rangeLabel === 'Monthly' ? 'Select Month' : 'From'}
                        </label>
                        <input
                          type={rangeLabel === 'Weekly' ? 'week' : rangeLabel === 'Monthly' ? 'month' : 'date'}
                          id="start-date"
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
                    </>
                  )}
                  
                  {/* --- UPDATED: Inventory/Returns Tab Filters --- */}
                  {/* Show date pickers for Inventory and Returns tabs */}
                  {activeTab !== 'sales' && (
                    <>
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
                    </>
                  )}

                  {activeTab === 'inventory' && (
                    <>
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
                  <button 
                    onClick={handleExportPDF} 
                    className="btn btn-danger"
                    title='Export as PDF'
                  >
                    <BsFileEarmarkPdf className="export-icon" />
                    Export PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Reports Table */}
            <div className="table-section">
              <div className="table-container">
                {loading ? (
                  <div className="loading-state">Loading report data...</div>
                ) : error ? (
                  <div className="error-state">
                    <p>{error}</p>
                    <button onClick={fetchReportData} className="btn btn-danger">Retry</button>
                  </div>
                ) : getCurrentData().length === 0 ? (
                  <div className="empty-state">
                    No data available for the selected period
                  </div>
                ) : activeTab === 'sales' ? (
                  <table className="table">
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
                          {/* --- FIX: Format the date --- */}
                          <td>{new Date(item.orderDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : activeTab === 'inventory' ? (
                  <table className="table">
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
                              className={`status-badge ${(item.stockStatus || '')
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
                ) : (
                  // --- NEW TABLE: Returns Report ---
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Return ID</th>
                        <th>Order ID</th>
                        <th>Customer Name</th>
                        <th>Return Date</th>
                        <th>Reason</th>
                        <th>Refund Method</th>
                        <th>Refund Amount</th>
                        <th>Restocked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getCurrentData().map(item => (
                        <tr key={item.id}>
                          <td className="order-id-cell">{item.return_id}</td>
                          <td>{item.sale_number}</td>
                          <td>{item.customer_name}</td>
                          <td>{new Date(item.return_date).toLocaleDateString()}</td>
                          <td>{item.return_reason}</td>
                          <td>{item.refund_method}</td>
                          <td className="amount-cell">₱{Number(item.refund_amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td>{item.restocked ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Pagination and Results Info */}
              <div className="table-footer">
                <div className="results-info">
                  Showing {pagination.from || 0} to {pagination.to || 0} of {getTotalItems()} {activeTab}
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