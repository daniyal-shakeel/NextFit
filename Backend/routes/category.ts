import express from 'express';
import {
  getCategories,
  getCategory,
  addCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const categoryRouter = express.Router();

// Public: list categories for landing page / shop (no auth)
categoryRouter.get('/public', getCategories);
categoryRouter.get('/', requirePermission(PERMISSIONS.CATEGORY_READ), getCategories);
categoryRouter.get('/:id', requirePermission(PERMISSIONS.CATEGORY_READ), getCategory);
categoryRouter.post('/', requirePermission(PERMISSIONS.CATEGORY_CREATE), addCategory);
categoryRouter.put('/:id', requirePermission(PERMISSIONS.CATEGORY_UPDATE), updateCategory);
categoryRouter.delete('/:id', requirePermission(PERMISSIONS.CATEGORY_DELETE), deleteCategory);

export default categoryRouter;
