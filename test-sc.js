async function testSC() {
  const html = await fetch('https://soundcloud.com').then(r => r.text());
  const matches = html.match(/<script crossorigin src="([^"]+)"/g);
  if (!matches) return console.log('no match');
  for (const match of matches) {
    const url = match.match(/src="([^"]+)"/)[1];
    const js = await fetch(url).then(r => r.text());
    const idMatch = js.match(/client_id:"([^"]+)"/);
    if (idMatch) {
      console.log('CLIENT_ID:', idMatch[1]);
      
      // Test search
      const searchRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=believer&client_id=${idMatch[1]}&limit=1`);
      const searchData = await searchRes.json();
      const track = searchData.collection[0];
      console.log('Track:', track.title);
      
      // Test stream
      const transcoding = track.media.transcodings.find(t => t.format.protocol === 'progressive');
      if (transcoding) {
        const streamUrl = transcoding.url + `?client_id=${idMatch[1]}`;
        const streamRes = await fetch(streamUrl);
        const streamData = await streamRes.json();
        console.log('Stream URL:', streamData.url);
      }
      return;
    }
  }
}
testSC();
