import https from 'https';
import fs from 'fs';

https.get('https://placehold.co/192x192/0f172a/84cc16.png?text=PapaProfit', (res) => {
  res.pipe(fs.createWriteStream('public/icon-192x192.png'));
});

https.get('https://placehold.co/512x512/0f172a/84cc16.png?text=PapaProfit', (res) => {
  res.pipe(fs.createWriteStream('public/icon-512x512.png'));
});
