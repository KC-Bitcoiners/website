#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// This script creates clean URL structure for Next.js static export
// It handles both flat HTML files and directory structures from SSG

const outDir = path.join(__dirname, '../out');

// Pages that need clean URLs
const pages = [
  'calendar',
  'shop',
  'events'
];

function createCleanUrls() {
  console.log('Creating clean URL structure...');
  
  pages.forEach(page => {
    const sourceFile = path.join(outDir, `${page}.html`);
    const targetDir = path.join(outDir, page);
    const targetFile = path.join(targetDir, 'index.html');
    
    if (fs.existsSync(sourceFile)) {
      // Case 1: flat HTML file exists, create directory structure
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      
      // Copy HTML file to index.html in directory
      fs.copyFileSync(sourceFile, targetFile);
      console.log(`✅ Created clean URL: /${page}/ -> ${targetFile}`);
      
      // Create redirect from /page.html to /page/ for backward compatibility
      const redirectContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0; url=/${page}/">
    <script>
        window.location.replace('/${page}/' + window.location.search + window.location.hash);
    </script>
</head>
<body>
    <p>Redirecting to <a href="/${page}/">/${page}/</a>...</p>
</body>
</html>`;
      
      fs.writeFileSync(sourceFile, redirectContent);
      console.log(`✅ Created redirect: /${page}.html -> /${page}/`);
    } else if (fs.existsSync(targetFile)) {
      // Case 2: directory structure already exists (from Next.js SSG)
      console.log(`✅ Clean URL already exists: /${page}/ -> ${targetFile}`);
      
      // Create flat HTML file for backward compatibility
      const flatFile = path.join(outDir, `${page}.html`);
      fs.copyFileSync(targetFile, flatFile);
      console.log(`✅ Created flat file: /${page}.html`);
    } else {
      console.warn(`⚠️  Neither source file nor directory found for: ${page}`);
    }
  });
  
  console.log('✨ Clean URL structure created successfully!');
}

if (require.main === module) {
  createCleanUrls();
}

module.exports = { createCleanUrls };
