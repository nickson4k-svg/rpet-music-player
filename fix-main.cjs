const fs = require('fs');
let c = fs.readFileSync('src/components/Layout/MainLayout.tsx', 'utf8');

c = c.replace(
  "useState<'audius' | 'apple' | 'jiosaavn'>('jiosaavn')",
  "useState<'audius' | 'apple' | 'jiosaavn' | 'soundcloud'>('soundcloud')"
);

c = c.replace(
  "setSearchProvider(e.target.value as 'audius' | 'apple' | 'jiosaavn')",
  "setSearchProvider(e.target.value as 'audius' | 'apple' | 'jiosaavn' | 'soundcloud')"
);

c = c.replace(
  '<option value="jiosaavn">JioSaavn</option>',
  '<option value="soundcloud">SoundCloud</option>\n                  <option value="jiosaavn">JioSaavn</option>'
);

c = c.replace(
  'searchProvider === \'audius\' ? "Шукати в Audius..." : searchProvider === \'jiosaavn\' ? "Шукати в JioSaavn..." : "Шукати в Apple Music..."',
  'searchProvider === \'soundcloud\' ? "Шукати в SoundCloud..." : searchProvider === \'audius\' ? "Шукати в Audius..." : searchProvider === \'jiosaavn\' ? "Шукати в JioSaavn..." : "Шукати в Apple Music..."'
);

fs.writeFileSync('src/components/Layout/MainLayout.tsx', c);
