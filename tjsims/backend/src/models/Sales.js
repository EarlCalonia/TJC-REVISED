import { getPool } from '../config/database.js';

export class Sales {
  static async create(salesData) {
    const pool = getPool();

    const {
      customer_name,
      contact,
      payment,
      payment_status,
      delivery_type, // FIX: Added this
      total,
      items
    } = salesData;

    // Generate unique sale_number
    const saleNumber = await this.generateSaleNumber();

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // Insert sale record
      // FIX: Added delivery_type column and value
      const [saleResult] = await connection.execute(
        `INSERT INTO sales (sale_number, customer_name, contact, payment, payment_status, status, address, delivery_type, total, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          saleNumber, 
          customer_name, 
          contact, 
          payment, 
          payment_status || 'Unpaid', 
          salesData.status || 'Pending', 
          salesData.address || null, 
          delivery_type || 'In-store', // Default to In-store
          total
        ]
      );

      const saleId = saleResult.insertId;

      // Insert sale items and update inventory
      for (const item of items) {
        const { product_id, product_name, brand, price, quantity, serialNumbers } = item;
        const subtotal = price * quantity;

        // Insert sale item
        const [itemResult] = await connection.execute(
          `INSERT INTO sale_items (sale_id, product_id, product_name, brand, price, quantity, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [saleId, product_id, product_name, brand, price, quantity, subtotal]
        );
        
        const saleItemId = itemResult.insertId;

        // Mark serial numbers as sold
        if (serialNumbers && serialNumbers.length > 0) {
          for (const sn of serialNumbers) {
            const [updateResult] = await connection.execute(
              `UPDATE serial_numbers 
               SET status = 'sold', sale_id = ?, sale_item_id = ? 
               WHERE serial_number = ? AND status = 'available'`,
              [saleId, saleItemId, sn]
            );
            
            if (updateResult.affectedRows === 0) {
              throw new Error(`Serial number ${sn} is not available or does not exist.`);
            }
          }
        }

        // Deduct from inventory
        await this.updateInventory(connection, product_id, quantity);
      }

      await connection.commit();
      return { saleId, saleNumber };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async generateSaleNumber() {
    const pool = getPool();
    const date = new Date();
    const dateStr = date.getFullYear().toString().substr(-2) +
                    (date.getMonth() + 1).toString().padStart(2, '0') +
                    date.getDate().toString().padStart(2, '0');

    const [lastSale] = await pool.execute(
      'SELECT sale_number FROM sales WHERE sale_number LIKE ? ORDER BY id DESC LIMIT 1',
      [`SL${dateStr}%`]
    );

    let sequence = 1;
    if (lastSale.length > 0) {
      const lastNumber = lastSale[0].sale_number;
      const lastSequence = parseInt(lastNumber.substr(-3));
      sequence = lastSequence + 1;
    }

    return `SL${dateStr}${sequence.toString().padStart(3, '0')}`;
  }

  static async updateInventory(connection, productId, quantity) {
    const [inventory] = await connection.execute(
      'SELECT stock FROM inventory WHERE product_id = ?',
      [productId]
    );

    if (inventory.length === 0) {
      throw new Error(`No inventory found for product ${productId}`);
    }

    const currentStock = inventory[0].stock;

    if (currentStock < quantity) {
      throw new Error(`Insufficient stock for product ${productId}. Available: ${currentStock}, Requested: ${quantity}`);
    }

    await connection.execute(
      'UPDATE inventory SET stock = stock - ?, updated_at = NOW() WHERE product_id = ?',
      [quantity, productId]
    );

    const transactionId = `TXN${Date.now()}`;
    await connection.execute(
      `INSERT INTO inventory_transactions (transaction_id, inventory_id, product_id, transaction_type, quantity, notes, transaction_date, created_by)
       VALUES (?, (SELECT id FROM inventory WHERE product_id = ?), ?, 'out', ?, 'Sale deduction', NOW(), 'System')`,
      [transactionId, productId, productId, quantity]
    );
  }

  static async findAll(filters = {}) {
    const pool = getPool();
    let query = `
      SELECT s.*, COUNT(si.id) as item_count,
             SUM(si.subtotal) as calculated_total
      FROM sales s
      LEFT JOIN sale_items si ON s.id = si.sale_id
      WHERE 1=1 AND (s.status IS NULL OR s.status <> 'Cancelled')
    `;
    let params = [];

    const { search, date_from, date_to } = filters;

    if (search) {
      query += ' AND (s.sale_number LIKE ? OR s.customer_name LIKE ? OR s.contact LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (date_from) {
      query += ' AND DATE(s.created_at) >= ?';
      params.push(date_from);
    }

    if (date_to) {
      query += ' AND DATE(s.created_at) <= ?';
      params.push(date_to);
    }

    query += ' GROUP BY s.id ORDER BY s.created_at DESC';

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM sales WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async findBySaleNumber(saleNumber) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM sales WHERE sale_number = ?',
      [saleNumber]
    );
    return rows[0] || null;
  }

  static async getSaleItems(saleId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id',
      [saleId]
    );
    return rows;
  }

  static async update(id, salesData) {
    const pool = getPool();

    const {
      customer_name,
      contact,
      payment,
      payment_status,
      address,
      total,
      status
    } = salesData;

    const updates = [];
    const params = [];

    if (customer_name !== undefined) {
      updates.push('customer_name = ?');
      params.push(customer_name);
    }
    if (contact !== undefined) {
      updates.push('contact = ?');
      params.push(contact);
    }
    if (payment !== undefined) {
      updates.push('payment = ?');
      params.push(payment);
    }
    if (payment_status !== undefined) {
      updates.push('payment_status = ?');
      params.push(payment_status);
    }
    if (address !== undefined) {
      updates.push('address = ?');
      params.push(address);
    }
    if (total !== undefined) {
      updates.push('total = ?');
      params.push(total);
    }
    if (status !== undefined) { 
      updates.push('status = ?');
      params.push(status);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id);

    const query = `UPDATE sales SET ${updates.join(', ')} WHERE id = ?`;
    const [result] = await pool.execute(query, params);

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const pool = getPool();
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const saleItems = await this.getSaleItems(id);

      for (const item of saleItems) {
        await connection.execute(
          'UPDATE inventory SET stock = stock + ?, updated_at = NOW() WHERE product_id = ?',
          [item.quantity, item.product_id]
        );
      }

      await connection.execute('DELETE FROM sale_items WHERE sale_id = ?', [id]);
      const [result] = await connection.execute('DELETE FROM sales WHERE id = ?', [id]);

      await connection.commit();
      return result.affectedRows > 0;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async attachDeliveryProof(id, proofPath) {
    const pool = getPool();
    await pool.execute("ALTER TABLE sales ADD COLUMN IF NOT EXISTS delivery_proof VARCHAR(255) NULL");
    const [result] = await pool.execute(
      'UPDATE sales SET delivery_proof = ? WHERE id = ?',
      [proofPath, id]
    );
    return result.affectedRows > 0;
  }

  static async getSalesStats(dateFrom, dateTo) {
    const pool = getPool();
    let query = `
      SELECT
        COUNT(*) as total_sales,
        SUM(total) as total_revenue,
        AVG(total) as average_sale,
        COUNT(CASE WHEN DATE(created_at) = CURDATE() THEN 1 END) as today_sales
      FROM sales
      WHERE 1=1
    `;
    let params = [];

    if (dateFrom) {
      query += ' AND DATE(created_at) >= ?';
      params.push(dateFrom);
    }

    if (dateTo) {
      query += ' AND DATE(created_at) <= ?';
      params.push(dateTo);
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
  }
}