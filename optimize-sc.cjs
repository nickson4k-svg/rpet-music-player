const fs = require('fs');

// 1. Update playerStore.ts to inject transcoding URL directly into track.url
let store = fs.readFileSync('src/stores/playerStore.ts', 'utf8');
store = store.replace(
  "tracks = scTracks.map(t => ({",
  `tracks = scTracks.map(t => {
          let transcoding = t.media?.transcodings?.find((tr: any) => tr.format.protocol === 'progressive');
          if (!transcoding && t.media?.transcodings?.length) transcoding = t.media.transcodings[0];
          return {`
);
store = store.replace(
  "url: `soundcloud:${t.id}`\n          } as any));",
  "url: transcoding ? `soundcloud:\${transcoding.url}` : `soundcloud:\${t.id}`\n          } as any);\n        });"
);
fs.writeFileSync('src/stores/playerStore.ts', store);


// 2. Update AudioEngine.tsx to correctly split track.url
let engine = fs.readFileSync('src/components/Player/AudioEngine.tsx', 'utf8');
engine = engine.replace(
  "const trackId = track.url.split(':')[1];",
  "const trackId = track.url.replace('soundcloud:', '');"
);
fs.writeFileSync('src/components/Player/AudioEngine.tsx', engine);


// 3. Update soundcloud.ts to handle the direct transcoding URL if passed
let sc = fs.readFileSync('src/lib/soundcloud.ts', 'utf8');
const scOldStreamUrl = `export async function getSCStreamUrl(trackId: string): Promise<string | null> {
  try {
    const clientId = await getSCClientId();
    
    // First, fetch the track details to get the transcodings
    const res = await fetch(\`/api/soundcloud/tracks/\${trackId}?client_id=\${clientId}\`);
    if (!res.ok) return null;
    
    const track: SCTrack = await res.json();
    
    // Prioritize progressive streams (MP3/AAC directly) over HLS (m3u8) since native audio tag doesn't support HLS universally
    let transcoding = track.media.transcodings.find(t => t.format.protocol === 'progressive');
    
    // Fallback to HLS if progressive is not available (though it might fail on some browsers)
    if (!transcoding) {
      transcoding = track.media.transcodings.find(t => t.format.protocol === 'hls');
    }
    
    if (!transcoding) return null;
    
    // Fetch the actual streaming URL
    const proxyUrl = transcoding.url.replace('https://api-v2.soundcloud.com', '/api/soundcloud');
    const streamInfoRes = await fetch(\`\${proxyUrl}?client_id=\${clientId}\`);`;

const scNewStreamUrl = `export async function getSCStreamUrl(trackIdOrUrl: string): Promise<string | null> {
  try {
    const clientId = await getSCClientId();
    let transcodingUrl = trackIdOrUrl;
    
    if (!trackIdOrUrl.startsWith('https://')) {
      // It's a track ID, fetch transcodings first
      const res = await fetch(\`/api/soundcloud/tracks/\${trackIdOrUrl}?client_id=\${clientId}\`);
      if (!res.ok) return null;
      
      const track: SCTrack = await res.json();
      let transcoding = track.media.transcodings.find(t => t.format.protocol === 'progressive') || track.media.transcodings.find(t => t.format.protocol === 'hls');
      if (!transcoding) return null;
      transcodingUrl = transcoding.url;
    }
    
    // Fetch the actual streaming URL
    const proxyUrl = transcodingUrl.replace('https://api-v2.soundcloud.com', '/api/soundcloud');
    const streamInfoRes = await fetch(\`\${proxyUrl}?client_id=\${clientId}\`);`;

sc = sc.replace(scOldStreamUrl, scNewStreamUrl);
fs.writeFileSync('src/lib/soundcloud.ts', sc);

console.log('Optimizations applied.');
