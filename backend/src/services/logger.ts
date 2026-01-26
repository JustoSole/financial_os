/**
 * Debugging Utility for Financial OS
 * Provides consistent, colored, and structured logging for backend processes.
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

export const logger = {
  info: (module: string, message: string, data?: any) => {
    console.log(`\x1b[36m[INFO][${module}]\x1b[0m ${message}`);
    if (data) console.dir(data, { depth: null, colors: true });
  },
  
  success: (module: string, message: string, data?: any) => {
    console.log(`\x1b[32m[SUCCESS][${module}]\x1b[0m ${message}`);
    if (data) console.dir(data, { depth: null, colors: true });
  },
  
  warn: (module: string, message: string, data?: any) => {
    console.warn(`\x1b[33m[WARN][${module}]\x1b[0m ${message}`);
    if (data) console.dir(data, { depth: null, colors: true });
  },
  
  error: (module: string, message: string, error?: any) => {
    console.error(`\x1b[31m[ERROR][${module}]\x1b[0m ${message}`);
    if (error) {
      if (error.stack) {
        console.error(error.stack);
      } else {
        console.dir(error, { depth: null, colors: true });
      }
    }
  },

  debug: (module: string, message: string, data?: any) => {
    if (IS_DEV) {
      console.log(`\x1b[90m[DEBUG][${module}]\x1b[0m ${message}`);
      if (data) console.dir(data, { depth: null, colors: true });
    }
  }
};

export default logger;

