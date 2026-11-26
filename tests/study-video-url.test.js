import test from 'node:test';
import assert from 'node:assert/strict';
import { validStudyYoutubeUrl } from '../src/study-videos/youtube-url.js';
const ID = 'abcdefghijk';
test('accepts standard watch, short, embed, shorts and live URLs', () => {
  for (const url of [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}`,
    `https://youtube.com/embed/${ID}`,
    `https://m.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`
  ]) assert.equal(validStudyYoutubeUrl(url), ID, url);
});
test('rejects insecure, spoofed, malformed and non-video URLs', () => {
  for (const url of [
    `http://youtube.com/watch?v=${ID}`,
    `https://youtube.com.evil.test/watch?v=${ID}`,
    `https://evil.test/?v=${ID}`,
    `https://user:pass@youtube.com/watch?v=${ID}`,
    `https://youtube.com:8443/watch?v=${ID}`,
    `https://youtu.be/${ID}/extra`,
    `https://youtube.com/shorts/not-an-id`,
    'not a url'
  ]) assert.equal(validStudyYoutubeUrl(url), null, url);
});
