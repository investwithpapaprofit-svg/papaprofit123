import fs from 'fs';
import https from 'https';

const url = process.argv[2];
const dest = process.argv[3];

https.get(url, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    fs.writeFileSync(dest, data);
    console.log(`Downloaded ${url} to ${dest}`);
  });
}).on('error', (err) => {
  console.error(err);
});
