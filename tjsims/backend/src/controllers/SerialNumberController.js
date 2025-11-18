import { SerialNumber } from '../models/SerialNumber.js';

export const SerialNumberController = {
  // Get available serial numbers for a product
  getAvailableSerials: async (req, res) => {
    try {
      const { productId } = req.params;

      const serials = await SerialNumber.getAvailableByProductId(productId);

      res.json({
        success: true,
        data: serials
      });
    } catch (error) {
      console.error('Error fetching available serials:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get all serial numbers for a product
  getAllSerials: async (req, res) => {
    try {
      const { productId } = req.params;

      const serials = await SerialNumber.getAllByProductId(productId);

      res.json({
        success: true,
        data: serials
      });
    } catch (error) {
      console.error('Error fetching serials:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Create serial numbers
  createSerials: async (req, res) => {
    try {
      const { serialNumbers } = req.body;

      if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Serial numbers array is required'
        });
      }

      // Validate each serial number
      for (const sn of serialNumbers) {
        if (!sn.serialNumber || !sn.productId) {
          return res.status(400).json({
            success: false,
            message: 'Each serial number must have serialNumber and productId'
          });
        }
      }

      // bulkCreate will handle duplicate checking within a transaction
      const ids = await SerialNumber.bulkCreate(serialNumbers);

      res.json({
        success: true,
        message: `Successfully created ${ids.length} serial number(s)`,
        data: { ids }
      });
    } catch (error) {
      console.error('Error creating serials:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Mark serial numbers as sold
  markAsSold: async (req, res) => {
    try {
      const { serialNumbers, saleId, saleItemId } = req.body;

      if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Serial numbers array is required'
        });
      }

      if (!saleId) {
        return res.status(400).json({
          success: false,
          message: 'Sale ID is required'
        });
      }

      await SerialNumber.markAsSold(serialNumbers, saleId, saleItemId);

      res.json({
        success: true,
        message: `Successfully marked ${serialNumbers.length} serial number(s) as sold`
      });
    } catch (error) {
      console.error('Error marking serials as sold:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Mark serial numbers as defective
  markAsDefective: async (req, res) => {
    try {
      const { serialNumbers, notes } = req.body;

      if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Serial numbers array is required'
        });
      }

      await SerialNumber.markAsDefective(serialNumbers, notes);

      res.json({
        success: true,
        message: `Successfully marked ${serialNumbers.length} serial number(s) as defective`
      });
    } catch (error) {
      console.error('Error marking serials as defective:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Delete serial numbers
  deleteSerials: async (req, res) => {
    try {
      const { serialNumbers } = req.body;

      if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Serial numbers array is required'
        });
      }

      await SerialNumber.delete(serialNumbers);

      res.json({
        success: true,
        message: `Successfully deleted ${serialNumbers.length} serial number(s)`
      });
    } catch (error) {
      console.error('Error deleting serials:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  },

  // Get serial numbers by sale ID
  getBySaleId: async (req, res) => {
    try {
      const { saleId } = req.params;

      const serials = await SerialNumber.getBySaleId(saleId);

      res.json({
        success: true,
        data: serials
      });
    } catch (error) {
      console.error('Error fetching serials by sale ID:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
};