import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import taxpayersRouter from './routes/taxpayers';
import returnsRouter from './routes/returns';
import dashboardRouter from './routes/dashboard';
import appealsRouter from './routes/appeals';
import authRouter, { bootstrapAdminAccount } from './routes/auth';
import customerRouter from './routes/customer';
import adminDocumentsRouter from './routes/adminDocuments';
import documentFilesRouter from './routes/documentFiles';
import adminAccountsRouter from './routes/adminAccounts';
import { requireAuth, requireRole } from './middleware/auth';

const app = express();
const PORT = process.env.PORT ?? 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));
app.use((req, res, next) => {
  const origin = req.get('origin');
  const safeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (!safeMethod && origin && origin !== FRONTEND_ORIGIN) {
    res.status(403).json({ error: 'Request origin is not allowed' });
    return;
  }
  next();
});
app.use(express.json({ limit: '1mb' }));

bootstrapAdminAccount();

app.use('/api/auth', authRouter);
app.use('/api/customer', customerRouter);
app.use('/api/admin/documents', adminDocumentsRouter);
app.use('/api/admin/customer-accounts', adminAccountsRouter);
app.use('/api/documents', documentFilesRouter);
app.use('/api/taxpayers', requireAuth, requireRole('admin'), taxpayersRouter);
app.use('/api/returns', requireAuth, requireRole('admin'), returnsRouter);
app.use('/api/dashboard', requireAuth, requireRole('admin'), dashboardRouter);
app.use('/api/appeals', requireAuth, requireRole('admin'), appealsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Tax Fraud Detection API running on http://localhost:${PORT}`);
});

export default app;
