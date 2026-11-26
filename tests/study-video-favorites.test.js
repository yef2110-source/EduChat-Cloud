import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('study videos provide a favorites filter', () => {
  assert.match(html, /id="studyVideoFilter"/);
  assert.match(html, /value="favorites">المفضلة فقط/);
  assert.match(html, /mode !== 'favorites' \|\| v\.favorite/);
});

test('study video favorite toggle persists and updates button state', () => {
  assert.match(html, /v\.favorite\?'★ إزالة من المفضلة':'☆ إضافة للمفضلة'/);
  assert.match(html, /favorite\.setAttribute\('aria-pressed',v\.favorite\?'true':'false'\)/);
  assert.match(html, /\{\.\.\.x,favorite:!x\.favorite\}/);
  assert.match(html, /studyVideoFilter'\)\.addEventListener\('change',renderStudyVideos\)/);
});
