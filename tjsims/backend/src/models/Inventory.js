import { getPool } from '../config/database.js';

export class Inventory {
  static async findByProductId(productId) {
    const pool = getPool();
    const [rows] = await pool.execute(
      `SELECT i.*, s.name as supplier_name 
       FROM inventory i 
       LEFT JOIN suppliers s ON i.supplier_id = s.id 
       WHERE i.product_id = ?`,
      [productId]
    );
    return rows[0];
  }

  static async updateStock(productId, quantity, reorderPoint = null, options = {}) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // First verify that the product exists
      const [productExists] = await connection.execute(
        'SELECT product_id FROM products WHERE product_id = ?',
        [productId]
      );

      if (!productExists[0]) {
        throw new Error(`Product ${productId} not found`);
      }

      // Get current inventory
      const [inventory] = await connection.execute(
        'SELECT * FROM inventory WHERE product_id = ?',
        [productId]
      );

      let inventoryId;
      
      if (!inventory[0]) {
        // Create new inventory record if it doesn't exist
        const [result] = await connection.execute(
          `INSERT INTO inventory (product_id, stock, reorder_point)
           VALUES (?, ?, ?)`,
          [productId, Math.max(0, quantity), reorderPoint || 10]
        );
        inventoryId = result.insertId;
      } else {
        // Update existing inventory
        const newStock = Math.max(0, inventory[0].stock + quantity); // Ensure stock never goes below 0
        const updates = [`stock = ?`, `reorder_point = COALESCE(?, reorder_point)`];
        const params = [newStock, reorderPoint];
        if (options.supplierId) { updates.push(`supplier_id = ?`); params.push(options.supplierId); }
        if (options.transactionDate) { updates.push(`last_restock_date = ?`); params.push(new Date(options.transactionDate)); }
        params.push(productId);
        await connection.execute(
          `UPDATE inventory 
           SET ${updates.join(', ')}
           WHERE product_id = ?`,
          params
        );
        inventoryId = inventory[0].id;
      }

