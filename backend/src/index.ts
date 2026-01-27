import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { initializeDatabase } from './db';
import apiRoutes from './routes/api';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
console.log('🔧 Initializing database...');
initializeDatabase();
console.log('✅ Database initialized');

async function startServer() {
  try {
    // Seed database with sample data if empty
    // console.log('🌱 Checking seed data...');
    // try {
    //   const { seedDatabase } = await import('./seed');
    //   await seedDatabase();
    //   console.log('✅ Seed check complete');
    // } catch (seedErr) {
    //   console.warn('⚠️ Seed module not found or failed:', seedErr);
    // }

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
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Middleware
app.use(cors({
  origin: '*', // En producción deberías limitar esto
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// API Routes
app.use('/api', apiRoutes);

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../../frontend/dist');
  console.log(`📁 Serving frontend from: ${frontendDistPath}`);
  
  // Serve static assets
  app.use(express.static(frontendDistPath));
  
  // Handle SPA routing - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    const indexPath = path.join(frontendDistPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      console.error('❌ index.html not found at:', indexPath);
      res.status(404).send('Frontend not built. Please run npm run build.');
    }
  });
} else {
  // Development: API routes only (frontend runs on separate vite server)
  app.get('/', (req, res) => {
    res.json({ 
      message: 'Financial OS API', 
      status: 'running',
      docs: '/api/health'
    });
  });
}

startServer();

export default app;
