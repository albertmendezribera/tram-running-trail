import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INDEX, kindOf, offered, robotsOf, sitemapsOf } from './sitemap.mjs';

const page = (head) => `<!doctype html><html><head>${head}</head><body><link rel="canonical" href="https://example.com/in-the-body/"></body></html>`;

test('a page is offered at its canonical address, and not at all when it asks not to be listed', () => {
  assert.equal(offered(page('<link rel="canonical" href="https://tramrun.com/ca/curses/">')), 'https://tramrun.com/ca/curses/');
  assert.equal(offered(page('<meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://tramrun.com/ca/curses/x/">')), undefined);
  assert.equal(offered(page('<link href="https://tramrun.com/ca/" rel="canonical"><meta content="index" name="robots">')), 'https://tramrun.com/ca/');
  // Another meta, or a canonical outside the head, says nothing.
  assert.equal(offered(page('<meta name="description" content="noindex is a word">')), undefined);
  assert.equal(offered(page('<meta name="description" content="noindex is a word"><link rel="canonical" href="https://tramrun.com/ca/rutes/?a=1&amp;b=2">')), 'https://tramrun.com/ca/rutes/?a=1&b=2');
});

test('each address goes to the sitemap of its kind, whatever the language', () => {
  assert.equal(kindOf('https://tramrun.com/ca/curses/trail/baix-emporda/'), 'curses');
  assert.equal(kindOf('https://tramrun.com/es/carreras/'), 'curses');
  assert.equal(kindOf('https://tramrun.com/ca/rutes/calonge/'), 'rutes');
  assert.equal(kindOf('https://tramrun.com/ca/sabatilles/hoka/speedgoat-6/'), 'sabatilles');
  assert.equal(kindOf('https://tramrun.com/ca/comparar/a-vs-b/'), 'comparar');
  assert.equal(kindOf('https://tramrun.com/ca/'), 'pagines');
  assert.equal(kindOf('https://tramrun.com/'), 'pagines');
});

test('the sitemaps are one to a kind, each address once and in order, with an index that names them all', () => {
  const files = sitemapsOf(['https://tramrun.com/ca/rutes/sils/', 'https://tramrun.com/ca/', 'https://tramrun.com/ca/rutes/calonge/', 'https://tramrun.com/ca/rutes/sils/', 'https://tramrun.com/ca/curses/?a=1&b=2'], 'https://tramrun.com');
  assert.deepEqual(Object.keys(files).sort(), ['sitemap-curses.xml', 'sitemap-index.xml', 'sitemap-pagines.xml', 'sitemap-rutes.xml']);
  assert.deepEqual([...files['sitemap-rutes.xml'].matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), ['https://tramrun.com/ca/rutes/calonge/', 'https://tramrun.com/ca/rutes/sils/']);
  assert.match(files['sitemap-curses.xml'], /<loc>https:\/\/tramrun\.com\/ca\/curses\/\?a=1&amp;b=2<\/loc>/);
  assert.deepEqual([...files[INDEX].matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]), ['https://tramrun.com/sitemap-curses.xml', 'https://tramrun.com/sitemap-pagines.xml', 'https://tramrun.com/sitemap-rutes.xml']);
  for (const content of Object.values(files)) assert.match(content, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
});

test('an address that is not on the site stops the build', () => {
  assert.throws(() => sitemapsOf(['https://tram-staging.example.dev/ca/'], 'https://tramrun.com'), /not on https:\/\/tramrun\.com/);
});

test('the site names its sitemaps to every crawler; the test environment names none and shuts no door', () => {
  assert.equal(robotsOf('https://tramrun.com'), 'User-agent: *\nAllow: /\n\nSitemap: https://tramrun.com/sitemap-index.xml\n');
  const staging = robotsOf('https://tramrun.com', { staging: true });
  assert.doesNotMatch(staging, /Sitemap/);
  assert.match(staging, /^User-agent: \*\nDisallow:\n/m);
  assert.doesNotMatch(staging, /Disallow: \//);
});
