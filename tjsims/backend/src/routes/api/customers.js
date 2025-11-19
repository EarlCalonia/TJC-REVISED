import express from 'express';
import { CustomersController } from '../../controllers/CustomersController.js';

const router = express.Router();

// GET /api/customers - list distinct customers from sales history
router.get('/', CustomersController.list);

export default router;
