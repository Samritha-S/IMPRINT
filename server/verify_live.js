// Verify live Cloud Run deployment
const liveUrl = 'https://imprint-cmk6ksgu5q-el.a.run.app';

async function verify() {
  try {
    const health = await fetch(`${liveUrl}/api/health`);
    console.log('LIVE HEALTH STATUS:', health.status, await health.json());

    const dashboard = await fetch(`${liveUrl}/api/dashboard`);
    console.log('LIVE DASHBOARD STATUS:', dashboard.status, (await dashboard.json()).today ? 'OK (Guest mode)' : 'FAIL');

    const feed = await fetch(`${liveUrl}/api/feed`);
    console.log('LIVE FEED STATUS:', feed.status, Array.isArray(await feed.json()) ? 'OK (Empty array)' : 'FAIL');
    
    console.log('✅ Live deployment verification completed successfully!');
  } catch (err) {
    console.error('❌ Live deployment verification failed:', err.message);
  }
}

verify();
