import { Router } from 'express';
import { getAdminSettings, updateAdminSettings } from '../controllers/adminSettings.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const adminSettingsRouter = Router();

adminSettingsRouter.get('/', requirePermission(PERMISSIONS.SETTINGS_READ), getAdminSettings);
adminSettingsRouter.patch('/', requirePermission(PERMISSIONS.SETTINGS_UPDATE), updateAdminSettings);

export default adminSettingsRouter;
