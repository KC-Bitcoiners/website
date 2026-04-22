#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// This script creates clean URL structure for Next.js static export
// It converts /calendar.html to /calendar/index.html so that /calendar works

const outDir = path.join(__dirname, "../out");
const basePath = process.env.BASE_PATH || "";

// Automatically detect all page HTML files (skip index.html and 404.html)
const pages = fs
  .readdirSync(outDir)
  .filter((f) => f.endsWith(".html") && f !== "index.html" && f !== "404.html")
  .map((f) => f.replace(".html", ""));

function createCleanUrls() {
  console.log("Creating clean URL structure...");

  pages.forEach((page) => {
    const sourceFile = path.join(outDir, `${page}.html`);
    const targetDir = path.join(outDir, page);
    const targetFile = path.join(targetDir, "index.html");

    if (fs.existsSync(sourceFile)) {
      // Create directory
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Copy HTML file to index.html in directory
      fs.copyFileSync(sourceFile, targetFile);
      const cleanUrl = `${basePath}/${page}/`;
      console.log(`✅ Created clean URL: ${cleanUrl} -> ${targetFile}`);

      // Also create a redirect from /page.html to /page/ for backward compatibility
      const redirectContent = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0; url=${cleanUrl}">
    <script>
        window.location.replace('${cleanUrl}' + window.location.search + window.location.hash);
    </script>
</head>
<body>
    <p>Redirecting to <a href="${cleanUrl}">${cleanUrl}</a>...</p>
</body>
</html>`;

      fs.writeFileSync(sourceFile, redirectContent);
      console.log(`✅ Created redirect: /${page}.html -> ${cleanUrl}`);
    } else {
      console.warn(`⚠️  Source file not found: ${sourceFile}`);
    }
  });

  console.log("✨ Clean URL structure created successfully!");
}

if (require.main === module) {
  createCleanUrls();
}

module.exports = { createCleanUrls };
