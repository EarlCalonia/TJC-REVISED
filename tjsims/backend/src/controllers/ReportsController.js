import { Sales } from '../models/Sales.js';
import { Return } from '../models/Return.js';
import { getPool } from '../config/database.js';

export class ReportsController {
  // Helper function to convert UTC to Philippine Time (UTC+8)
  static convertToPhilippineTime(utcDateString) {
    if (!utcDateString) return null;
    const utcDate = new Date(utcDateString);
    // Add 8 hours for Philippine Time (UTC+8)
    utcDate.setHours(utcDate.getHours() + 8);
    return utcDate.toISOString().replace('Z', '+08:00');
  }

  // Get sales report data with pagination and filtering
  static async getSalesReport(req, res) {
    try {
      const { page = 1, limit = 10, start_date, end_date } = req.query;

      const offset = (page - 1) * limit;

      // Build query for sales with filtering - get individual sales records (exclude fully refunded)
      let salesQuery = `
        SELECT s.id, s.sale_number, s.customer_name, s.contact, s.total, s.payment,
               s.created_at, s.status, s.payment_status
        FROM sales s
        WHERE 1=1
          AND (s.status = 'Completed' OR s.status = 'Partially Returned' OR s.status IS NULL)
          AND (s.payment_status != 'Refunded' OR s.payment_status IS NULL)
      `;
      let salesParams = [];

      if (start_date) {
        salesQuery += ' AND DATE(s.created_at) >= ?';
        salesParams.push(start_date);
      }

      if (end_date) {
        salesQuery += ' AND DATE(s.created_at) <= ?';
        salesParams.push(end_date);
      }

      salesQuery += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
      salesParams.push(parseInt(limit), parseInt(offset));

      const pool = getPool();
      const [sales] = await pool.execute(salesQuery, salesParams);

      // Get total count for pagination (apply same filters - exclude fully refunded)
      let countQuery = "SELECT COUNT(*) as total FROM sales WHERE 1=1 AND (status = 'Completed' OR status = 'Partially Returned' OR status IS NULL) AND (payment_status != 'Refunded' OR payment_status IS NULL)";
      let countParams = [];

      if (start_date) {
        countQuery += ' AND DATE(created_at) >= ?';
        countParams.push(start_date);
      }

      if (end_date) {
        countQuery += ' AND DATE(created_at) <= ?';
        countParams.push(end_date);
      }

      const [totalResult] = await pool.execute(countQuery, countParams);
      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / limit);

      // For each sale, get its items and calculate aggregated data
      const salesWithItems = [];
      for (const sale of sales) {
        try {
          const items = await Sales.getSaleItems(sale.id);
          const itemCount = items.length;
          const calculatedTotal = items.reduce((sum, item) => sum + parseFloat(item.subtotal || 0), 0);

          salesWithItems.push({
            id: sale.id,
            orderId: sale.sale_number,
            customerName: sale.customer_name,
            contact: sale.contact,
            orderDate: ReportsController.convertToPhilippineTime(sale.created_at),
            totalAmount: sale.total, // <--- Value stored as totalAmount
            paymentMethod: sale.payment,
            status: sale.status || 'N/A',
            itemCount: itemCount,
            calculatedTotal: calculatedTotal,
            items: items
              .map(item => {
                // Calculate actual sold quantity (excluding returned items)
                const returnedQty = item.returned_quantity || 0;
                const actualQty = (item.quantity || 0) - returnedQty;
                
                // Skip fully returned items
                if (actualQty <= 0) return null;
                
                // Adjust price for partially returned items
                const actualPrice = (item.price || 0) * actualQty;
                
                return {
                  productName: item.product_name || 'N/A',
                  brand: item.brand || 'N/A',
                  quantity: actualQty,
                  unitPrice: item.price || 0,
                  totalPrice: actualPrice
                };
              })
              .filter(item => item !== null) // Remove fully returned items
          });
        } catch (error) {
          console.error(`Error fetching items for sale ${sale.id}:`, error);
          // Add sale without items if there's an error
          salesWithItems.push({
            id: sale.id,
            orderId: sale.sale_number,
            customerName: sale.customer_name,
            contact: sale.contact,
            orderDate: ReportsController.convertToPhilippineTime(sale.created_at),
            totalAmount: sale.total,
            paymentMethod: sale.payment,
            status: sale.status || 'N/A',
            itemCount: 0,
            calculatedTotal: 0,
            items: []
          });
        }
      }

      // Calculate summary statistics
      // FIX: Updated to use 'sale.totalAmount' instead of 'sale.total'
      const summary = {
        totalSales: total,
        totalRevenue: salesWithItems.reduce((sum, sale) => sum + parseFloat(sale.totalAmount || 0), 0),
        averageSale: salesWithItems.length > 0 ? salesWithItems.reduce((sum, sale) => sum + parseFloat(sale.totalAmount || 0), 0) / salesWithItems.length : 0,
        totalItems: salesWithItems.reduce((sum, sale) => sum + sale.items.length, 0)
      };

      res.json({
        success: true,
        data: {
          sales: salesWithItems,
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
      console.error('Error fetching sales report:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales report'
      });
    }
  }

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