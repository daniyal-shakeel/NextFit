import express from 'express';
import { getMine, updateMine, addItem, updateItem, removeItem } from '../controllers/cart.js';
import { requireCustomerAuth } from '../middleware/requirePermission.js';

const cartRouter = express.Router();

cartRouter.get('/', requireCustomerAuth, getMine);
cartRouter.put('/', requireCustomerAuth, updateMine);
cartRouter.post('/items', requireCustomerAuth, addItem);
cartRouter.post('/items/:productId', requireCustomerAuth, addItem);
cartRouter.patch('/items/:itemId', requireCustomerAuth, updateItem);
cartRouter.delete('/items/:itemId', requireCustomerAuth, removeItem);

export default cartRouter;
