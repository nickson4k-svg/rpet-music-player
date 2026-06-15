const fs = require('fs');
let c = fs.readFileSync('src/components/Player/AudioEngine.tsx', 'utf8');

const target = `      if (typeof track.url === 'string' && track.url.startsWith('audius:')) {
        const trackId = track.url.split(':')[1];
        url = \`https://discoveryprovider.audius.co/v1/tracks/\${trackId}/stream?app_name=Rpet\`;
      }`;

const replacement = `      if (typeof track.url === 'string' && track.url.startsWith('audius:')) {
        const trackId = track.url.split(':')[1];
        url = \`https://discoveryprovider.audius.co/v1/tracks/\${trackId}/stream?app_name=Rpet\`;
      }

      if (typeof track.url === 'string' && track.url.startsWith('soundcloud:')) {
        const trackId = track.url.split(':')[1];
        const { getSCStreamUrl } = await import('../../lib/soundcloud');
        const scUrl = await getSCStreamUrl(trackId);
        if (scUrl) url = scUrl;
      }`;

c = c.replace(target, replacement);
fs.writeFileSync('src/components/Player/AudioEngine.tsx', c);
