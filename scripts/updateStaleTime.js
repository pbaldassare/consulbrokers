// scripts/updateStaleTime.js
const fs = require('fs');
const path = require('path');
const glob = require('glob');

const pattern = 'src/**/*.{ts,tsx}';
const files = glob.sync(pattern, { nodir: true });
let changedFiles = [];
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const newContent = content.replace(/staleTime:\s*[0-9_]+/g, 'staleTime: 300000');
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedFiles.push(file);
  }
});
console.log('Updated files:', changedFiles.length);
console.log(changedFiles.join('\n'));
