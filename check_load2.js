const fs = require('fs');
const s = fs.readFileSync('C:/ziko/ziko-update/public/script.js','utf8');
const i = s.indexOf('async function loadSlots');
if(i>=0) {
  // find next function or big block
  let end = s.indexOf('d.min =', i);
  if(end < 0) end = i+1200;
  console.log(s.substring(i, end));
}
