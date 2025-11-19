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

      // Low stock items count (including out of stock)
      const [lowStock] = await pool.execute(
        `SELECT COUNT(*) as count
         FROM products p
         JOIN inventory i ON p.product_id = i.product_id
         WHERE i.stock <= i.reorder_point`
      );

      // UPDATED: Pending orders count (Only count Pending and Processing)
      // Previously this counted everything NOT Completed/Cancelled, which wrongly included Returns.
      const [pendingOrders] = await pool.execute(
        `SELECT COUNT(*) as count FROM sales WHERE status IN ('Pending', 'Processing')`
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

  // Get low stock items
  // Get low stock items
static async getLowStockItems(req, res) {
  try {
    const pool = getPool();

    // REVISION: Used LEFT JOIN and COALESCE to catch products with NO inventory record (effectively 0 stock)
    const [items] = await pool.execute(
      `SELECT 
          p.product_id, 
          p.name, 
          COALESCE(i.stock, 0) as remaining, 
          COALESCE(i.reorder_point, 10) as threshold
       FROM products p
       LEFT JOIN inventory i ON p.product_id = i.product_id
       WHERE 
         p.status = 'Active' AND (
           COALESCE(i.stock, 0) = 0 
           OR 
           COALESCE(i.stock, 0) <= COALESCE(i.reorder_point, 10)
         )
       ORDER BY remaining ASC`
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
  // Get daily sales
  static async getDailySales(req, res) {
    try {
      const pool = getPool();
      const { period = 'week', start_date, end_date, granularity } = req.query;

      let query = '';
      let params = [];

      if (start_date || end_date) {
        const groupBy = (granularity || 'day').toLowerCase();
        let groupClause = 'GROUP BY DATE(created_at)';
        let selectDate = 'DATE(created_at) as date';

        if (groupBy === 'month') {
           selectDate = "DATE(DATE_FORMAT(created_at, '%Y-%m-01')) as date";
           groupClause = 'GROUP BY YEAR(created_at), MONTH(created_at)';
        } else if (groupBy === 'week') {
           selectDate = "DATE(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY)) as date";
           groupClause = 'GROUP BY YEAR(created_at), WEEK(created_at, 3)';
        }

        query = `
            SELECT ${selectDate},
                   COALESCE(SUM(total), 0) as total,
                   COUNT(*) as orders
            FROM sales
            WHERE (status IS NULL OR status <> 'Cancelled')
        `;

        if (start_date) {
          query += ' AND DATE(created_at) >= ?';
          params.push(start_date);
        }
        if (end_date) {
          query += ' AND DATE(created_at) <= ?';
          params.push(end_date);
        }

        query += ` ${groupClause} ORDER BY date ASC`;

      } else {
        // Default period logic
        if (period === 'year') {
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

  // Get fast moving products
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

  // Get slow moving products
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