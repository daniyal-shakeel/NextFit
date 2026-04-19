import express from 'express';
import {
  getMe,
  updateMe,
  uploadAvatarHandler,
  list,
  getOne,
  updateStatus,
  getLoginActivity,
} from '../controllers/customer.js';
import { requireCustomerAuth } from '../middleware/requirePermission.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { avatarUploadMulter, handleMulterError } from '../middleware/upload.js';

const customerRouter = express.Router();

customerRouter.get('/me', requireCustomerAuth, getMe);
customerRouter.put('/me', requireCustomerAuth, updateMe);
customerRouter.post(
  '/me/avatar',
  requireCustomerAuth,
  (req, res, next) => {
    avatarUploadMulter.single('avatar')(req, res, (err: unknown) => {
      if (err) {
        return handleMulterError(err, res);
      }
      next();
    });
  },
  uploadAvatarHandler
);

customerRouter.get('/', requirePermission(PERMISSIONS.CUSTOMER_READ_ALL), list);
customerRouter.get('/:id/login-activity', requirePermission(PERMISSIONS.CUSTOMER_READ_ONE), getLoginActivity);
customerRouter.get('/:id', requirePermission(PERMISSIONS.CUSTOMER_READ_ONE), getOne);
customerRouter.patch('/:id/status', requirePermission(PERMISSIONS.CUSTOMER_UPDATE_STATUS), updateStatus);

export default customerRouter;