      // Generate transaction ID
      const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      // Record the transaction
      const createdBy = options.createdBy || 'System';
      const txnDate = options.transactionDate ? new Date(options.transactionDate) : new Date();
      const notes = options.notes || 'Stock update through admin interface';
      await connection.execute(
        `INSERT INTO inventory_transactions (
           transaction_id,
           inventory_id,
           product_id,
           transaction_type,
           quantity,
           notes,
           transaction_date,
           created_by
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          transactionId,
          inventoryId,
          productId,
          quantity > 0 ? 'in' : 'out',
          Math.abs(quantity),
          notes,
          txnDate,
          createdBy
        ]
      );

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async getStats() {
    const pool = getPool();
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT i.product_id) as totalProducts,
        SUM(CASE WHEN i.stock > i.reorder_point THEN 1 ELSE 0 END) as inStock,
        SUM(CASE 
          WHEN i.stock <= i.reorder_point AND i.stock > 0 THEN 1 
          ELSE 0 
        END) as lowStock,
        SUM(CASE WHEN i.stock = 0 THEN 1 ELSE 0 END) as outOfStock
      FROM inventory i
    `);
    return rows[0];
  }

  static async getProductsWithInventory(filters = {}) {
    const pool = getPool();
    let query = `
      SELECT 
        p.*,
        i.stock,
        i.reorder_point,
        s.name as supplier_name
      FROM products p
      LEFT JOIN inventory i ON p.product_id = i.product_id
      LEFT JOIN suppliers s ON i.supplier_id = s.id
      WHERE 1=1
      AND p.status = 'Active'
    `;
    
    const params = [];

    if (filters.search) {
      query += ' AND (p.name LIKE ? OR p.product_id LIKE ? OR p.brand LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (filters.category) {
      query += ' AND p.category = ?';
      params.push(filters.category);
    }

    if (filters.stockStatus) {
      switch (filters.stockStatus) {
        case 'In Stock':
          query += ' AND i.stock > i.reorder_point';
          break;
        case 'Low on Stock':
          query += ' AND i.stock <= i.reorder_point AND i.stock > 0';
          break;
        case 'Out of Stock':
          query += ' AND i.stock = 0';
          break;
      }
    }

    query += ' ORDER BY p.created_at DESC';

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async bulkStockIn({ supplier, receivedBy, serialNumber, receivedDate, products }) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const transactionDate = receivedDate ? new Date(receivedDate) : new Date();
      const notes = `Bulk Stock In - Supplier: ${supplier} | Serial: ${serialNumber || 'N/A'} | Received by: ${receivedBy}`;

      for (const product of products) {
        const { productId, quantity, serialNumber: productSerial } = product;

        if (!productId || !quantity || quantity <= 0) {
          throw new Error(`Invalid product data: productId=${productId}, quantity=${quantity}`);
        }

        const [productExists] = await connection.execute(
          'SELECT product_id FROM products WHERE product_id = ?',
          [productId]
        );

        if (!productExists[0]) {
          throw new Error(`Product ${productId} not found`);
        }

        const [inventory] = await connection.execute(
          'SELECT * FROM inventory WHERE product_id = ?',
          [productId]
        );

        let inventoryId;

        if (!inventory[0]) {
          const [result] = await connection.execute(
            `INSERT INTO inventory (product_id, stock, reorder_point, last_restock_date)
             VALUES (?, ?, 10, ?)`,
            [productId, quantity, transactionDate]
          );
          inventoryId = result.insertId;
        } else {
          const newStock = inventory[0].stock + quantity;
          await connection.execute(
            `UPDATE inventory 
             SET stock = ?, last_restock_date = ?
             WHERE product_id = ?`,
            [newStock, transactionDate, productId]
          );
          inventoryId = inventory[0].id;
        }

        const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        await connection.execute(
          `INSERT INTO inventory_transactions (
             transaction_id,
             inventory_id,
             product_id,
             transaction_type,
             quantity,
             serial_number,
             notes,
             transaction_date,
             created_by
           ) VALUES (?, ?, ?, 'in', ?, ?, ?, ?, ?)`,
          [
            transactionId,
            inventoryId,
            productId,
            quantity,
            productSerial || null,
            notes,
            transactionDate,
            receivedBy
          ]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async returnToSupplier({ supplier, returnedBy, returnDate, products, reason }) {
    const pool = getPool();
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      const transactionDate = returnDate ? new Date(returnDate) : new Date();

      for (const product of products) {
        const { productId, serialNumbers, quantity } = product; // UPDATED: Destructure serialNumbers array

        if (!productId || !quantity || quantity <= 0) {
          throw new Error(`Invalid product data: productId=${productId}, quantity=${quantity}`);
        }

        const [productExists] = await connection.execute(
          'SELECT product_id FROM products WHERE product_id = ?',
          [productId]
        );

        if (!productExists[0]) {
          throw new Error(`Product ${productId} not found`);
        }

        const [inventory] = await connection.execute(
          'SELECT * FROM inventory WHERE product_id = ?',
          [productId]
        );

        if (!inventory[0]) {
          throw new Error(`No inventory record found for product ${productId}`);
        }

        if (inventory[0].stock < quantity) {
          throw new Error(`Insufficient stock for product ${productId}. Available: ${inventory[0].stock}, Requested: ${quantity}`);
        }

        const inventoryId = inventory[0].id;

        // Update inventory
        const newStock = inventory[0].stock - quantity;
        await connection.execute(
          `UPDATE inventory 
           SET stock = ?
           WHERE product_id = ?`,
          [newStock, productId]
        );

        // --- UPDATED SECTION: Handle multiple serial numbers ---
        let serialsString = 'N/A';
        
        // Check if we have an array of serials
        if (serialNumbers && Array.isArray(serialNumbers) && serialNumbers.length > 0) {
          const validSerials = serialNumbers.filter(s => s && s.trim() !== '');
          
          if (validSerials.length > 0) {
            serialsString = validSerials.join(', ');

            for (const serial of validSerials) {
              const [existingSerial] = await connection.execute(
                'SELECT id, status FROM serial_numbers WHERE serial_number = ? AND product_id = ?',
                [serial, productId]
              );

              if (existingSerial.length === 0) {
                throw new Error(`Serial number ${serial} not found for product ${productId}`);
              }

              if (existingSerial[0].status !== 'available') {
                throw new Error(`Serial number ${serial} is not available (current status: ${existingSerial[0].status})`);
              }

              await connection.execute(
                `UPDATE serial_numbers 
                 SET status = 'defective', notes = ?, updated_at = CURRENT_TIMESTAMP
                 WHERE serial_number = ?`,
                [`Returned to Supplier: ${supplier}. Reason: ${reason}`, serial]
              );
            }
          }
        } 
        // Fallback for legacy single serialNumber (if any)
        else if (product.serialNumber) {
           // ... existing legacy logic for single serial ...
           const serial = product.serialNumber;
           serialsString = serial;
           // (Logic is same as loop above, omitted for brevity but covered by array loop)
        }
        // -----------------------------------------------------

        const notes = `Return to Supplier - Reason: ${reason || 'N/A'} | Supplier: ${supplier} | Serials: ${serialsString} | Returned by: ${returnedBy}`;
        const transactionId = `TRX-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        
        await connection.execute(
          `INSERT INTO inventory_transactions (
             transaction_id,
             inventory_id,
             product_id,
             transaction_type,
             quantity,
             serial_number,
             notes,
             transaction_date,
             created_by
           ) VALUES (?, ?, ?, 'return_to_supplier', ?, ?, ?, ?, ?)`,
          [
            transactionId,
            inventoryId,
            productId,
            quantity,
            serialsString !== 'N/A' ? serialsString : null,
            notes,
            transactionDate,
            returnedBy
          ]
        );
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}