import express from 'express';
import {
  getCategories,
  getCategory,
  addCategory,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
} from '../controllers/category.js';
import { requirePermission, requireAnyPermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { categoryImageUploadMulter, handleCategoryImageMulterError } from '../middleware/upload.js';

const categoryRouter = express.Router();

categoryRouter.get('/public', getCategories);
categoryRouter.post(
  '/image',
  requireAnyPermission(PERMISSIONS.CATEGORY_CREATE, PERMISSIONS.CATEGORY_UPDATE),
  (req, res, next) => {
    categoryImageUploadMulter.single('image')(req, res, (err: unknown) => {
      if (err) {
        return handleCategoryImageMulterError(err, res);
      }
      next();
    });
  },
  uploadCategoryImage
);
categoryRouter.get('/', requirePermission(PERMISSIONS.CATEGORY_READ), getCategories);
categoryRouter.get('/:id', requirePermission(PERMISSIONS.CATEGORY_READ), getCategory);
categoryRouter.post('/', requirePermission(PERMISSIONS.CATEGORY_CREATE), addCategory);
categoryRouter.put('/:id', requirePermission(PERMISSIONS.CATEGORY_UPDATE), updateCategory);
categoryRouter.delete('/:id', requirePermission(PERMISSIONS.CATEGORY_DELETE), deleteCategory);

export default categoryRouter;
