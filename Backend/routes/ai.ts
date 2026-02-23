import express from 'express';
import { suggestDescription, suggestTags } from '../controllers/ai.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const aiRouter = express.Router();

aiRouter.post(
  '/suggest-description',
  requirePermission(PERMISSIONS.AI_SUGGEST),
  suggestDescription
);

aiRouter.post(
  '/suggest-tags',
  requirePermission(PERMISSIONS.AI_SUGGEST),
  suggestTags
);

export default aiRouter;
