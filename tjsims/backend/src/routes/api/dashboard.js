import express from 'express';
import { DashboardController } from '../../controllers/DashboardController.js';

const router = express.Router();

// Get dashboard statistics
router.get('/stats', DashboardController.getDashboardStats);

// Get recent sales transactions
router.get('/recent-sales', DashboardController.getRecentSales);

// Get low stock items
router.get('/low-stock', DashboardController.getLowStockItems);

// Get daily sales data
router.get('/daily-sales', DashboardController.getDailySales);

// Get fast moving products
router.get('/fast-moving', DashboardController.getFastMovingProducts);

// Get slow moving products
router.get('/slow-moving', DashboardController.getSlowMovingProducts);

// --- NEW ROUTE ---
// Get sales aggregated by category
router.get('/sales-by-category', DashboardController.getSalesByCategory);

export default router;