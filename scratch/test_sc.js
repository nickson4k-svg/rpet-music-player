async function test() {
  const res = await fetch('https://soundcloud.com', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  const scriptUrls = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map(m => m[1]);
  console.log('Found scripts:', scriptUrls.length);
  for (const url of scriptUrls) {
    try {
      const jsRes = await fetch(url);
      const js = await jsRes.text();
      const match = js.match(/client_id:"([a-zA-Z0-9]{32})"/i) || js.match(/client_id=([a-zA-Z0-9]{32})/i) || js.match(/client_id:"([^"]+)"/i);
      if (match) {
        console.log('FOUND CLIENT ID:', match[1], 'in', url);
        return match[1];
      }
    } catch (e) {
      console.log('Error fetching script', url);
    }
  }
}
test().then(id => console.log('Final Result:', id));
