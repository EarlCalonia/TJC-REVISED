import { getPool } from '../config/database.js';

export class Supplier {
  static async findAll() {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM suppliers ORDER BY name'
    );
    return rows;
  }

  static async findById(id) {
    const pool = getPool();
    const [rows] = await pool.execute(
      'SELECT * FROM suppliers WHERE id = ?',
      [id]
    );
    return rows[0];
  }

  static async create(supplierData) {
    const pool = getPool();
    const {
      name,
      contact_person,
      email,
      phone,
      address
    } = supplierData;

    // Generate unique supplier_id (SUP-001)
    const [maxIdResult] = await pool.execute('SELECT MAX(id) as maxId FROM suppliers');
    const nextId = (maxIdResult[0].maxId || 0) + 1;
    const supplierId = `SUP-${nextId.toString().padStart(3, '0')}`;

    const [result] = await pool.execute(
      `INSERT INTO suppliers (supplier_id, name, contact_person, email, phone, address, status)
       VALUES (?, ?, ?, ?, ?, ?, 'Active')`,
      [supplierId, name, contact_person, email, phone, address]
    );

    return result.insertId;
  }

  static async update(id, supplierData) {
    const pool = getPool();
    const {
      name,
      contact_person,
      email,
      phone,
      address,
      status
    } = supplierData;

    const [result] = await pool.execute(
      `UPDATE suppliers 
       SET name = ?, 
           contact_person = ?,
           email = ?,
           phone = ?,
           address = ?,
           status = ?
       WHERE id = ?`,
      [name, contact_person, email, phone, address, status || 'Active', id]
    );

    return result.affectedRows > 0;
  }

  static async delete(id) {
    const pool = getPool();
    const [result] = await pool.execute(
      'DELETE FROM suppliers WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}