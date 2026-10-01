const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

const root = __dirname;
const webRoot = path.join(root, 'www');
const viewerPage = path.join(root, 'server', 'live-viewer.html');
const port = Number(process.env.PORT) || 3000;
const sessionLifetimeMs = 2 * 60 * 60 * 1000;
const maxViewersPerSession = 20;
const maxActiveSessions = 100;
const maxActiveSessionsPerIp = 3;
const maxTrackedIpAddresses = 10000;
const sessions = new Map();
const viewerTokens = new Map();
const createAttempts = new Map();
const webSockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function setSecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'geolocation=(self)');
}

function isAllowedOrigin(origin, request) {
  if (!origin) return true;
  if (origin === process.env.KINETIX_ALLOWED_ORIGIN) return true;
  if (process.env.KINETIX_PUBLIC_URL) {
    try {
      if (origin === new URL(process.env.KINETIX_PUBLIC_URL).origin) return true;
    } catch (error) {
      return false;
    }
  }
  if (request && request.headers.host) {
    const protocol = request.socket.encrypted ? 'https' : 'http';
    if (origin === `${protocol}://${request.headers.host}`) return true;
  }
  return ['capacitor://localhost', 'https://localhost', 'http://localhost'].includes(origin);
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  if (origin && isAllowedOrigin(origin, request)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 8192) {
        reject(new Error('Request is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch (error) {
        reject(new Error('Request must contain valid JSON.'));
      }
    });
    request.on('error', reject);
  });
}

function validPosition(position) {
  return position && Number.isFinite(position.latitude) && Number.isFinite(position.longitude)
    && position.latitude >= -90 && position.latitude <= 90
    && position.longitude >= -180 && position.longitude <= 180
    && (!Number.isFinite(position.accuracy) || position.accuracy >= 0);
}

function secureTokenMatches(suppliedToken, expectedToken) {
  if (typeof suppliedToken !== 'string' || typeof expectedToken !== 'string') return false;
  const suppliedBytes = Buffer.from(suppliedToken);
  const expectedBytes = Buffer.from(expectedToken);
  return suppliedBytes.length === expectedBytes.length && crypto.timingSafeEqual(suppliedBytes, expectedBytes);
}

function requestBaseUrl(request) {
  if (process.env.KINETIX_PUBLIC_URL) return process.env.KINETIX_PUBLIC_URL.replace(/\/$/, '');
  const forwardedProtocol = String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProtocol || (request.socket.encrypted ? 'https' : 'http');
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || `localhost:${port}`).split(',')[0].trim();
  return `${protocol}://${host}`;
}

function clientIpAddress(request) {
  if (process.env.KINETIX_TRUST_PROXY === 'true') {
    const forwardedAddress = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (forwardedAddress) return forwardedAddress.slice(0, 64);
  }
  return request.socket.remoteAddress || 'unknown';
}

function takeCreateSlot(ipAddress) {
  const now = Date.now();
  const windowStart = now - 10 * 60 * 1000;
  const recentAttempts = (createAttempts.get(ipAddress) || []).filter((time) => time >= windowStart);
  if (createAttempts.size >= maxTrackedIpAddresses && !createAttempts.has(ipAddress)) {
    for (const [trackedIp, attempts] of createAttempts) {
      const activeAttempts = attempts.filter((time) => time >= windowStart);
      if (activeAttempts.length) createAttempts.set(trackedIp, activeAttempts);
      else createAttempts.delete(trackedIp);
    }
    if (createAttempts.size >= maxTrackedIpAddresses) return false;
  }
  if (recentAttempts.length >= 10) return false;
  recentAttempts.push(now);
  createAttempts.set(ipAddress, recentAttempts);
  return true;
}

function closeSession(session, reason) {
  if (!session || session.ended) return;
  session.ended = true;
  clearTimeout(session.expirationTimer);
  const message = JSON.stringify({ type: 'ended', reason });
  for (const client of session.viewers) {
    if (client.readyState === WebSocket.OPEN) client.send(message);
    client.close(1000, 'Live share ended');
  }
  session.viewers.clear();
  if (session.ownerSocket?.readyState === WebSocket.OPEN) session.ownerSocket.close(1000, 'Live share ended');
  sessions.delete(session.id);
  viewerTokens.delete(session.viewerToken);
}

function sendSnapshot(socket, session) {
  socket.send(JSON.stringify({
    type: 'snapshot',
    sport: session.sport,
    startedAt: session.createdAt,
    status: session.activityStatus || 'live',
    latest: session.latest,
    route: session.route,
  }));
}

function broadcast(session, message) {
  const serialized = JSON.stringify(message);
  for (const client of session.viewers) {
    if (client.readyState === WebSocket.OPEN) client.send(serialized);
  }
}

function handleOwnerSocket(socket, session) {
  if (session.ownerSocket && session.ownerSocket.readyState === WebSocket.OPEN) {
    session.ownerSocket.close(4001, 'Owner reconnected');
  }
  session.ownerSocket = socket;
  socket.send(JSON.stringify({ type: 'ready' }));
  socket.on('message', (rawMessage) => {
    if (session.ended) return;
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch (error) {
      return;
    }
    if (message.type === 'status') {
      if (!['live', 'paused'].includes(message.status)) return;
      session.activityStatus = message.status;
      broadcast(session, { type: 'status', status: message.status, timestamp: Date.now() });
      return;
    }
    if (session.activityStatus === 'paused') return;
    if (Date.now() - session.lastUpdateAt < 500) return;
    if (message.type !== 'location' || !validPosition(message.position)) return;
    const point = {
      latitude: message.position.latitude,
      longitude: message.position.longitude,
      accuracy: Number.isFinite(message.position.accuracy) ? Math.min(message.position.accuracy, 10000) : null,
      timestamp: Date.now(),
    };
    session.lastUpdateAt = point.timestamp;
    session.latest = point;
    const previousPoint = session.route[session.route.length - 1];
    if (!previousPoint || point.timestamp - previousPoint.timestamp >= 5000) {
      session.route.push(point);
      if (session.route.length > 500) session.route.shift();
    }
    broadcast(session, { type: 'location', position: point });
  });
  socket.on('close', () => {
    if (session.ownerSocket === socket) session.ownerSocket = null;
  });
}

function authenticateOwnerSocket(socket, session) {
  const timeout = setTimeout(() => socket.close(4003, 'Authentication timed out'), 5000);
  const authenticate = (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch (error) {
      socket.close(4003, 'Invalid authentication');
      return;
    }
    if (message.type !== 'auth' || !secureTokenMatches(message.token, session.ownerToken)) {
      socket.close(4003, 'Invalid authentication');
      return;
    }
    clearTimeout(timeout);
    socket.off('message', authenticate);
    handleOwnerSocket(socket, session);
  };
  socket.on('message', authenticate);
}

function serveStatic(pathname, response) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (error) {
    response.writeHead(400).end('Bad path');
    return;
  }
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const filePath = path.resolve(webRoot, relativePath);
  if (!filePath.startsWith(`${webRoot}${path.sep}`) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': ['.html', '.css', '.js'].includes(path.extname(filePath).toLowerCase()) ? 'no-cache' : 'public, max-age=300',
  });
  fs.createReadStream(filePath).pipe(response);
}

async function handleRequest(request, response) {
  setSecurityHeaders(response);
  applyCors(request, response);
  if (request.method === 'OPTIONS') {
    response.writeHead(isAllowedOrigin(request.headers.origin, request) ? 204 : 403).end();
    return;
  }

  const requestUrl = new URL(request.url, 'http://localhost');
  if (request.method === 'POST' && requestUrl.pathname === '/api/live-sessions') {
    if (!isAllowedOrigin(request.headers.origin, request)) return sendJson(response, 403, { error: 'Origin is not allowed.' });
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
    if (!validPosition(body.position)) return sendJson(response, 400, { error: 'A valid GPS position is required to start sharing.' });
    if (sessions.size >= maxActiveSessions) return sendJson(response, 503, { error: 'Live sharing is at capacity. Try again later.' });
    const ownerIp = clientIpAddress(request);
    const activeSessionsForIp = [...sessions.values()].filter((session) => session.ownerIp === ownerIp).length;
    if (activeSessionsForIp >= maxActiveSessionsPerIp) return sendJson(response, 429, { error: 'This device already has the maximum number of live shares.' });
    if (!takeCreateSlot(ownerIp)) return sendJson(response, 429, { error: 'Too many live shares. Try again later.' });

    const id = crypto.randomBytes(16).toString('base64url');
    const ownerToken = crypto.randomBytes(32).toString('base64url');
    const viewerToken = crypto.randomBytes(32).toString('base64url');
    const createdAt = Date.now();
    const initialPosition = {
      latitude: body.position.latitude,
      longitude: body.position.longitude,
      accuracy: Number.isFinite(body.position.accuracy) ? Math.min(body.position.accuracy, 10000) : null,
      timestamp: createdAt,
    };
    const session = {
      id,
      ownerIp,
      ownerToken,
      viewerToken,
      sport: typeof body.sport === 'string' ? body.sport.slice(0, 40) : 'Activity',
      createdAt,
      expiresAt: createdAt + sessionLifetimeMs,
      activityStatus: 'live',
      lastUpdateAt: 0,
      latest: initialPosition,
      route: [initialPosition],
      viewers: new Set(),
      ownerSocket: null,
      ended: false,
    };
    session.expirationTimer = setTimeout(() => closeSession(session, 'expired'), sessionLifetimeMs);
    session.expirationTimer.unref();
    sessions.set(id, session);
    viewerTokens.set(viewerToken, session);
    return sendJson(response, 201, {
      sessionId: id,
      ownerToken,
      shareUrl: `${requestBaseUrl(request)}/live/${viewerToken}`,
      expiresAt: session.expiresAt,
    });
  }

  const stopMatch = request.method === 'DELETE' && requestUrl.pathname.match(/^\/api\/live-sessions\/([A-Za-z0-9_-]+)$/);
  if (stopMatch) {
    const session = sessions.get(stopMatch[1]);
    const suppliedToken = String(request.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!session || !secureTokenMatches(suppliedToken, session.ownerToken)) return sendJson(response, 404, { error: 'Live share not found.' });
    closeSession(session, 'stopped');
    return sendJson(response, 200, { ended: true });
  }

  const viewerMatch = request.method === 'GET' && requestUrl.pathname.match(/^\/live\/([A-Za-z0-9_-]+)$/);
  if (viewerMatch) {
    const session = viewerTokens.get(viewerMatch[1]);
    if (!session || session.ended || session.expiresAt <= Date.now()) {
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end('<!doctype html><meta name="viewport" content="width=device-width"><title>Live share ended</title><main><h1>This live share has ended</h1><p>The link may have expired or the runner stopped sharing.</p></main>');
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(viewerPage).pipe(response);
    return;
  }

  if (request.method === 'GET' || request.method === 'HEAD') return serveStatic(requestUrl.pathname, response);
  response.writeHead(405, { Allow: 'GET, HEAD, POST, DELETE, OPTIONS' }).end();
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    if (!response.headersSent) sendJson(response, 500, { error: 'Live location service failed.' });
    else response.destroy(error);
  });
});

server.on('upgrade', (request, socket, head) => {
  const requestUrl = new URL(request.url, 'http://localhost');
  if (!isAllowedOrigin(request.headers.origin, request)) return socket.destroy();
  const ownerMatch = requestUrl.pathname.match(/^\/ws\/owner\/([A-Za-z0-9_-]+)$/);
  const viewerMatch = requestUrl.pathname.match(/^\/ws\/view\/([A-Za-z0-9_-]+)$/);
  let session;
  let role;
  if (ownerMatch) {
    session = sessions.get(ownerMatch[1]);
    if (session) role = 'owner';
  } else if (viewerMatch) {
    session = viewerTokens.get(viewerMatch[1]);
    if (session && !session.ended && session.expiresAt > Date.now()) role = 'viewer';
  }
  if (!session || !role) return socket.destroy();
  if (role === 'viewer' && session.viewers.size >= maxViewersPerSession) return socket.destroy();

  webSockets.handleUpgrade(request, socket, head, (client) => {
    if (role === 'viewer') {
      session.viewers.add(client);
      sendSnapshot(client, session);
      client.on('close', () => session.viewers.delete(client));
    } else {
      authenticateOwnerSocket(client, session);
    }
  });
});

function startServer() {
  server.listen(port, '::', () => {
    console.log(`Kinetix live service listening on port ${port}`);
    if (!process.env.KINETIX_PUBLIC_URL) {
      console.log('Set KINETIX_PUBLIC_URL to the public HTTPS origin when deployed behind a proxy.');
    }
  });
}

if (require.main === module) startServer();

module.exports = { server, startServer };