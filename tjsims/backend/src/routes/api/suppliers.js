import express from 'express';
import { SupplierController } from '../../controllers/SupplierController.js';

const router = express.Router();

router.get('/', SupplierController.getAllSuppliers);
router.post('/', SupplierController.createSupplier);
router.put('/:id', SupplierController.updateSupplier);
router.delete('/:id', SupplierController.deleteSupplier);

export default router;