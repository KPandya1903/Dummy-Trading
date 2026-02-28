// Diagnostic: surface any import errors as JSON
let app: any = null;
let bootError: string | null = null;

try {
  // Force ncc to trace this as a static dependency
  app = require('../server/src/app').default || require('../server/src/app');
} catch (e1: any) {
  // If CJS require fails (ESM module), try dynamic import
  bootError = `require failed: ${e1.message}`;
}

export default async function handler(req: any, res: any) {
  // If require failed, try dynamic import on first request
  if (!app && bootError) {
    try {
      const mod = await import('../server/src/app.js');
      app = mod.default;
      bootError = null;
    } catch (e2: any) {
      res.status(500).json({
        phase: 'dynamic-import',
        requireError: bootError,
        importError: e2.message,
        stack: e2.stack?.split('\n').slice(0, 8),
      });
      return;
    }
  }

  if (!app) {
    res.status(500).json({ error: 'App not loaded', bootError });
    return;
  }

  return app(req, res);
}
