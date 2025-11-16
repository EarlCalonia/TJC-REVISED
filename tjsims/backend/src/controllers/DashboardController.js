import { Sales } from '../models/Sales.js';
import { Product } from '../models/Product.js';
import { getPool } from '../config/database.js';

export class DashboardController {
  // Get dashboard statistics
  static async getDashboardStats(req, res) {
    try {
      const pool = getPool();

      // Today's sales (exclude cancelled)
      const [todaySales] = await pool.execute(
        `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE DATE(created_at) = CURDATE() AND (status IS NULL OR status <> 'Cancelled')`
      );

      // This week's sales (exclude cancelled)
      const [weekSales] = await pool.execute(
        `SELECT COALESCE(SUM(total), 0) as total FROM sales WHERE YEARWEEK(created_at) = YEARWEEK(NOW()) AND (status IS NULL OR status <> 'Cancelled')`
      );

      // Low stock items count (including out of stock) - join products and inventory tables
      const [lowStock] = await pool.execute(
        `SELECT COUNT(*) as count
         FROM products p
         JOIN inventory i ON p.product_id = i.product_id
         WHERE i.stock <= i.reorder_point`
      );

      // Pending orders count (exclude completed/cancelled)
      const [pendingOrders] = await pool.execute(
        `SELECT COUNT(*) as count FROM sales WHERE (status IS NULL OR status NOT IN ('Completed', 'Cancelled'))`
      );

      res.json({
        success: true,
        data: {
          todaySales: todaySales[0].total,
          weekSales: weekSales[0].total,
          lowStockItems: lowStock[0].count,
          pendingOrders: pendingOrders[0].count
        }
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch dashboard statistics'
      });
    }
  }

