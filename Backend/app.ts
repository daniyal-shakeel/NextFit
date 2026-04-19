import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRouter from './routes/auth.js';
import categoryRouter from './routes/category.js';
import productRouter from './routes/product.js';
import aiRouter from './routes/ai.js';
import customerRouter from './routes/customer.js';
import orderRouter from './routes/order.js';
import wishlistRouter from './routes/wishlist.js';
import cartRouter from './routes/cart.js';
import addressRouter from './routes/address.js';
import inventoryRouter from './routes/inventory.js';
import reportsRouter from './routes/reports.js';
import tryonRouter from './routes/tryon.js';
import adminSettingsRouter from './routes/adminSettings.js';
import storeRouter from './routes/store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot =
  path.basename(__dirname) === 'dist' ? path.resolve(__dirname, '..') : __dirname;
const nodeEnv = process.env.NODE_ENV === 'production' ? 'production' : 'development';
const envFile =
  nodeEnv === 'production' ? '.env.production' : '.env.development';
dotenv.config({ path: path.join(backendRoot, envFile) });

if (!process.env.MONGODB_URI) {
  console.warn('MONGODB_URI is not set. Using default mongodb://localhost:27017');
}
void connectDB();

const app = express();
const PORT = process.env.PORT || 3001;

function normalizeOriginUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

const allowedOrigins = Array.from(
  new Set(
    [
      process.env.FRONTEND_URL || 'http://localhost:8080',
      process.env.ADMIN_URL || 'http://localhost:5173'
    ]
      .filter(Boolean)
      .map((u) => normalizeOriginUrl(u as string))
  )
);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    const normalized = normalizeOriginUrl(origin);
    if (allowedOrigins.includes(normalized)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Server is running!' });
});


app.use('/api/auth', authRouter);
app.use('/api/v1/auth', authRouter);
app.use('/api/categories', categoryRouter);
app.use('/api/products', productRouter);
app.use('/api/ai', aiRouter);
app.use('/api/customers', customerRouter);
app.use('/api/orders', orderRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/cart', cartRouter);
app.use('/api/addresses', addressRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/admin/settings', adminSettingsRouter);
app.use('/api/store', storeRouter);
app.use('/api', tryonRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
