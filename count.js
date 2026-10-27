const fs = require('fs');
const s = fs.readFileSync('C:/ziko/ziko-update/public/script.js','utf8');
const i = s.indexOf('async function loadSlots');
if(i>=0) {
  const end = s.indexOf("document.getElementById('d')", i);
  const sub = s.substring(i, end>0?end:i+900);
  const count = (sub.match(/toMin/g)||[]).length;
  console.log(count);
} else console.log('no');
