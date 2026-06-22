// Quick verification that optionalAuth GET endpoints return 200 without credentials
process.env.PORT = '5003';
process.env.DATABASE_FILE = 'imprint.db';
const app = require('./server');

const server = app.listen(5003, async () => {
  try {
    // Test /api/health - should return 200 always
    const h = await fetch('http://127.0.0.1:5003/api/health');
    console.log('HEALTH:', h.status, (await h.json()).status);

    // Test /api/dashboard without auth - should return 200 with guest payload
    const d = await fetch('http://127.0.0.1:5003/api/dashboard');
    const dj = await d.json();
    console.log('DASHBOARD UNAUTH:', d.status, 'has_today:', !!dj.today, 'msg:', dj.today && dj.today.message);

    // Test /api/feed without auth - should return 200 empty array
    const f = await fetch('http://127.0.0.1:5003/api/feed');
    const fj = await f.json();
    console.log('FEED UNAUTH:', f.status, 'is_array:', Array.isArray(fj));

    // Test /api/profile without auth - should return 200 guest payload
    const p = await fetch('http://127.0.0.1:5003/api/profile');
    const pj = await p.json();
    console.log('PROFILE UNAUTH:', p.status, 'user_name:', pj.user && pj.user.name);

    // Test /api/leaderboard without auth - should return 200
    const l = await fetch('http://127.0.0.1:5003/api/leaderboard');
    const lj = await l.json();
    console.log('LEADERBOARD UNAUTH:', l.status, 'has_list:', Array.isArray(lj.list));

    // Test POST /api/scanner/upload without auth - should still return 401
    const s = await fetch('http://127.0.0.1:5003/api/scanner/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    console.log('SCANNER POST UNAUTH:', s.status, '(expected 401)');

    console.log('\n✅ optionalAuth verification passed!');
  } catch (err) {
    console.error('❌ Verification failed:', err.message);
  } finally {
    server.close();
    process.exit(0);
  }
});
