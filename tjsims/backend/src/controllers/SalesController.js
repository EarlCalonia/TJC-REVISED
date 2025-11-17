import { Sales } from '../models/Sales.js';
import { SaleItem } from '../models/SaleItem.js';
import { Product } from '../models/Product.js';

export class SalesController {
  // Create a new sale
  static async createSale(req, res) {
    try {
      // FIX: Added delivery_type to destructuring
      const { customer_name, contact, payment, payment_status, status, address, delivery_type, items } = req.body;

      // Validate required fields
      if (!customer_name || !payment || !items || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Customer name, payment method, and items are required'
        });
      }

      // Validate and enrich items with product data
      let total = 0;
      const enrichedItems = [];

      for (const item of items) {
        const { product_id, quantity, serialNumbers } = item;

        if (!product_id || !quantity || quantity <= 0) {
          return res.status(400).json({
            success: false,
            message: `Invalid product_id or quantity for item`
          });
        }

        // Get product details
        const product = await Product.findById(product_id);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found: ${product_id}`
          });
        }

        const subtotal = product.price * quantity;
        total += subtotal;

        enrichedItems.push({
          product_id: product.product_id,
          product_name: product.name,
          brand: product.brand,
          price: product.price,
          quantity: quantity,
          serialNumbers: serialNumbers || []
        });
      }

      // Create the sale
      const saleData = {
        customer_name,
        contact,
        payment,
        payment_status,
        status,
        address,
        delivery_type, // FIX: Included delivery_type in saleData
        total,
        items: enrichedItems
      };

      const { saleId, saleNumber } = await Sales.create(saleData);

      res.status(201).json({
        success: true,
        message: 'Sale created successfully',
        data: {
          id: saleId,
          sale_number: saleNumber,
          total: total
        }
      });
    } catch (error) {
      console.error('Error creating sale:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create sale'
      });
    }
  }

  // Get all sales with optional filters
  static async getAllSales(req, res) {
    try {
      // FIX: Added delivery_type to query parameters
      const { search, date_from, date_to, delivery_type, page = 1, limit = 10 } = req.query;

      const offset = (page - 1) * limit;

      // Construct queries
      let countQuery = "SELECT COUNT(*) as total FROM sales WHERE 1=1 AND (status IS NULL OR status <> 'Cancelled')";
      let countParams = [];

      let query = "SELECT * FROM sales WHERE 1=1 AND (status IS NULL OR status <> 'Cancelled')";
      let params = [];

      if (search) {
        const searchTerm = `%${search}%`;
        query += ' AND (sale_number LIKE ? OR customer_name LIKE ? OR contact LIKE ?)';
        params.push(searchTerm, searchTerm, searchTerm);
        countQuery += ' AND (sale_number LIKE ? OR customer_name LIKE ? OR contact LIKE ?)';
        countParams.push(searchTerm, searchTerm, searchTerm);
      }

      if (date_from) {
        query += ' AND DATE(created_at) >= ?';
        params.push(date_from);
        countQuery += ' AND DATE(created_at) >= ?';
        countParams.push(date_from);
      }

      if (date_to) {
        query += ' AND DATE(created_at) <= ?';
        params.push(date_to);
        countQuery += ' AND DATE(created_at) <= ?';
        countParams.push(date_to);
      }

      // FIX: Add delivery_type filter logic
      if (delivery_type) {
        query += ' AND delivery_type = ?';
        params.push(delivery_type);
        countQuery += ' AND delivery_type = ?';
        countParams.push(delivery_type);
      }

      const { getPool } = await import('../config/database.js');
      const pool = getPool();
      
      // Get total count
      const [totalResult] = await pool.execute(countQuery, countParams);
      const total = totalResult[0].total;
      const totalPages = Math.ceil(total / limit);

      // Get paginated data
      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(limit), parseInt(offset));

      const [sales] = await pool.execute(query, params);

      res.json({
        success: true,
        data: {
          sales,
          pagination: {
            current_page: parseInt(page),
            per_page: parseInt(limit),
            total,
            total_pages: totalPages,
            from: offset + 1,
            to: Math.min(offset + parseInt(limit), total)
          }
        }
      });
    } catch (error) {
      console.error('Error fetching sales:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales'
      });
    }
  }

  // Get a specific sale with its items
  static async getSaleById(req, res) {
    try {
      const { id } = req.params;

      const sale = await Sales.findById(id);
      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      const saleItems = await Sales.getSaleItems(id);

      res.json({
        success: true,
        data: {
          ...sale,
          items: saleItems
        }
      });
    } catch (error) {
      console.error('Error fetching sale:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sale'
      });
    }
  }

  // Update a sale
  static async updateSale(req, res) {
    try {
      const { id } = req.params;
      const { customer_name, contact, payment, payment_status, total, status } = req.body;

      const currentSale = await Sales.findById(id);
      if (!currentSale) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      if (currentSale.status === 'Completed' || currentSale.status === 'Cancelled') {
        return res.status(400).json({
          success: false,
          message: `Cannot update order - order is already ${currentSale.status} and cannot be modified`
        });
      }

      const updateData = {};
      if (customer_name !== undefined) updateData.customer_name = customer_name;
      if (contact !== undefined) updateData.contact = contact;
      if (payment !== undefined) updateData.payment = payment;
      if (payment_status !== undefined) updateData.payment_status = payment_status;
      if (total !== undefined) updateData.total = total;
      if (status !== undefined) updateData.status = status;

      const nextPaymentStatus = (payment_status !== undefined ? payment_status : (currentSale.payment_status || 'Unpaid'));
      const nextOrderStatus = (status !== undefined ? status : currentSale.status);
      
      if (nextOrderStatus === 'Completed' && nextPaymentStatus !== 'Paid') {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark order as Completed unless payment status is Paid'
        });
      }

      const updated = await Sales.update(id, updateData);

      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found or no changes made'
        });
      }

      res.json({
        success: true,
        message: 'Sale updated successfully'
      });
    } catch (error) {
      console.error('Error updating sale:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update sale'
      });
    }
  }

  // Delete a sale
  static async deleteSale(req, res) {
    try {
      const { id } = req.params;

      const deleted = await Sales.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      res.json({
        success: true,
        message: 'Sale deleted successfully and inventory restored'
      });
    } catch (error) {
      console.error('Error deleting sale:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to delete sale'
      });
    }
  }

  // Get sales statistics
  static async getSalesStats(req, res) {
    try {
      const { date_from, date_to } = req.query;

      const stats = await Sales.getSalesStats(date_from, date_to);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching sales stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sales statistics'
      });
    }
  }

  // Get sale items
  static async getSaleItems(req, res) {
    try {
      const { sale_id } = req.params;

      const sale = await Sales.findById(sale_id);
      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      const items = await Sales.getSaleItems(sale_id);

      res.json({
        success: true,
        data: items
      });
    } catch (error) {
      console.error('Error fetching sale items:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch sale items'
      });
    }
  }

  // Upload delivery proof
  static async uploadDeliveryProof(req, res) {
    try {
      const { id } = req.params;
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No delivery proof image provided'
        });
      }

      const sale = await Sales.findById(id);
      if (!sale) {
        return res.status(404).json({
          success: false,
          message: 'Sale not found'
        });
      }

      const proofPath = `/uploads/${req.file.filename}`;
      await Sales.attachDeliveryProof(id, proofPath);

      res.json({
        success: true,
        message: 'Delivery proof uploaded successfully',
        data: { proofPath }
      });
    } catch (error) {
      console.error('Error uploading delivery proof:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload delivery proof'
      });
    }
  }
}