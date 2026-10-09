const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

test('mini program scaffold exposes required files and pages', () => {
  const required = [
    'project.config.json',
    'miniprogram/app.js',
    'miniprogram/app.json',
    'miniprogram/app.wxss',
    'miniprogram/sitemap.json'
  ];

  for (const relativePath of required) {
    assert.equal(fs.existsSync(path.join(root, relativePath)), true, relativePath);
  }

  const appConfig = JSON.parse(
    fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8')
  );

  assert.deepEqual(appConfig.pages, [
    'pages/index/index',
    'pages/room/room',
    'pages/table/table'
  ]);
});
