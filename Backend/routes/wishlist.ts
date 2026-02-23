import express from 'express';
import { getMine, updateMine, addProduct, removeProduct } from '../controllers/wishlist.js';
import { requireCustomerAuth } from '../middleware/requirePermission.js';

const wishlistRouter = express.Router();

wishlistRouter.get('/', requireCustomerAuth, getMine);
wishlistRouter.put('/', requireCustomerAuth, updateMine);
wishlistRouter.post('/items', requireCustomerAuth, addProduct);
wishlistRouter.post('/items/:productId', requireCustomerAuth, addProduct);
wishlistRouter.delete('/items/:productId', requireCustomerAuth, removeProduct);

export default wishlistRouter;
