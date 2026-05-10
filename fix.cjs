const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf-8');
content = content.replace('fitting the schema.\\\`;', 'fitting the schema.\`;');
fs.writeFileSync('server.ts', content);
