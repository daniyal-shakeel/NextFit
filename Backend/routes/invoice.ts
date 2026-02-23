import express from 'express';
import { list } from '../controllers/invoice.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const invoiceRouter = express.Router();
invoiceRouter.get('/', requirePermission(PERMISSIONS.ORDER_READ), list);
export default invoiceRouter;
