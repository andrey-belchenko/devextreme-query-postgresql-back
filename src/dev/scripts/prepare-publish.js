// scripts/prepare-publish.js
const fs = require('fs');
const path = require('path');

// Read the root package.json
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Create a minimal package.json
const minimalPackageJson = {
  name: packageJson.name,
  version: packageJson.version,
  main: 'index.js',
  types: 'index.d.ts',
  files: ['index.js', 'index.d.ts', '*.js', '*.d.ts'],
  keywords: packageJson.keywords,
  author: packageJson.author,
  license: packageJson.license,
  description: packageJson.description,
  repository: packageJson.repository,
  dependencies: packageJson.dependencies || {},
  publishConfig: packageJson.publishConfig || {}
};

// Copy dist/lib contents to dist (move to package root)
const distLibPath = path.join('dist', 'lib');
const distPath = 'dist';
fs.readdirSync(distLibPath).forEach(file => {
  fs.copyFileSync(
    path.join(distLibPath, file),
    path.join(distPath, file)
  );
});

// Remove dist/lib folder
fs.rmSync(distLibPath, { recursive: true, force: true });

// Write minimal package.json to dist
fs.writeFileSync(
  path.join('dist', 'package.json'),
  JSON.stringify(minimalPackageJson, null, 2)
);

// Copy README.md and LICENSE to dist
if (fs.existsSync('README.md')) {
  fs.copyFileSync('README.md', path.join('dist', 'README.md'));
}
if (fs.existsSync('LICENSE')) {
  fs.copyFileSync('LICENSE', path.join('dist', 'LICENSE'));
}

console.log('Minimal package.json and files prepared in dist');