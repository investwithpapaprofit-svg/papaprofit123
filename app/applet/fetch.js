const fs = require('fs');

async function download() {
  const url = process.argv[2];
  const dest = process.argv[3];
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    fs.writeFileSync(dest, text);
    console.log(`Downloaded ${url} to ${dest}`);
  } catch (err) {
    console.error(err);
  }
}

download();
