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

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// API routes - MUST be before static file serving
app.use('/api', apiRoutes);

// Serve static files (Unified Frontend + Backend)
const frontendPath = path.join(__dirname, '../../frontend/dist');
const hasFrontendBuild = fs.existsSync(frontendPath);

if (hasFrontendBuild) {
  console.log(`📦 Serving frontend from: ${frontendPath}`);
  
  // Serve static assets (JS, CSS, images, etc.)
  app.use(express.static(frontendPath, {
    // Don't serve index.html for static files
    index: false,
  }));
  
  // Handle React routing - catch all non-API routes and serve index.html
  app.get('*', (req, res, next) => {
    // Skip if it's an API route (shouldn't happen, but just in case)
    if (req.path.startsWith('/api')) {
      return next();
    }
    
    // Skip if it's a static asset request (has file extension)
    if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
      return next();
    }
    
    // Serve index.html for all other routes (React Router)
    res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(404).send('Not found');
      }
    });
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
