import express from 'express';
import { suggestDescription, suggestFeatures, suggestTags } from '../controllers/ai.js';
import { productAssistantDraft } from '../controllers/productAssistant.js';
import { requirePermission } from '../middleware/requirePermission.js';
import { PERMISSIONS } from '../constants/permissions.js';

const aiRouter = express.Router();

aiRouter.post(
  '/product-assistant/draft',
  requirePermission(PERMISSIONS.PRODUCT_CREATE),
  productAssistantDraft
);

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

aiRouter.post(
  '/suggest-features',
  requirePermission(PERMISSIONS.AI_SUGGEST),
  suggestFeatures
);

export default aiRouter;
