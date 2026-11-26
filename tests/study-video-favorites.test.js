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

test('study video library supports JSON backup and validated import', () => {
  assert.match(html, /id="exportStudyVideosBtn"/);
  assert.match(html, /id="importStudyVideosFile"/);
  assert.match(html, /file\.size>1024\*1024/);
  assert.match(html, /validStudyYoutubeUrl\(v\.url\)/);
  assert.match(html, /seen\.has\(id\)/);
  assert.match(html, /slice\(0,500\)\)\)/);
});

test('adding a duplicate video URL is rejected', () => {
  assert.match(html, /videos\.some\(v=>validStudyYoutubeUrl\(v\.url\)===videoId\)/);
  assert.match(html, /هذا الفيديو موجود بالفعل في مكتبتك/);
});
