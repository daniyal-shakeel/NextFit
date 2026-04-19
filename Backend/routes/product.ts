import express from 'express';
import {
  getFeaturedProducts,
  getProductsPublic,
  getProductPublic,
  getProducts,
  getProduct,
  addProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/product.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const productRouter = express.Router();

productRouter.get('/featured', getFeaturedProducts);
productRouter.get('/public', getProductsPublic);
productRouter.get('/public/:id', getProductPublic);

productRouter.get('/', requirePermission(PERMISSIONS.PRODUCT_READ), getProducts);
productRouter.get('/:id', requirePermission(PERMISSIONS.PRODUCT_READ), getProduct);
productRouter.post('/', requirePermission(PERMISSIONS.PRODUCT_CREATE), addProduct);
productRouter.put('/:id', requirePermission(PERMISSIONS.PRODUCT_UPDATE), updateProduct);
productRouter.delete('/:id', requirePermission(PERMISSIONS.PRODUCT_DELETE), deleteProduct);

export default productRouter;
