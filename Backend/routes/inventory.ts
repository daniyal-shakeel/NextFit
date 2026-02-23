import express from 'express';
import { list, updateStock } from '../controllers/inventory.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const inventoryRouter = express.Router();

inventoryRouter.get('/', requirePermission(PERMISSIONS.INVENTORY_READ), list);
inventoryRouter.patch('/:productId/stock', requirePermission(PERMISSIONS.INVENTORY_UPDATE), updateStock);

export default inventoryRouter;
