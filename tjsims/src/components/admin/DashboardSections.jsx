import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom'; 
import { dashboardAPI } from '../../utils/api';
// REVISION: Import Doughnut instead of Pie
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement 
} from 'chart.js';

// REVISION: Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement 
);

// Helper to format currency
const currency = (n) => `₱${Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// REVISION: Updated helper to format date based on period
const formatDate = (dateString, period) => {
  const date = new Date(dateString);
  if (period === 'year') {
    // For yearly, show month only (e.g., 'Nov')
    return date.toLocaleDateString('en-US', { month: 'short' });
  }
  // For week/month, show month and day (e.g., 'Nov 16')
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Helper for random chart colors
const CHART_COLORS = [
  '#2478bd', // Blue
  '#f1ce44', // Yellow
  '#28a745', // Green
  '#fd7e14', // Orange
  '#6f42c1', // Purple
  '#dc3545', // Red
  '#17a2b8', // Teal
];

const getChartColors = (count) => {
  const colors = [];
  for (let i = 0; i < count; i++) {
    colors.push(CHART_COLORS[i % CHART_COLORS.length]);
  }
  return colors;
};


const DashboardSections = () => {
  const [lowStock, setLowStock] = useState([]);
  
  // --- REVISION: State for Sales Chart ---
  const [salesPeriod, setSalesPeriod] = useState('week'); // 'week', 'month', 'year'
  const [salesChartData, setSalesChartData] = useState({ labels: [], datasets: [] });
  const [loadingSales, setLoadingSales] = useState(true);
  // --- End of Revision ---

  const [fastMoving, setFastMoving] = useState([]);
  const [slowMoving, setSlowMoving] = useState([]);
  const [salesByCategory, setSalesByCategory] = useState([]);
  const [stockTab, setStockTab] = useState('low'); 
  const [productTab, setProductTab] = useState('fast');
  const [loading, setLoading] = useState(true);

  // Initial load for all dashboard sections
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true);
        // Fetch non-sales-chart data
        const [lowStockRes, fastMovingRes, slowMovingRes, salesByCategoryRes] = await Promise.all([
          dashboardAPI.getLowStockItems(),
          dashboardAPI.getFastMovingProducts(),
          dashboardAPI.getSlowMovingProducts(),
          dashboardAPI.getSalesByCategory()
        ]);

        if (lowStockRes.success) setLowStock(lowStockRes.data || []);
        if (fastMovingRes.success) setFastMoving(fastMovingRes.data || []);
        if (slowMovingRes.success) setSlowMoving(slowMovingRes.data || []);
        if (salesByCategoryRes.success) setSalesByCategory(salesByCategoryRes.data || []);
      } catch (error) {
        console.error("Failed to fetch dashboard sections:", error);
      } finally {
        setLoading(false); // Stop main loader
      }
    };
    fetchAllData();
  }, []);

  // useEffect to fetch sales data when period changes
  useEffect(() => {
    const fetchSalesData = async () => {
      try {
        setLoadingSales(true);
        const salesRes = await dashboardAPI.getDailySales({ period: salesPeriod });
        
        if (salesRes.success) {
          const data = salesRes.data || [];
          setSalesChartData({
            labels: data.map(d => formatDate(d.date, salesPeriod)),
            datasets: [
              {
                label: 'Total Sales (PHP)',
                data: data.map(d => d.total),
                backgroundColor: '#2478bd',
                borderRadius: 4,
              },
            ],
          });
        }
      } catch (error) {
        console.error("Failed to fetch sales data:", error);
      } finally {
        setLoadingSales(false);
      }
    };
    
    fetchSalesData();
  }, [salesPeriod]); // Re-run this effect when salesPeriod changes

  // Dynamic chart title and options
  const getSalesChartTitle = () => {
    switch (salesPeriod) {
      case 'month':
        return 'Sales Last 30 Days';
      case 'year':
        return 'Sales Last 12 Months';
      case 'week':
      default:
        return 'Sales Last 7 Days';
    }
  };

  const salesChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: false, // REVISION: Set to false to avoid double title
        text: getSalesChartTitle(), // Text is still here but won't display
      },
    },
  };

  // Data and Options for the "Top Sellers" Chart
  const productPerformanceData = {
    labels: fastMoving.map(p => p.name),
    datasets: [
      {
        label: 'Units Sold',
        data: fastMoving.map(p => p.total_sold),
        backgroundColor: getChartColors(fastMoving.length),
        borderWidth: 1,
      },
    ],
  };

  const productPerformanceOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Top 5 Selling Products (Units Sold)',
      },
    },
  };

  // Data and Options for the "Least Selling" Chart
  const slowMoversData = {
    labels: slowMoving.map(p => p.name),
    datasets: [
      {
        label: 'Units Sold',
        data: slowMoving.map(p => p.total_sold),
        backgroundColor: getChartColors(slowMoving.length).reverse(), // Use different colors
        borderWidth: 1,
      },
    ],
  };

  const slowMoversOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Least Selling Products (Units Sold)',
      },
    },
  };
  
  // Data and Options for the "Sales by Category" Chart
  const salesByCategoryData = {
    labels: salesByCategory.map(c => c.category),
    datasets: [
      {
        label: 'Total Revenue',
        data: salesByCategory.map(c => c.total_revenue),
        backgroundColor: getChartColors(salesByCategory.length),
        borderWidth: 1,
      },
    ],
  };

  const salesByCategoryOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      },
      title: {
        display: true,
        text: 'Sales Revenue by Category (Last 30 Days)',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed !== null) {
              label += currency(context.parsed);
            }
            return label;
          }
        }
      }
    },
  };

  // Show a single loader if *any* of the main sections are loading
  if (loading) {
    return (
      <div className="dashboard-row">
        <div className="dashboard-col">
          <div className="dashboard-card">Loading dashboard data...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Row 1: Sales Chart (Left) + Inventory Alerts (Right) */}
      <div className="dashboard-row">
        
        {/* Left Column: Sales Chart */}
        {/* REVISION: Removed fixed height style */}
        <div className="dashboard-col" style={{ flex: 2 }}>
          <div className="dashboard-card"> 

            {/* --- NEWLY ADDED SECTION --- */}
            <div className="card-header-action">
              <h2>Sales Overview</h2>
              <Link to="/admin/reports" className="btn btn-outline btn-small">
                View Reports
              </Link>
            </div>
            {/* --- END OF NEW SECTION --- */}

            <div className="card-tabs" style={{ marginBottom: '15px', borderBottom: '2px solid #e1e8ed' }}>
              <button
                className={`card-tab-btn ${salesPeriod === 'week' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('week')}
              >
                Last 7 Days
              </button>
              <button
                className={`card-tab-btn ${salesPeriod === 'month' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('month')}
              >
                Last 30 Days
              </button>
              <button
                className={`card-tab-btn ${salesPeriod === 'year' ? 'active' : ''}`}
                onClick={() => setSalesPeriod('year')}
              >
                Last 12 Months
              </button>
            </div>

            {/* REVISION: Adjusted height of this wrapper to make room for header */}
            <div style={{ height: '280px', position: 'relative' }}> 
              {loadingSales ? (
                <div style={{ textAlign: 'center', paddingTop: '100px', color: '#666' }}>Loading chart data...</div>
              ) : (
                <Bar options={salesChartOptions} data={salesChartData} />
              )}
            </div>
            
          </div>
        </div>

        {/* Right Column: Inventory Alerts */}
        <div className="dashboard-col" style={{ flex: 1 }}>
          <div className="dashboard-card">
            
            <div className="card-header-action">
              <h2>Inventory Alerts</h2>
              <Link to="/admin/inventory" className="btn btn-outline btn-small">
                Manage Inventory
              </Link>
            </div>

            <div className="card-tabs">
              <button
                className={`card-tab-btn ${stockTab === 'low' ? 'active' : ''}`}
                onClick={() => setStockTab('low')}
              >
                Low Stock ({lowStock.filter(item => item.remaining > 0).length})
              </button>
              <button
                className={`card-tab-btn ${stockTab === 'out' ? 'active' : ''}`}
                onClick={() => setStockTab('out')}
              >
                Out of Stock ({lowStock.filter(item => item.remaining === 0).length})
              </button>
            </div>

            {stockTab === 'low' ? (
              // Tab 1: Low Stock (stock > 0)
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.filter(item => item.remaining > 0).length > 0 ? (
                      lowStock.filter(item => item.remaining > 0).map(item => (
                        <tr key={item.product_id}>
                          <td>{item.name}</td>
                          <td style={{ color: '#fd7e14', fontWeight: 'bold' }}>{item.remaining}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="2" style={{ textAlign: 'center' }}>No items are low on stock.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              // Tab 2: Out of Stock (stock === 0)
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lowStock.filter(item => item.remaining === 0).length > 0 ? (
                      lowStock.filter(item => item.remaining === 0).map(item => (
                        <tr key={item.product_id}>
                          <td>{item.name}</td>
                          <td style={{ color: '#dc3545', fontWeight: 'bold' }}>0</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="2" style={{ textAlign: 'center' }}>All items are in stock.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Category Sales + Product Performance */}
      <div className="dashboard-row">

        {/* Sales by Category Chart */}
        <div className="dashboard-col" style={{ flex: 1 }}>
          <div className="dashboard-card">
            <div className="chart-container" style={{ height: '350px', position: 'relative' }}>
              {salesByCategory.length > 0 ? (
                <Doughnut options={salesByCategoryOptions} data={salesByCategoryData} />
              ) : (
                <div style={{ textAlign: 'center', paddingTop: '50px', color: '#666' }}>
                  No category sales data yet for this period.
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Product Performance Chart */}
        <div className="dashboard-col" style={{ flex: 1 }}>
          <div className="dashboard-card">
            <div className="card-tabs">
              <button
                className={`card-tab-btn ${productTab === 'fast' ? 'active' : ''}`}
                onClick={() => setProductTab('fast')}
              >
                Top Sellers
              </button>
              <button
                className={`card-tab-btn ${productTab === 'slow' ? 'active' : ''}`}
                onClick={() => setProductTab('slow')}
              >
                Least Selling
              </button>
            </div>

            {productTab === 'fast' ? (
              <div className="chart-container" style={{ height: '320px', position: 'relative' }}>
                {fastMoving.length > 0 ? (
                  <Doughnut options={productPerformanceOptions} data={productPerformanceData} />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#666' }}>
                    No sales data yet for this period.
                  </div>
                )}
              </div>
            ) : (
              <div className="chart-container" style={{ height: '320px', position: 'relative' }}>
                {slowMoving.length > 0 ? (
                  <Doughnut options={slowMoversOptions} data={slowMoversData} />
                ) : (
                  <div style={{ textAlign: 'center', paddingTop: '50px', color: '#666' }}>
                    No sales data for least-selling items.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardSections;