const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const dotenv = require('dotenv');
const db = require('./db');
const emissionsEngine = require('./emissionsEngine');
const ocrService = require('./ocrService');
const agentService = require('./agentService');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Allow localhost (dev) and the Cloud Run origin (prod, set via CORS_ORIGIN env var)
const allowedOrigins = ['http://localhost:3000', 'http://localhost:5000'];
if (process.env.CORS_ORIGIN) allowedOrigins.push(process.env.CORS_ORIGIN);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. same-origin, curl) or matched origins
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.run.app')) {
      return callback(null, true);
    }
    callback(null, false);
  },
  credentials: true
}));

// Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, XSS-Protection, etc.)
app.use(helmet({
  contentSecurityPolicy: false // disabled so the SPA assets load without CSP conflicts
}));

app.use(express.json({ limit: '10mb' }));

// Serve pre-built React client (production only)
const STATIC_DIR = path.join(__dirname, 'public');
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(STATIC_DIR));
}

// Location static lookup data for endpoints
const LOCATIONS_DATA = {
  "Maharashtra": {
    "Mumbai": ["Colaba", "Bandra", "Andheri", "Juhu", "Borivali"],
    "Pune": ["Kothrud", "Koregaon Park", "Aundh", "Baner", "Hinjewadi"],
    "Nagpur": ["Sitabuldi", "Dharampeth", "Sadar"]
  },
  "Karnataka": {
    "Bengaluru": ["Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "Malleshwaram"],
    "Mysore": ["Gokulam", "Vidyaranyapuram", "Kuvempunagar"],
    "Hubli": ["Vidyanagar", "Keshwapur"]
  },
  "Delhi": {
    "New Delhi": ["Connaught Place", "Chanakyapuri", "Vasant Kunj", "Saket", "Dwarka"]
  },
  "Tamil Nadu": {
    "Chennai": ["Adyar", "Mylapore", "T. Nagar", "Velachery", "Nungambakkam"],
    "Coimbatore": ["Gandhipuram", "RS Puram", "Peelamedu"]
  },
  "Telangana": {
    "Hyderabad": ["Gachibowli", "Jubilee Hills", "Banjara Hills", "Madhapur", "Begumpet"]
  },
  "West Bengal": {
    "Kolkata": ["Salt Lake", "Ballygunge", "Park Street", "New Town", "Behala"]
  },
  "Gujarat": {
    "Ahmedabad": ["Satellite", "Navrangpura", "Vastrapur", "Bodakdev"],
    "Surat": ["Adajan", "Vesu", "Piplod"]
  },
  "Uttar Pradesh": {
    "Noida": ["Sector 62", "Sector 15", "Sector 50"],
    "Lucknow": ["Hazratganj", "Gomti Nagar", "Aliganj"]
  },
  "Kerala": {
    "Kochi": ["Edappally", "Kakkanad", "Fort Kochi"],
    "Trivandrum": ["Kowdiar", "Pattom", "Kazhakkoottam"]
  },
  "Rajasthan": {
    "Jaipur": ["Malviya Nagar", "Vaishali Nagar", "C-Scheme"],
    "Jodhpur": ["Sardarpura", "Shastri Nagar"]
  },
  "Punjab": {
    "Ludhiana": ["Sarabha Nagar", "Model Town"],
    "Amritsar": ["Ranjit Avenue", "Lawrence Road"]
  },
  "Haryana": {
    "Gurgaon": ["DLF Phase 3", "Sector 56", "Sector 45"]
  },
  "Madhya Pradesh": {
    "Indore": ["Vijay Nagar", "Palasia", "Saket"],
    "Bhopal": ["Arera Colony", "MP Nagar"]
  },
  "Bihar": {
    "Patna": ["Boring Road", "Kankarbagh", "Bailey Road"]
  },
  "Andhra Pradesh": {
    "Visakhapatnam": ["Dwaraka Nagar", "MVP Colony", "Gajuwaka"],
    "Vijayawada": ["Benz Circle", "Labbipet"]
  },
  "Odisha": {
    "Bhubaneswar": ["Nayapalli", "Patia", "Saheed Nagar"]
  },
  "Assam": {
    "Guwahati": ["Dispur", "Paltan Bazaar", "Ganeshguri"]
  },
  "Goa": {
    "Panaji": ["Miramar", "Altinho", "Campal"]
  },
  "Uttarakhand": {
    "Dehradun": ["Rajpur Road", "Jakhan", "Clement Town"]
  },
  "Himachal Pradesh": {
    "Shimla": ["Mall Road", "Chotta Shimla", "Kasumpti"]
  },
  "Sikkim": {
    "Gangtok": ["MG Marg", "Deorali", "Development Area"]
  },
  "Puducherry": {
    "Puducherry Town": ["Heritage Town", "White Town", "Boulevard"]
  }
};

const jwt = require('jsonwebtoken');

/** JWT secret — always prefer the environment variable in production. */
const JWT_SECRET = process.env.JWT_SECRET || 'imprint-secret-key-1029384756';

// In-memory rate limiting maps (keyed by client IP)
const registerLimiter = new Map();
const scannerLimiter = new Map();

/**
 * Express middleware factory for simple in-memory rate limiting.
 * @param {Map} limitMap   - Shared per-IP counter map.
 * @param {number} windowMs - Window duration in milliseconds.
 * @param {number} maxRequests - Max requests allowed per window.
 * @returns {Function} Express middleware.
 */
function rateLimitMiddleware(limitMap, windowMs, maxRequests) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const clientData = limitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
    } else {
      clientData.count += 1;
    }

    limitMap.set(ip, clientData);

    if (clientData.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }
    next();
  };
}

/**
 * Strict auth middleware — rejects unauthenticated requests with 401.
 * Use on all write / mutating endpoints (POST, PATCH, PUT, DELETE).
 * Attaches verified `req.user` from the database on success.
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Authorization header is missing' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid user session' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('requireAuth token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

/**
 * Optional auth middleware — attaches `req.user` if a valid Bearer token is
 * present, but always calls next() so unauthenticated requests are not blocked.
 * Use on read-only GET endpoints that return empty/guest data when not logged in.
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = (authHeader.split(' ')[1] || '').trim();
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && decoded.userId) {
          const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
          if (user) req.user = user;
        }
      } catch (_err) {
        // Invalid / expired token — proceed as guest
      }
    }
  }
  next();
}

const crypto = require('crypto');
/**
 * One-way SHA-256 password hash.
 * @param {string} password - Plaintext password.
 * @returns {string} Hex digest.
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// ── Health Check ─────────────────────────────────────────────────────────────
/** Public liveness probe — no auth required. */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 1. Auth Endpoints ────────────────────────────────────────────────────────
app.post('/api/auth/register', rateLimitMiddleware(registerLimiter, 60 * 1000, 10), (req, res) => {
  const { username, password, name, state, city, ward, diet, commute } = req.body;

  if (!username || !password || !name || !state || !city || !ward || !diet || !commute) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (!LOCATIONS_DATA[state] || !LOCATIONS_DATA[state][city] || !LOCATIONS_DATA[state][city].includes(ward)) {
    return res.status(400).json({ error: 'Invalid state, city, or ward combination' });
  }

  try {
    const hashedPassword = hashPassword(password);
    const info = db.prepare(`
      INSERT INTO users (username, password, name, state, city, ward, diet, commute)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(username, hashedPassword, name, state, city, ward, diet, commute);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user || user.password !== hashPassword(password)) {
      return res.status(400).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Locations Lookups
app.get('/api/locations/states', (req, res) => {
  try {
    res.json(Object.keys(LOCATIONS_DATA));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/locations/cities', (req, res) => {
  try {
    const { state } = req.query;
    if (!state || !LOCATIONS_DATA[state]) {
      return res.status(400).json({ error: 'Valid state parameter required' });
    }
    res.json(Object.keys(LOCATIONS_DATA[state]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/locations/wards', (req, res) => {
  try {
    const { state, city } = req.query;
    if (!state || !city || !LOCATIONS_DATA[state] || !LOCATIONS_DATA[state][city]) {
      return res.status(400).json({ error: 'Valid state and city parameters required' });
    }
    res.json(LOCATIONS_DATA[state][city]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3. Dashboard Data ───────────────────────────────────────────────────────
/** Returns today's footprint, mood, and weekly breakdown for the authenticated user.
 *  Unauthenticated requests receive an empty guest payload so the app structure
 *  remains testable without credentials. */
app.get('/api/dashboard', optionalAuth, async (req, res) => {
  if (!req.user) {
    return res.json({
      today: { total_kg: 0, progress_pct: 0, mood: 'neutral', message: 'Login to see your dashboard.', suggested_action: null },
      week: { food: 0, transport: 0, energy: 0, foodDelta: 0, transportDelta: 0, energyDelta: 0 }
    });
  }
  try {
    const userId = req.user.id;
  const todayStr = new Date().toISOString().slice(0, 10);

  // Fetch today's log or create baseline placeholder
  let todayLog = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?').get(userId, todayStr);
  if (!todayLog) {
    const base = emissionsEngine.getProfileDailyBaseline(req.user.diet, req.user.commute);
    db.prepare(`
      INSERT INTO daily_logs (user_id, log_date, food_kg, transport_kg, energy_kg, total_kg, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, todayStr, base.food_kg, base.transport_kg, base.energy_kg, base.total_kg, JSON.stringify({ note: "Auto baseline" }));
    todayLog = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?').get(userId, todayStr);
  }

  // Calculate user weekly averages
  const last7DaysLogs = db.prepare(`
    SELECT total_kg, food_kg, transport_kg, energy_kg FROM daily_logs 
    WHERE user_id = ? AND log_date < ? 
    ORDER BY log_date DESC LIMIT 7
  `).all(userId, todayStr);

  const prevAvg = last7DaysLogs.length > 0
    ? last7DaysLogs.reduce((sum, log) => sum + log.total_kg, 0) / last7DaysLogs.length
    : 5.5;

  const progress = prevAvg > 0 ? ((todayLog.total_kg - prevAvg) / prevAvg) * 100 : 0;

  // Retrieve latest Agent Run for mascot mood and suggest action
  let latestRun = db.prepare('SELECT * FROM agent_runs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 1').get(userId);
  if (!latestRun) {
    latestRun = await agentService.runAgentCycle(userId);
  } else {
    // Deserialize suggested action
    try {
      latestRun.suggested_action = JSON.parse(latestRun.suggested_action);
      if (latestRun.suggested_action && latestRun.suggested_action.action_id) {
        const feedback = db.prepare('SELECT accepted FROM agent_feedback WHERE user_id = ? AND action_id = ?').get(userId, latestRun.suggested_action.action_id);
        latestRun.suggested_action.status = feedback ? (feedback.accepted === 1 ? 'accepted' : 'dismissed') : 'pending';
      }
    } catch (errJson) {
      console.warn('Failed to parse suggested action or retrieve feedback:', errJson);
    }
  }

  // Week at a glance totals
  const weekLogs = db.prepare(`
    SELECT food_kg, transport_kg, energy_kg FROM daily_logs 
    WHERE user_id = ? 
    ORDER BY log_date DESC LIMIT 7
  `).all(userId);

  const totalFood = weekLogs.reduce((sum, row) => sum + row.food_kg, 0);
  const totalTransport = weekLogs.reduce((sum, row) => sum + row.transport_kg, 0);
  const totalEnergy = weekLogs.reduce((sum, row) => sum + row.energy_kg, 0);

  // Compare to the prior week (days 8-14)
  const priorLogs = db.prepare(`
    SELECT food_kg, transport_kg, energy_kg FROM daily_logs 
    WHERE user_id = ? 
    ORDER BY log_date DESC LIMIT 7 OFFSET 7
  `).all(userId);

  const priorFood = priorLogs.reduce((sum, row) => sum + row.food_kg, 0) || 1.0;
  const priorTransport = priorLogs.reduce((sum, row) => sum + row.transport_kg, 0) || 1.0;
  const priorEnergy = priorLogs.reduce((sum, row) => sum + row.energy_kg, 0) || 1.0;

  res.json({
    today: {
      total_kg: todayLog.total_kg,
      progress_pct: Number(progress.toFixed(1)),
      mood: latestRun.mood || 'neutral',
      message: latestRun.message || 'Hi! Let\'s work on lowering your footprint today.',
      suggested_action: latestRun.suggested_action
    },
    week: {
      food: Number(totalFood.toFixed(1)),
      transport: Number(totalTransport.toFixed(1)),
      energy: Number(totalEnergy.toFixed(1)),
      foodDelta: Number(((totalFood - priorFood) / priorFood * 100).toFixed(1)),
      transportDelta: Number(((totalTransport - priorTransport) / priorTransport * 100).toFixed(1)),
      energyDelta: Number(((totalEnergy - priorEnergy) / priorEnergy * 100).toFixed(1))
    }
  });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 3.5 Carbon Footprint History for Stacked Area Chart ─────────────────────
app.get('/api/dashboard/history', optionalAuth, (req, res) => {
  if (!req.user) return res.json([]);
  try {
    const userId = req.user.id;
  const logs = db.prepare(`
    SELECT log_date, food_kg, transport_kg, energy_kg FROM daily_logs
    WHERE user_id = ?
    ORDER BY log_date DESC LIMIT 30
  `).all(userId);
  
  logs.reverse();

  const startDate = logs.length > 0 ? logs[0].log_date : new Date(Date.now() - 30*24*60*60*1000).toISOString().slice(0,10);
  const bills = db.prepare(`
    SELECT scan_date, type, co2_kg FROM bill_scans
    WHERE user_id = ? AND scan_date >= ?
  `).all(userId, startDate);

  const billsMap = {};
  bills.forEach(b => {
    if (!billsMap[b.scan_date]) billsMap[b.scan_date] = [];
    billsMap[b.scan_date].push(b);
  });

  const history = logs.map(log => {
    const dateStr = log.log_date;
    const dayBills = billsMap[dateStr] || [];
    
    let electricity = 0;
    let gas = 0;

    dayBills.forEach(b => {
      if (b.type === 'electricity') {
        electricity += b.co2_kg;
      } else if (['gas', 'lpg', 'petrol', 'diesel'].includes(b.type)) {
        gas += b.co2_kg;
      }
    });

    if (electricity === 0 && gas === 0) {
      electricity = Number((log.energy_kg * 0.6).toFixed(2));
      gas = Number((log.energy_kg * 0.4).toFixed(2));
    } else {
      const totalBillEnergy = electricity + gas;
      if (totalBillEnergy < log.energy_kg) {
        electricity += Number((log.energy_kg - totalBillEnergy).toFixed(2));
      }
    }

    return {
      date: dateStr,
      food: Number(log.food_kg.toFixed(2)),
      transport: Number(log.transport_kg.toFixed(2)),
      electricity: Number(electricity.toFixed(2)),
      gas: Number(gas.toFixed(2)),
      total: Number((log.food_kg + log.transport_kg + electricity + gas).toFixed(2))
    };
  });

  res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ── 4. Leaderboard Pulse ────────────────────────────────────────────────────
app.get('/api/leaderboard', optionalAuth, (req, res) => {
  if (!req.user) return res.json({ level: 'national', note: 'Login to see your local leaderboard.', list: [] });
  try {
    const level = req.query.level || 'ward';
  const state = req.user.state;
  const city = req.user.city;
  const ward = req.user.ward;

  let query = '';
  let params = [];
  let note = '';
  let activeLevel = level;

  if (level === 'ward') {
    const wardUsers = db.prepare('SELECT COUNT(DISTINCT id) as cnt FROM users WHERE state = ? AND city = ? AND ward = ?').get(state, city, ward);
    if (wardUsers && wardUsers.cnt >= 3) {
      query = `
        SELECT name, avatar, avg_footprint FROM (
          SELECT users.name, 'U' as avatar, AVG(daily_logs.total_kg) as avg_footprint
          FROM daily_logs 
          JOIN users ON daily_logs.user_id = users.id 
          WHERE users.state = ? AND users.city = ? AND users.ward = ?
          GROUP BY users.id
        ) ORDER BY avg_footprint ASC LIMIT 10
      `;
      params = [state, city, ward];
    } else {
      activeLevel = 'city';
      note = 'Ward has under 3 users. Showing city leaderboard instead.';
    }
  }

  if (activeLevel === 'city') {
    const cityUsers = db.prepare('SELECT COUNT(DISTINCT id) as cnt FROM users WHERE state = ? AND city = ?').get(state, city);
    if (cityUsers && cityUsers.cnt >= 3) {
      query = `
        SELECT name, avatar, avg_footprint FROM (
          SELECT users.name, 'U' as avatar, AVG(daily_logs.total_kg) as avg_footprint
          FROM daily_logs 
          JOIN users ON daily_logs.user_id = users.id 
          WHERE users.state = ? AND users.city = ?
          GROUP BY users.id
        ) ORDER BY avg_footprint ASC LIMIT 10
      `;
      params = [state, city];
    } else {
      activeLevel = 'state';
      note = 'City has under 3 users. Showing state leaderboard instead.';
    }
  }

  if (activeLevel === 'state') {
    const stateUsers = db.prepare('SELECT COUNT(DISTINCT id) as cnt FROM users WHERE state = ?').get(state);
    if (stateUsers && stateUsers.cnt < 5) {
      note = `State has under 5 users. Displaying national leaders instead.`;
      query = `
        SELECT name, avatar, avg_footprint FROM (
          SELECT users.name, 'U' as avatar, AVG(daily_logs.total_kg) as avg_footprint
          FROM daily_logs 
          JOIN users ON daily_logs.user_id = users.id 
          GROUP BY users.id
        ) ORDER BY avg_footprint ASC LIMIT 10
      `;
      params = [];
    } else {
      query = `
        SELECT name, avatar, avg_footprint FROM (
          SELECT users.name, 'U' as avatar, AVG(daily_logs.total_kg) as avg_footprint
          FROM daily_logs 
          JOIN users ON daily_logs.user_id = users.id 
          WHERE users.state = ?
          GROUP BY users.id
        ) ORDER BY avg_footprint ASC LIMIT 10
      `;
      params = [state];
    }
  }

  const list = db.prepare(query).all(...params);
  res.json({
    level: activeLevel,
    note,
    list: list.map(item => ({
      name: item.name,
      avatar: item.avatar,
      avg_footprint: Number(item.avg_footprint.toFixed(2))
    }))
  });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Scanners Hub Upload
app.post('/api/scanner/upload', requireAuth, rateLimitMiddleware(scannerLimiter, 60 * 1000, 20), async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, textContent, fileType, fileSize } = req.body; 

    if (!type || !textContent) {
      return res.status(400).json({ error: 'Scanner type and OCR text content are required' });
    }

    // Server-side verification for simulated file upload properties
    if (fileType && !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(fileType)) {
      return res.status(400).json({ error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.' });
    }
    if (fileSize && fileSize > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds the 5MB limit.' });
    }

    // Prevent absurdly large text submissions
    if (textContent.length > 50000) {
      return res.status(400).json({ error: 'Text content exceeds maximum length' });
    }

    const parsed = ocrService.parseOcrText(textContent, type === 'grocery' ? 'grocery' : 'bill');
    const todayStr = new Date().toISOString().slice(0, 10);

    // If confidence is low, don't insert to DB yet, tell frontend to show correction form
    if (parsed.confidence < 0.5) {
      return res.json({
        success: true,
        requiresCorrection: true,
        parsed: parsed.data,
        confidence: parsed.confidence
      });
    }

    // Ensure today's log exists
    let todayLog = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?').get(userId, todayStr);
    if (!todayLog) {
      const base = emissionsEngine.getProfileDailyBaseline(req.user.diet, req.user.commute);
      db.prepare(`
        INSERT INTO daily_logs (user_id, log_date, food_kg, transport_kg, energy_kg, total_kg, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, todayStr, base.food_kg, base.transport_kg, base.energy_kg, base.total_kg, JSON.stringify({ note: "Auto baseline" }));
    }

    if (type === 'grocery') {
      const items = parsed.data.items || [];
      const total_kg = parsed.data.total_kg || 0;

      db.prepare(`
        INSERT INTO receipt_scans (user_id, scan_date, items, total_kg, image_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, todayStr, JSON.stringify(items), total_kg, 'scanned_receipt.png');

      // Update today's daily log
      db.prepare(`
        UPDATE daily_logs 
        SET food_kg = food_kg + ?, total_kg = total_kg + ? 
        WHERE user_id = ? AND log_date = ?
      `).run(total_kg, total_kg, userId, todayStr);
    } else {
      // Utility/fuel bill
      const data = parsed.data;
      db.prepare(`
        INSERT INTO bill_scans (user_id, scan_date, type, provider, amount, units, co2_kg, billing_period, image_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        todayStr,
        data.type || 'electricity',
        data.provider || 'BESCOM',
        data.amount || 0,
        data.units || 0,
        data.co2_kg || 0,
        data.period || todayStr.slice(0, 7),
        'scanned_bill.png'
      );

      // Update energy/transport part of today's log depending on bill type
      const isFuel = ['petrol', 'diesel'].includes(data.type);
      if (isFuel) {
        db.prepare(`
          UPDATE daily_logs 
          SET transport_kg = transport_kg + ?, total_kg = total_kg + ? 
          WHERE user_id = ? AND log_date = ?
        `).run(data.co2_kg, data.co2_kg, userId, todayStr);
      } else {
        db.prepare(`
          UPDATE daily_logs 
          SET energy_kg = energy_kg + ?, total_kg = total_kg + ? 
          WHERE user_id = ? AND log_date = ?
        `).run(data.co2_kg, data.co2_kg, userId, todayStr);
      }
    }

    // Trigger agent reasoning cycle immediately on new scan
    const runInfo = await agentService.runAgentCycle(userId);

    res.json({
      success: true,
      requiresCorrection: false,
      parsed: parsed.data,
      confidence: parsed.confidence,
      instantInsight: runInfo.message
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual correction endpoint if OCR has low confidence
app.post('/api/scanner/manual-correct', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, details } = req.body;
    const todayStr = new Date().toISOString().slice(0, 10);

    // Ensure today's log exists
    let todayLog = db.prepare('SELECT * FROM daily_logs WHERE user_id = ? AND log_date = ?').get(userId, todayStr);
    if (!todayLog) {
      const base = emissionsEngine.getProfileDailyBaseline(req.user.diet, req.user.commute);
      db.prepare(`
        INSERT INTO daily_logs (user_id, log_date, food_kg, transport_kg, energy_kg, total_kg, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(userId, todayStr, base.food_kg, base.transport_kg, base.energy_kg, base.total_kg, JSON.stringify({ note: "Auto baseline" }));
    }

    if (type === 'grocery') {
      const total_kg = parseFloat(details.total_kg);
      db.prepare(`
        INSERT INTO receipt_scans (user_id, scan_date, items, total_kg, image_name)
        VALUES (?, ?, ?, ?, ?)
      `).run(userId, todayStr, JSON.stringify(details.items || []), total_kg, 'manual_receipt.png');

      db.prepare(`
        UPDATE daily_logs 
        SET food_kg = food_kg + ?, total_kg = total_kg + ? 
        WHERE user_id = ? AND log_date = ?
      `).run(total_kg, total_kg, userId, todayStr);
    } else {
      const co2_kg = emissionsEngine.calculateEnergyEmissions(details.type, parseFloat(details.units));
      db.prepare(`
        INSERT INTO bill_scans (user_id, scan_date, type, provider, amount, units, co2_kg, billing_period, image_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        todayStr,
        details.type,
        details.provider,
        parseFloat(details.amount || 0),
        parseFloat(details.units || 0),
        co2_kg,
        details.period,
        'manual_bill.png'
      );

      const isFuel = ['petrol', 'diesel'].includes(details.type);
      if (isFuel) {
        db.prepare(`
          UPDATE daily_logs 
          SET transport_kg = transport_kg + ?, total_kg = total_kg + ? 
          WHERE user_id = ? AND log_date = ?
        `).run(co2_kg, co2_kg, userId, todayStr);
      } else {
        db.prepare(`
          UPDATE daily_logs 
          SET energy_kg = energy_kg + ?, total_kg = total_kg + ? 
          WHERE user_id = ? AND log_date = ?
        `).run(co2_kg, co2_kg, userId, todayStr);
      }
    }

    const runInfo = await agentService.runAgentCycle(userId);
    res.json({ success: true, instantInsight: runInfo.message });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. 10-Year Projections
app.post('/api/projection', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { evAdoption, vegDietShift, flightReduction } = req.body;

    const result = agentService.tools.runProjection(userId, { evAdoption, vegDietShift, flightReduction });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 7. Imprint Feed ─────────────────────────────────────────────────────────
app.get('/api/feed', optionalAuth, (req, res) => {
  if (!req.user) return res.json([]);
  try {
    const userId = req.user.id;
    const runs = db.prepare('SELECT * FROM agent_runs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 20').all(userId);
    
    // Fetch feedback map
    const feedbackList = db.prepare('SELECT action_id, accepted FROM agent_feedback WHERE user_id = ?').all(userId);
    const feedbackMap = {};
    feedbackList.forEach(fb => {
      feedbackMap[fb.action_id] = fb.accepted === 1 ? 'accepted' : 'dismissed';
    });

    const feedCards = runs.map(run => {
      let action = null;
      try {
        action = JSON.parse(run.suggested_action);
        if (action && action.action_id) {
          action.status = feedbackMap[action.action_id] || 'pending';
        }
      } catch (errFeed) {
        console.warn('Failed to parse suggested action in feed:', errFeed);
      }

      return {
        id: run.id,
        timestamp: run.timestamp,
        mood: run.mood,
        message: run.message,
        suggested_action: action,
        trace: run.reasoning_trace
      };
    });

    res.json(feedCards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Trigger Agent Cycle
app.post('/api/agent/run', requireAuth, async (req, res) => {
  try {
    const result = await agentService.runAgentCycle(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Suggested Action Feedback loop
app.post('/api/agent/feedback', requireAuth, (req, res) => {
  try {
    const userId = req.user.id;
    const { action_id, accepted } = req.body;

    const result = agentService.tools.recordFeedback(userId, action_id, accepted);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// 9.5 Profile Edit Endpoint
app.patch('/api/users/profile', requireAuth, (req, res) => {
  const userId = req.user.id;
  const { name, diet, commute, state, city, ward } = req.body;

  if (!name || !diet || !commute || !state || !city || !ward) {
    return res.status(400).json({ error: 'All profile fields are required' });
  }

  // Validate state -> city -> ward against LOCATIONS_DATA
  if (!LOCATIONS_DATA[state]) {
    return res.status(400).json({ error: `Invalid state: ${state}` });
  }
  if (!LOCATIONS_DATA[state][city]) {
    return res.status(400).json({ error: `Invalid city ${city} for state ${state}` });
  }
  if (!LOCATIONS_DATA[state][city].includes(ward)) {
    return res.status(400).json({ error: `Invalid ward ${ward} for city ${city} and state ${state}` });
  }

  try {
    const oldUser = req.user;

    // Update user record
    db.prepare(`
      UPDATE users
      SET name = ?, diet = ?, commute = ?, state = ?, city = ?, ward = ?
      WHERE id = ?
    `).run(name, diet, commute, state, city, ward, userId);

    // If diet or commute changed, update the user's auto-baseline logs
    if (oldUser.diet !== diet || oldUser.commute !== commute) {
      const newBase = emissionsEngine.getProfileDailyBaseline(diet, commute);
      db.prepare(`
        UPDATE daily_logs
        SET food_kg = ?, transport_kg = ?, total_kg = ? + ? + energy_kg
        WHERE user_id = ? AND details LIKE '%Auto baseline%'
      `).run(newBase.food_kg, newBase.transport_kg, newBase.food_kg, newBase.transport_kg, userId);
    }

    // If location, diet, or commute changed, update aggregates
    if (
      oldUser.state !== state || 
      oldUser.city !== city || 
      oldUser.ward !== ward ||
      oldUser.diet !== diet ||
      oldUser.commute !== commute
    ) {
      // Re-trigger global recalculation of aggregates to keep ward_aggregates matching all users' current locations
      // Clear current aggregates
      db.prepare("DELETE FROM ward_aggregates").run();

      const insertAggregate = db.prepare(`
        INSERT INTO ward_aggregates (location_level, state, city, ward, avg_co2_kg, total_users)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      // Ward level
      const wardAvgs = db.prepare(`
        SELECT users.state, users.city, users.ward, AVG(daily_logs.total_kg) as avg_co2, COUNT(DISTINCT users.id) as user_count
        FROM daily_logs 
        JOIN users ON daily_logs.user_id = users.id
        GROUP BY users.state, users.city, users.ward
      `).all();
      
      wardAvgs.forEach(row => {
        insertAggregate.run('ward', row.state, row.city, row.ward, row.avg_co2, row.user_count);
      });

      // City level
      const cityAvgs = db.prepare(`
        SELECT users.state, users.city, AVG(daily_logs.total_kg) as avg_co2, COUNT(DISTINCT users.id) as user_count
        FROM daily_logs 
        JOIN users ON daily_logs.user_id = users.id
        GROUP BY users.state, users.city
      `).all();

      cityAvgs.forEach(row => {
        insertAggregate.run('city', row.state, row.city, '', row.avg_co2, row.user_count);
      });

      // State level
      const stateAvgs = db.prepare(`
        SELECT users.state, AVG(daily_logs.total_kg) as avg_co2, COUNT(DISTINCT users.id) as user_count
        FROM daily_logs 
        JOIN users ON daily_logs.user_id = users.id
        GROUP BY users.state
      `).all();

      stateAvgs.forEach(row => {
        insertAggregate.run('state', row.state, '', '', row.avg_co2, row.user_count);
      });
    }

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({
      success: true,
      message: `Quack! Your profile has been updated. I've recalculated the local standings, let's keep shrinking that footprint!`,
      user: updatedUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── 10. Profile Data ────────────────────────────────────────────────────────
app.get('/api/profile', optionalAuth, (req, res) => {
  if (!req.user) {
    return res.json({
      user: { name: 'Guest', diet: '', commute: '', location: '' },
      streak: 0,
      totalSaved_kg: 0,
      badges: []
    });
  }
  try {
    const userId = req.user.id;

  const countFeedback = db.prepare('SELECT COUNT(*) as cnt FROM agent_feedback WHERE user_id = ? AND accepted = 1').get(userId);
  const actionsAccepted = countFeedback ? countFeedback.cnt : 0;

  // Streak counter (days with logs)
  const logs = db.prepare('SELECT DISTINCT log_date FROM daily_logs WHERE user_id = ? ORDER BY log_date DESC').all(userId);
  let streak = 0;
  let nextExpected = new Date();
  
  for (let i = 0; i < logs.length; i++) {
    const logDate = new Date(logs[i].log_date);
    // strip hours
    logDate.setHours(0,0,0,0);
    const expected = new Date(nextExpected);
    expected.setHours(0,0,0,0);

    const diffTime = Math.abs(expected - logDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 1) {
      streak++;
      nextExpected = logDate;
    } else {
      break;
    }
  }

  // Calculate sum of total emissions saved (accepted recommendations times 30 days)
  const feedbackList = db.prepare('SELECT action_id FROM agent_feedback WHERE user_id = ? AND accepted = 1').all(userId);
  let totalSaved = 0;
  feedbackList.forEach(_fb => {
    totalSaved += 30; // nominal 30kg savings per accepted action for gamification visual baseline
  });

  // Milestones badges
  const badges = [];
  if (streak >= 7) badges.push({ id: 'streak_7', title: 'Carbon Sentinel', desc: 'Log footprint 7 days in a row' });
  if (streak >= 30) badges.push({ id: 'streak_30', title: 'Climate Guardian', desc: 'Active logging for 30 days' });
  if (actionsAccepted >= 1) badges.push({ id: 'act_1', title: 'Eco Starter', desc: 'Accept your first reduction recommendation' });
  if (actionsAccepted >= 5) badges.push({ id: 'act_5', title: 'Earth Champion', desc: 'Accept 5 reduction suggestions' });

  // Default badges just to populate
  if (badges.length === 0) {
    badges.push({ id: 'onboard', title: 'First Step', desc: 'Onboarding completed and profile setup' });
  }

  res.json({
    user: {
      name: req.user.name,
      diet: req.user.diet,
      commute: req.user.commute,
      location: `${req.user.ward}, ${req.user.city}, ${req.user.state}`
    },
    streak,
    totalSaved_kg: totalSaved || 15,
    badges
  });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SPA fallback: serve index.html for any non-API route in production
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(STATIC_DIR, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Imprint server listening on port ${PORT}`);
  });
}
module.exports = app;
