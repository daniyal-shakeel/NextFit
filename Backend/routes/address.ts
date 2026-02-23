import express from 'express';
import { listMine, create, update, remove, setDefault } from '../controllers/address.js';
import { requireCustomerAuth } from '../middleware/requirePermission.js';

const addressRouter = express.Router();

addressRouter.get('/', requireCustomerAuth, listMine);
addressRouter.post('/', requireCustomerAuth, create);
addressRouter.patch('/:id/default', requireCustomerAuth, setDefault);
addressRouter.patch('/:id', requireCustomerAuth, update);
addressRouter.delete('/:id', requireCustomerAuth, remove);

export default addressRouter;
