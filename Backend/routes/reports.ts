import express from 'express';
import { getStats } from '../controllers/reports.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const reportsRouter = express.Router();

reportsRouter.get('/', requirePermission(PERMISSIONS.REPORTS_READ), getStats);

export default reportsRouter;
