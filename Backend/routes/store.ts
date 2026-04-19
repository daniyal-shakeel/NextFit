import { Router } from 'express';
import { getPublicShipping } from '../controllers/store.js';

const storeRouter = Router();

storeRouter.get('/shipping', getPublicShipping);

export default storeRouter;
