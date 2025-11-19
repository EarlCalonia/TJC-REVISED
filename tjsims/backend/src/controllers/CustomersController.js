import { getPool } from '../config/database.js';

export class CustomersController {
  static async list(req, res) {
    try {
      const { search } = req.query;
      const pool = getPool();

      let query = `
        SELECT DISTINCT customer_name, contact, address
        FROM sales
        WHERE customer_name IS NOT NULL AND customer_name <> ''
      `;
      const params = [];

      if (search) {
        const like = `%${search}%`;
        query += ' AND (customer_name LIKE ? OR contact LIKE ?)';
        params.push(like, like);
      }

      query += ' ORDER BY customer_name ASC';

      const [rows] = await pool.execute(query, params);

      res.json({
        success: true,
        data: rows
      });
    } catch (error) {
      console.error('List customers error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch customers'
      });
    }
  }
}
