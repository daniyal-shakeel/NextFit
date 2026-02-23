import express from 'express';
import { register, login, logout, adminLogin, verifyEmail, resendVerification, checkAuth, checkAdminAuth, verifyPhone, verifyGoogle } from '../controllers/auth.js';

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/signup', register); // Alias for frontend compatibility
authRouter.post('/login', login);
authRouter.post('/admin/login', adminLogin);
authRouter.post('/phone/verify', verifyPhone);
authRouter.post('/google/verify', verifyGoogle);
authRouter.post('/logout', logout);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/resend-verification', resendVerification);
authRouter.get('/check-auth', checkAuth); // User app only: uses authToken
authRouter.get('/admin/check-auth', checkAdminAuth); // Admin app only: uses adminAuthToken

export default authRouter;