import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import connectDB from './config/db';
import authRouter from './routes/auth';
import categoryRouter from './routes/category';
import productRouter from './routes/product';
import aiRouter from './routes/ai';
import customerRouter from './routes/customer';
import orderRouter from './routes/order';
import wishlistRouter from './routes/wishlist';
import cartRouter from './routes/cart';
import invoiceRouter from './routes/invoice';
import addressRouter from './routes/address';
import inventoryRouter from './routes/inventory';
import reportsRouter from './routes/reports';

// Load environment variables
dotenv.config();

if(!process.env.MONGODB_URI) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
} else {
    // Connect to MongoDB
    connectDB();
}

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
// CORS: allow Frontend and Admin origins when using credentials
const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:8080',
  process.env.ADMIN_URL || 'http://localhost:5173',
].filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(cookieParser()); // Parse cookies from requests
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic route
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'Server is running!' });
});

app.use('/api/auth', authRouter);
app.use('/api/v1/auth', authRouter); // Keep v1 for backward compatibility
app.use('/api/categories', categoryRouter);
app.use('/api/products', productRouter);
app.use('/api/ai', aiRouter);
app.use('/api/customers', customerRouter);
app.use('/api/orders', orderRouter);
app.use('/api/wishlist', wishlistRouter);
app.use('/api/cart', cartRouter);
app.use('/api/invoices', invoiceRouter);
app.use('/api/addresses', addressRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/reports', reportsRouter);

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
