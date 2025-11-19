import { Sales } from '../models/Sales.js';
import { Return } from '../models/Return.js';
import { getPool } from '../config/database.js';

export class ReportsController {
  // Helper function to convert UTC to Philippine Time (UTC+8)
  static convertToPhilippineTime(utcDateString) {
    if (!utcDateString) return null;
    const utcDate = new Date(utcDateString);
    utcDate.setHours(utcDate.getHours() + 8);
    return utcDate.toISOString().replace('Z', '+08:00');
  }

  // REVISED: Get sales report data paginated by ITEMS, filtering ONLY Completed & Partially Returned
  static async getSalesReport(req, res) {
    try {
      const { page = 1, limit = 10, start_date, end_date } = req.query;
      const offset = (page - 1) * limit;
      const pool = getPool();

      // 1. Base conditions: Strictly 'Completed' or 'Partially Returned'
      // Removed 's.status IS NULL' to ensure strict filtering
      const baseWhere = `
        WHERE s.status IN ('Completed', 'Partially Returned')
        AND (s.payment_status != 'Refunded' OR s.payment_status IS NULL)
        AND (si.quantity - COALESCE(si.returned_quantity, 0)) > 0
      `;

      let dateFilter = '';
      let params = [];

      if (start_date) {
        dateFilter += ' AND DATE(s.created_at) >= ?';
        params.push(start_date);
      }
      if (end_date) {
        dateFilter += ' AND DATE(s.created_at) <= ?';
        params.push(end_date);
      }

      // 2. Fetch Paginated Items
      const query = `
        SELECT 
          si.product_name,
          si.brand,
          si.price as unit_price,
          (si.quantity - COALESCE(si.returned_quantity, 0)) as quantity_sold,
          ((si.quantity - COALESCE(si.returned_quantity, 0)) * si.price) as total_item_price,
          s.id as sale_id,
          s.sale_number as order_id,
          s.customer_name,
          s.created_at as order_date
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        ${baseWhere}
        ${dateFilter}
        ORDER BY s.created_at DESC
        LIMIT ? OFFSET ?
      `;
      
      const queryParams = [...params, parseInt(limit), parseInt(offset)];
      const [items] = await pool.execute(query, queryParams);

      // 3. Get Total Count
      const countQuery = `
        SELECT COUNT(*) as total 
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        ${baseWhere}
        ${dateFilter}
      `;
      const [countResult] = await pool.execute(countQuery, params);
      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / limit);

      // 4. Calculate Global Summary
      const summaryQuery = `
        SELECT 
          COUNT(DISTINCT s.id) as total_sales_count,
          SUM((si.quantity - COALESCE(si.returned_quantity, 0)) * si.price) as total_revenue
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        ${baseWhere}
        ${dateFilter}
      `;
      const [summaryResult] = await pool.execute(summaryQuery, params);
      
      const summary = {
        totalSales: summaryResult[0].total_sales_count || 0,
        totalRevenue: summaryResult[0].total_revenue || 0,
        averageSale: 0,
        totalItems: totalItems
      };

      if (summary.totalSales > 0) {
        summary.averageSale = summary.totalRevenue / summary.totalSales;
      }

      // 5. Format Data
      const formattedItems = items.map(item => ({
        id: `${item.sale_id}-${item.product_name}`,
        orderId: item.order_id,
        customerName: item.customer_name,
        productName: item.product_name,
        brand: item.brand,
        quantity: item.quantity_sold,
        unitPrice: parseFloat(item.unit_price),
        totalPrice: parseFloat(item.total_item_price),
        orderDate: ReportsController.convertToPhilippineTime(item.order_date)
      }));

      res.json({
        success: true,
        data: {
          sales: formattedItems,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total: totalItems,
            total_pages: totalPages,
            from: offset + 1,
            to: Math.min(offset + parseInt(limit), totalItems)
          },
          summary: summary
        }
      });

    } catch (error) {
      console.error('Error fetching sales report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales report'
      });
    }
  }

  // ... (Keep other methods: getInventoryReport, getReturnsReport, getFilterOptions unchanged)
  // Get inventory report data with pagination
  static async getInventoryReport(req, res) {
    try {
      const { page = 1, limit = 10, search, category, brand, status, stock_status } = req.query;

      const offset = (page - 1) * limit;

      // Build query for products with inventory data
      let query = `
        SELECT p.product_id, p.name, p.brand, p.category, p.price, p.status,
               p.created_at,
               COALESCE(i.stock, 0) as current_stock,
               COALESCE(i.reorder_point, 10) as reorder_point,
               CASE
                 WHEN COALESCE(i.stock, 0) <= 0 THEN 'Out of Stock'
                 WHEN COALESCE(i.stock, 0) < COALESCE(i.reorder_point, 10) THEN 'Low Stock'
                 ELSE 'In Stock'
               END as stock_status
        FROM products p
        LEFT JOIN inventory i ON p.product_id = i.product_id
        WHERE 1=1
      `;
      let params = [];

      if (search) {
        query += ' AND (p.name LIKE ? OR p.product_id LIKE ? OR p.brand LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (category && category !== 'All Categories') {
        query += ' AND p.category = ?';
        params.push(category);
      }

      if (brand && brand !== 'All Brand') {
        query += ' AND p.brand = ?';
        params.push(brand);
      }

      if (status && status !== 'All Status') {
        query += ' AND p.status = ?';
        params.push(status);
      }

      // Filter by computed stock_status via HAVING
      if (stock_status && stock_status !== 'All Status') {
        query += ' HAVING stock_status = ?';
        params.push(stock_status);
      }

      query += ' ORDER BY p.created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const pool = getPool();
      const [products] = await pool.execute(query, params);

      // Get total count for pagination
      let countQuery = `
        SELECT COUNT(*) as total FROM (
          SELECT p.product_id,
                 CASE
                   WHEN COALESCE(i.stock, 0) <= 0 THEN 'Out of Stock'
                   WHEN COALESCE(i.stock, 0) < COALESCE(i.reorder_point, 10) THEN 'Low Stock'
                   ELSE 'In Stock'
                 END as stock_status
          FROM products p
          LEFT JOIN inventory i ON p.product_id = i.product_id
          WHERE 1=1
        `;
      let countParams = [];

      if (search) {
        countQuery += ' AND (p.name LIKE ? OR p.product_id LIKE ? OR p.brand LIKE ?)';
        countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      }

      if (category && category !== 'All Categories') {
        countQuery += ' AND p.category = ?';
        countParams.push(category);
      }

      if (brand && brand !== 'All Brand') {
        countQuery += ' AND p.brand = ?';
        countParams.push(brand);
      }

      if (status && status !== 'All Status') {
        countQuery += ' AND p.status = ?';
        countParams.push(status);
      }
      countQuery += ') t';
      if (stock_status && stock_status !== 'All Status') {
        countQuery += ' WHERE t.stock_status = ?';
        countParams.push(stock_status);
      }

      const [totalResult] = await pool.execute(countQuery, countParams);
      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / limit);

      // Calculate summary statistics
      const summary = {
        totalProducts: total,
        inStockProducts: products.filter(p => p.stock_status === 'In Stock').length,
        lowStockProducts: products.filter(p => p.stock_status === 'Low Stock').length,
        outOfStockProducts: products.filter(p => p.stock_status === 'Out of Stock').length,
        totalInventoryValue: products.reduce((sum, product) => {
          const stock = product.current_stock || 0;
          const price = parseFloat(product.price || 0);
          return sum + (stock * price);
        }, 0)
      };

      res.json({
        success: true,
        data: {
          products: products.map(product => ({
            id: product.product_id,
            productName: product.name || 'N/A',
            category: product.category || 'N/A',
            brand: product.brand || 'N/A',
            currentStock: product.current_stock || 0,
            stockStatus: product.stock_status || 'Out of Stock',
            price: parseFloat(product.price || 0),
            status: product.status || 'N/A',
            createdDate: ReportsController.convertToPhilippineTime(product.created_at)
          })),
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total: total,
            total_pages: totalPages,
            from: offset + 1,
            to: Math.min(offset + parseInt(limit), total)
          },
          summary: summary
        }
      });
    } catch (error) {
      console.error('Error fetching inventory report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch inventory report'
      });
    }
  }
  
  // Get returns report data with pagination and filtering
  static async getReturnsReport(req, res) {
    try {
      const { page = 1, limit = 10, start_date, end_date, returnReason } = req.query;
      const offset = (page - 1) * limit;

      const filters = {
        startDate: start_date,
        endDate: end_date,
        returnReason,
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      // Get paginated returns
      const returns = await Return.getAllReturns(filters);

      // Get total count for pagination
      const pool = getPool();
      let countQuery = "SELECT COUNT(*) as total FROM returns WHERE 1=1";
      let countParams = [];
      if (start_date) {
        countQuery += ' AND return_date >= ?';
        countParams.push(start_date);
      }
      if (end_date) {
        countQuery += ' AND return_date <= ?';
        countParams.push(end_date);
      }
      if (returnReason) {
        countQuery += ' AND return_reason = ?';
        countParams.push(returnReason);
      }

      const [totalResult] = await pool.execute(countQuery, countParams);
      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / limit);

      // Get summary stats
      const summary = await Return.getReturnStats();

      res.json({
        success: true,
        data: {
          returns: returns,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total: total,
            total_pages: totalPages,
            from: offset + 1,
            to: Math.min(offset + parseInt(limit), total)
          },
          summary: summary
        }
      });

    } catch (error) {
      console.error('Error fetching returns report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch returns report'
      });
    }
  }

  // Get filter options (brands and categories)
  static async getFilterOptions(req, res) {
    try {
      const pool = getPool();

      // Get unique brands from active products
      const [brands] = await pool.execute(
        `SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND brand != '' AND status = 'Active' ORDER BY brand`
      );

      // Get unique categories from active products
      const [categories] = await pool.execute(
        `SELECT DISTINCT category FROM products WHERE category IS NOT NULL AND category != '' AND status = 'Active' ORDER BY category`
      );

      res.json({
        success: true,
        data: {
          brands: brands.map(b => b.brand),
          categories: categories.map(c => c.category)
        }
      });
    } catch (error) {
      console.error('Error fetching filter options:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch filter options'
      });
    }
  }
}