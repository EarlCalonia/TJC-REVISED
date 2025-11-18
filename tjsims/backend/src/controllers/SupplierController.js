import { Supplier } from '../models/Supplier.js';

export class SupplierController {
  static async getAllSuppliers(req, res) {
    try {
      const suppliers = await Supplier.findAll();
      res.json({ success: true, data: suppliers });
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createSupplier(req, res) {
    try {
      const id = await Supplier.create(req.body);
      res.status(201).json({ success: true, message: 'Supplier created successfully', data: { id } });
    } catch (error) {
      console.error('Error creating supplier:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateSupplier(req, res) {
    try {
      const { id } = req.params;
      await Supplier.update(id, req.body);
      res.json({ success: true, message: 'Supplier updated successfully' });
    } catch (error) {
      console.error('Error updating supplier:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async deleteSupplier(req, res) {
    try {
      const { id } = req.params;
      await Supplier.delete(id);
      res.json({ success: true, message: 'Supplier deleted successfully' });
    } catch (error) {
      console.error('Error deleting supplier:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  }
}