import express from 'express';
import { create, listMine, getMine, list, getOne, updateStatus, getPublic } from '../controllers/order.js';
import { requireCustomerAuth } from '../middleware/requirePermission.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const orderRouter = express.Router();

orderRouter.post('/', create);
orderRouter.get('/public/:id', getPublic);
orderRouter.get('/me', requireCustomerAuth, listMine);
orderRouter.get('/me/:id', requireCustomerAuth, getMine);

// Admin
orderRouter.get('/', requirePermission(PERMISSIONS.ORDER_READ), list);
orderRouter.patch('/:id/status', requirePermission(PERMISSIONS.ORDER_UPDATE), updateStatus);
orderRouter.get('/:id', requirePermission(PERMISSIONS.ORDER_READ), getOne);

export default orderRouter;
