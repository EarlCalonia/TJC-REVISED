import { getPool } from '../config/database.js';

export class Product {
  static async create(productData) {
    const pool = getPool();

    const {
      name,
      brand,
      category,
      price,
      status,
      description,
      vehicle_compatibility,
      image,
      requires_serial
    } = productData;

    // Generate unique product_id
    const [maxIdResult] = await pool.execute('SELECT MAX(id) as maxId FROM products');
    const nextId = (maxIdResult[0].maxId || 0) + 1;
    const productId = `P${nextId.toString().padStart(3, '0')}`;

    const [result] = await pool.execute(
      `INSERT INTO products (product_id, name, brand, category, vehicle_compatibility, price, status, description, image, requires_serial, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [productId, name, brand, category, vehicle_compatibility || null, price, status, description, image, requires_serial ? 1 : 0]
    );

    return result.insertId;
  }

  static async findAll(filters = {}) {
    const pool = getPool();
    let query = 'SELECT * FROM products WHERE 1=1';
    let params = [];

    const { search, category, brand, status } = filters;

    if (search) {
      query += ' AND (name LIKE ? OR product_id LIKE ? OR brand LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (category && category !== 'All Categories') {
      query += ' AND category = ?';
      params.push(category);
    }

    if (brand && brand !== 'All Brand') {
      query += ' AND brand = ?';
      params.push(brand);
    }

    if (status && status !== 'All Status') {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await pool.execute(query, params);
    return rows;
  }

  static async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM products WHERE product_id = ?',
      [id]
    );
    return rows[0] || null;
  }

  static async update(id, productData) {
    const pool = getPool();

    const {
      name,
      brand,
      category,
      price,
      status,
      description,
      vehicle_compatibility,
      image,
      requires_serial
    } = productData;

    // Build dynamic update query
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (brand !== undefined) {
      updates.push('brand = ?');
      params.push(brand);
    }
    if (category !== undefined) {
      updates.push('category = ?');
      params.push(category);
    }
    if (vehicle_compatibility !== undefined) {
      updates.push('vehicle_compatibility = ?');
      params.push(vehicle_compatibility || null);
    }
    if (price !== undefined) {
      updates.push('price = ?');
      params.push(price);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (image !== undefined) {
      updates.push('image = ?');
      params.push(image);
    }

    if (requires_serial !== undefined) {
      updates.push('requires_serial = ?');
      params.push(requires_serial ? 1 : 0);
    }

    if (updates.length === 0) {
      throw new Error('No fields to update');
    }

    params.push(id); // Add id for WHERE clause

    const query = `UPDATE products SET ${updates.join(', ')}, updated_at = NOW() WHERE product_id = ?`;
    const [result] = await pool.execute(query, params);

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const pool = getPool();
    // Get product_id for the given internal id
    const [prodRows] = await pool.execute('SELECT product_id FROM products WHERE id = ?', [id]);
    if (prodRows.length === 0) return false;
    const productId = prodRows[0].product_id;

    // Check if product is referenced in sale_items (cannot delete if referenced)
    const [refRows] = await pool.execute('SELECT COUNT(*) as cnt FROM sale_items WHERE product_id = ?', [productId]);
    if ((refRows[0]?.cnt || 0) > 0) {
      const err = new Error('PRODUCT_IN_USE');
      err.code = 'PRODUCT_IN_USE';
      throw err;
    }

    const [result] = await pool.execute('DELETE FROM products WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  static async getCategories() {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT DISTINCT category FROM products ORDER BY category'
    );
    return rows.map(row => row.category);
  }

  static async getBrands() {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT name FROM brands ORDER BY name'
    );
    return rows.map(row => row.name);
  }

  // Seed sample data for development (optional, remove in production)
  static async seedSampleData() {
    const pool = getPool();

    // Check if data already exists
    const [existing] = await pool.execute('SELECT COUNT(*) as count FROM products');
    if (existing[0].count > 0) return;

    const sampleProducts = [
      { product_id: 'P001', name: 'Brake Pad Set', brand: 'Bosch', category: 'Brakes', price: 1500, status: 'Active', description: 'High-quality brake pads' },
      { product_id: 'P002', name: 'Oil Filter', brand: 'Mann', category: 'Filters', price: 500, status: 'Active', description: 'Engine oil filter' },
      { product_id: 'P003', name: 'Battery 12V', brand: 'Exide', category: 'Electrical', price: 3000, status: 'Active', description: 'Car battery' },
      { product_id: 'P004', name: 'Side Mirror', brand: 'Dorman', category: 'Body', price: 800, status: 'Active', description: 'Replacement side mirror' },
      { product_id: 'P005', name: 'Headlight Assembly', brand: 'Hella', category: 'Exterior', price: 2500, status: 'Active', description: 'LED headlight assembly' }
    ];

    for (const product of sampleProducts) {
      await pool.execute(
        `INSERT INTO products (product_id, name, brand, category, price, status, description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [product.product_id, product.name, product.brand, product.category, product.price, product.status, product.description]
      );
    }
  }
}
