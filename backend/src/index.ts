import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './db';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initializeDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// API routes
app.use('/api', apiRoutes);

// Serve static files (Unified Frontend + Backend)
const frontendPath = path.join(__dirname, '../../frontend/dist');
const hasFrontendBuild = fs.existsSync(frontendPath);

if (hasFrontendBuild) {
  console.log(`📦 Serving frontend from: ${frontendPath}`);
  app.use(express.static(frontendPath));
  
  // Handle React routing
  app.get(/^(?!\/api).+/, (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.warn('⚠️ Frontend build not found. Running in API-only mode.');
}

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   💰 Financial OS - Backend Server                       ║
║                                                          ║
║   🚀 Running on http://localhost:${PORT}                   ║
║   📊 API endpoint: http://localhost:${PORT}/api            ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

export default app;
