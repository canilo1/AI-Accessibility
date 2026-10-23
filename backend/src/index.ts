import express from 'express';
import cors from 'cors';
import taxpayersRouter from './routes/taxpayers';
import returnsRouter from './routes/returns';
import dashboardRouter from './routes/dashboard';
import appealsRouter from './routes/appeals';

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors());
app.use(express.json());

app.use('/api/taxpayers', taxpayersRouter);
app.use('/api/returns', returnsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/appeals', appealsRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Tax Fraud Detection API running on http://localhost:${PORT}`);
});

export default app;