  // Get recent sales transactions
  static async getRecentSales(req, res) {
    try {
      const pool = getPool();

      const [sales] = await pool.execute(
        `SELECT s.id, s.sale_number, s.customer_name, s.created_at as date,
                s.total, s.payment,
                GROUP_CONCAT(CONCAT(si.product_name, ' (', si.quantity, ')') SEPARATOR ', ') as products
         FROM sales s
         LEFT JOIN sale_items si ON s.id = si.sale_id
         WHERE (s.status IS NULL OR s.status <> 'Cancelled')
         GROUP BY s.id
         ORDER BY s.created_at DESC
         LIMIT 5`
      );

      res.json({
        success: true,
        data: sales
      });
    } catch (error) {
      console.error('Error fetching recent sales:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch recent sales'
      });
    }
  }

  // Get low stock items (including out of stock)
  static async getLowStockItems(req, res) {
    try {
      const pool = getPool();

      const [items] = await pool.execute(
        `SELECT p.product_id, p.name, i.stock as remaining, i.reorder_point as threshold
         FROM products p
         JOIN inventory i ON p.product_id = i.product_id
         WHERE i.stock <= i.reorder_point
         AND p.status = 'Active'
         ORDER BY i.stock ASC`
      );

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('Error fetching low stock items:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch low stock items'
      });
    }
  }

  // Get daily sales for the last 7 days
  static async getDailySales(req, res) {
    try {
      const pool = getPool();

      const { period = 'week', start_date, end_date, granularity } = req.query;

      let query = '';
      let params = [];

      // If an explicit date range is provided, prioritize it
      if (start_date || end_date) {
        const groupBy = (granularity || 'day').toLowerCase();
        if (groupBy === 'month') {
          query = `
            SELECT DATE(DATE_FORMAT(created_at, '%Y-%m-01')) as date,
                   COALESCE(SUM(total), 0) as total,
                   COUNT(*) as orders
            FROM sales
            WHERE (status IS NULL OR status <> 'Cancelled')
          `;
        } else if (groupBy === 'week') {
          // Use Monday as start of week
          query = `
            SELECT DATE(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY)) as date,
                   COALESCE(SUM(total), 0) as total,
                   COUNT(*) as orders
            FROM sales
            WHERE (status IS NULL OR status <> 'Cancelled')
          `;
        } else {
          // Default: group by day
          query = `
            SELECT DATE(created_at) as date,
                   COALESCE(SUM(total), 0) as total,
                   COUNT(*) as orders
            FROM sales
            WHERE (status IS NULL OR status <> 'Cancelled')
          `;
        }

        if (start_date) {
          query += ' AND DATE(created_at) >= ?';
          params.push(start_date);
        }
        if (end_date) {
          query += ' AND DATE(created_at) <= ?';
          params.push(end_date);
        }

        if (groupBy === 'month') {
          query += ' GROUP BY YEAR(created_at), MONTH(created_at)';
        } else if (groupBy === 'week') {
          query += ' GROUP BY YEAR(created_at), WEEK(created_at, 3)';
        } else {
          query += ' GROUP BY DATE(created_at)';
        }
        query += ' ORDER BY date ASC';

      } else {
        // Backward compatible: period-based aggregation
        if (period === 'year') {
          // Aggregate by month for the last 12 months
          query = `
            SELECT DATE(DATE_FORMAT(created_at, '%Y-%m-01')) as date,
                   COALESCE(SUM(total), 0) as total,
                   COUNT(*) as orders
            FROM sales
            WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH)
              AND (status IS NULL OR status <> 'Cancelled')
            GROUP BY YEAR(created_at), MONTH(created_at)
            ORDER BY date ASC
          `;
        } else if (period === 'month') {
          // Aggregate by day for last 30 days
          query = `
            SELECT DATE(created_at) as date,
                   COALESCE(SUM(total), 0) as total,
                   COUNT(*) as orders
            FROM sales
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
              AND (status IS NULL OR status <> 'Cancelled')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `;
        } else {
          // Default week: last 7 days by day
          query = `
            SELECT DATE(created_at) as date,
                   COALESCE(SUM(total), 0) as total,
                   COUNT(*) as orders
            FROM sales
            WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
              AND (status IS NULL OR status <> 'Cancelled')
            GROUP BY DATE(created_at)
            ORDER BY date ASC
          `;
        }
      }

      const [dailySales] = await pool.execute(query, params);

      res.json({
        success: true,
        data: dailySales
      });
    } catch (error) {
      console.error('Error fetching daily sales:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch daily sales'
      });
    }
  }

  // Get fast moving products (top 5 by quantity sold in last 30 days)
  static async getFastMovingProducts(req, res) {
    try {
      const pool = getPool();

      const [products] = await pool.execute(
        `SELECT p.product_id, p.name, p.category, i.stock,
                COALESCE(SUM(si.quantity), 0) as total_sold
         FROM products p
         LEFT JOIN inventory i ON p.product_id = i.product_id
         LEFT JOIN sale_items si ON p.product_id = si.product_id
         LEFT JOIN sales s ON si.sale_id = s.id
         WHERE p.status = 'Active'
           AND (s.created_at IS NULL OR s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))
           AND (s.status IS NULL OR s.status <> 'Cancelled')
         GROUP BY p.product_id, p.name, p.category, i.stock
         HAVING total_sold > 0
         ORDER BY total_sold DESC
         LIMIT 5`
      );

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Error fetching fast moving products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch fast moving products'
      });
    }
  }

  // Get slow moving products (bottom 5 by quantity sold in last 30 days, excluding zero sales)
  static async getSlowMovingProducts(req, res) {
    try {
      const pool = getPool();

      const [products] = await pool.execute(
        `SELECT p.product_id, p.name, p.category, i.stock,
                COALESCE(SUM(si.quantity), 0) as total_sold
         FROM products p
         LEFT JOIN inventory i ON p.product_id = i.product_id
         LEFT JOIN sale_items si ON p.product_id = si.product_id
         LEFT JOIN sales s ON si.sale_id = s.id
         WHERE p.status = 'Active'
           AND (s.created_at IS NULL OR s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))
           AND (s.status IS NULL OR s.status <> 'Cancelled')
         GROUP BY p.product_id, p.name, p.category, i.stock
         HAVING total_sold > 0
         ORDER BY total_sold ASC
         LIMIT 5`
      );

      res.json({
        success: true,
        data: products
      });
    } catch (error) {
      console.error('Error fetching slow moving products:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch slow moving products'
      });
    }
  }

  // --- NEW FUNCTION ---
  // Get sales aggregated by category
  static async getSalesByCategory(req, res) {
    try {
      const pool = getPool();
      const [categories] = await pool.execute(
        `SELECT
           p.category,
           COALESCE(SUM(si.subtotal), 0) as total_revenue
         FROM products p
         JOIN sale_items si ON p.product_id = si.product_id
         JOIN sales s ON si.sale_id = s.id
         WHERE s.status <> 'Cancelled'
           AND s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
         GROUP BY p.category
         ORDER BY total_revenue DESC`
      );
      res.json({
        success: true,
        data: categories
      });
    } catch (error) {
      console.error('Error fetching sales by category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales by category'
      });
    }
  }
}