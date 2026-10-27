const fs = require('fs');
const s = fs.readFileSync('C:/ziko/ziko-update/.env','utf8');
console.log(s.includes('SUPABASE'));
console.log(s.split(/\r?\n/).filter(l=>l.match(/SUPABASE/i)).length);
