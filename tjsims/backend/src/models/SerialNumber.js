import { getPool } from '../config/database.js';

export class SerialNumber {
  // Create a new serial number
  static async create({ serialNumber, productId, notes = null, supplierId = null }) {
    const pool = getPool();
    const [result] = await pool.execute(
      `INSERT INTO serial_numbers (serial_number, product_id, status, notes, supplier_id)
       VALUES (?, ?, 'available', ?, ?)`,
      [serialNumber, productId, notes, supplierId]
    );
    return result.insertId;
  }

  // Bulk create serial numbers
  static async bulkCreate(serialNumbers) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Check for existing serial numbers per product
      const duplicates = [];
      for (const sn of serialNumbers) {
        const [existing] = await connection.execute(
          `SELECT serial_number FROM serial_numbers 
           WHERE serial_number = ? AND product_id = ?`,
          [sn.serialNumber, sn.productId]
        );

        if (existing.length > 0) {
          duplicates.push(sn.serialNumber);
        }
      }

      if (duplicates.length > 0) {
        throw new Error(`Serial number(s) already exist for this product: ${duplicates.join(', ')}`);
      }

      const createdIds = [];
      for (const sn of serialNumbers) {
        const [result] = await connection.execute(
          `INSERT INTO serial_numbers (serial_number, product_id, status, notes, supplier_id)
           VALUES (?, ?, 'available', ?, ?)`,
          [sn.serialNumber, sn.productId, sn.notes || null, sn.supplierId || null]
        );
        createdIds.push(result.insertId);
      }

      await connection.commit();
      return createdIds;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get available serial numbers for a product
  static async getAvailableByProductId(productId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM serial_numbers 
       WHERE product_id = ? AND status = 'available'
       ORDER BY created_at DESC`,
      [productId]
    );
    return rows;
  }

  // Get all serial numbers for a product (any status)
  static async getAllByProductId(productId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM serial_numbers 
       WHERE product_id = ?
       ORDER BY created_at DESC`,
      [productId]
    );
    return rows;
  }

  // Get serial number by serial number string
  static async findBySerialNumber(serialNumber) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT * FROM serial_numbers WHERE serial_number = ?`,
      [serialNumber]
    );
    return rows[0];
  }

  // Mark serial numbers as sold
  static async markAsSold(serialNumbers, saleId, saleItemId) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const sn of serialNumbers) {
        await connection.execute(
          `UPDATE serial_numbers 
           SET status = 'sold', sale_id = ?, sale_item_id = ?, updated_at = CURRENT_TIMESTAMP
           WHERE serial_number = ? AND status = 'available'`,
          [saleId, saleItemId, sn]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Mark serial numbers as returned
  static async markAsReturned(serialNumbers) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const sn of serialNumbers) {
        await connection.execute(
          `UPDATE serial_numbers 
           SET status = 'returned', sale_id = NULL, sale_item_id = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE serial_number = ?`,
          [sn]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Mark serial numbers as available (for restocking)
  static async markAsAvailable(serialNumbers) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const sn of serialNumbers) {
        await connection.execute(
          `UPDATE serial_numbers 
           SET status = 'available', sale_id = NULL, sale_item_id = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE serial_number = ?`,
          [sn]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Mark serial numbers as defective
  static async markAsDefective(serialNumbers, notes = null) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const sn of serialNumbers) {
        await connection.execute(
          `UPDATE serial_numbers 
           SET status = 'defective', notes = ?, updated_at = CURRENT_TIMESTAMP
           WHERE serial_number = ?`,
          [notes, sn]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Delete serial numbers
  static async delete(serialNumbers) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      for (const sn of serialNumbers) {
        await connection.execute(
          `DELETE FROM serial_numbers WHERE serial_number = ?`,
          [sn]
        );
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Get serial numbers by sale ID
  static async getBySaleId(saleId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT sn.*, p.name as product_name, p.brand
       FROM serial_numbers sn
       JOIN products p ON sn.product_id = p.product_id
       WHERE sn.sale_id = ?
       ORDER BY sn.created_at DESC`,
      [saleId]
    );
    return rows;
  }

  // Check if serial number exists
  static async exists(serialNumber) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT COUNT(*) as count FROM serial_numbers WHERE serial_number = ?`,
      [serialNumber]
    );
    return rows[0].count > 0;
  }
}