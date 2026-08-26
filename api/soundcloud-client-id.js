let cachedClientId = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
let lastFetched = 0;

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    if (res) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      return res.status(200).end();
    }
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });
  }

  const now = Date.now();
  // Refresh cache every 2 hours
  if (now - lastFetched > 2 * 60 * 60 * 1000) {
    try {
      const pageRes = await fetch('https://soundcloud.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });

      if (pageRes.ok) {
        const html = await pageRes.text();
        const scriptUrls = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(m => m[1]);

        for (const url of scriptUrls) {
          try {
            const jsRes = await fetch(url);
            const js = await jsRes.text();
            const match = js.match(/client_id:"([a-zA-Z0-9]{32})"/i) || js.match(/client_id=([a-zA-Z0-9]{32})/i);
            if (match && match[1]) {
              cachedClientId = match[1];
              lastFetched = now;
              break;
            }
          } catch (e) {
            // ignore script fetch error
          }
        }
      }
    } catch (e) {
      console.warn('Failed to dynamically fetch SoundCloud client_id, using fallback:', e);
    }
  }

  const result = { clientId: cachedClientId };

  if (res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json(result);
  }

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 's-maxage=3600, stale-while-revalidate',
    },
  });
}
