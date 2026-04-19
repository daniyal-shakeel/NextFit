import express from 'express';
import { register, login, logout, adminLogout, adminLogin, verifyEmail, resendVerification, checkAuth, checkAdminAuth, verifyPhone, verifyGoogle } from '../controllers/auth.js';

const authRouter = express.Router();

authRouter.post('/register', register);
authRouter.post('/signup', register); 
authRouter.post('/login', login);
authRouter.post('/admin/login', adminLogin);
authRouter.post('/admin/logout', adminLogout);
authRouter.post('/phone/verify', verifyPhone);
authRouter.post('/google/verify', verifyGoogle);
authRouter.post('/logout', logout);
authRouter.get('/verify-email', verifyEmail);
authRouter.post('/resend-verification', resendVerification);
authRouter.get('/check-auth', checkAuth); 
authRouter.get('/admin/check-auth', checkAdminAuth); 

export default authRouter;