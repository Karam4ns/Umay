'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
let FileTools;
try { ({ FileTools } = require('../src/system-files.cjs')); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }

async function fixture(t, options = {}) {
  assert.equal(typeof FileTools, 'function', 'FileTools implementation is available');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'umay-files-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const tools = new FileTools({ roots: [{ name: 'test', path: root }], ...options });
  const p = (...parts) => path.join(root, ...parts);
  return { root, tools, p, run: (name, args, context) => tools.perform(`files_${name}`, args, context) };
}

test('file discovery schemas expose callable general primitives', async t => {
  const { tools, run, root } = await fixture(t);
  const names = tools.definitions().map(x => x.name);
  assert.deepEqual(names.sort(), ['roots', 'list', 'find', 'stat', 'read', 'write', 'mkdir', 'copy', 'move', 'rename', 'trash', 'open'].map(x => `files_${x}`).sort());
  for (const definition of tools.definitions()) assert.equal(definition.inputSchema.type, 'object');
  assert.equal((await run('roots', {})).roots[0].path, root);
  await assert.rejects(run('stat', { path: 'relative.txt' }), { code: 'INVALID_PATH' });
  await assert.rejects(tools.perform('files_missing', {}), { code: 'UNKNOWN_TOOL' });
});

test('Unicode create and guarded replace return current file versions without silent clobber', async t => {
  const { run, p } = await fixture(t);
  const file = p('çağrı 你好.txt');
  await run('write', { path: file, content: 'ilk sürüm' });
  const stat = await run('stat', { path: file });
  assert.equal(stat.type, 'file');
  assert.ok(stat.version);
  await assert.rejects(run('write', { path: file, content: 'kaybolmasın' }), { code: 'EEXIST' });
  await run('write', { path: file, content: 'ikinci', expectedVersion: stat.version });
  await assert.rejects(run('write', { path: file, content: 'eski', expectedVersion: stat.version }), { code: 'VERSION_CONFLICT' });
  assert.equal(await fs.readFile(file, 'utf8'), 'ikinci');
});

test('known roots are discovery hints rather than a filesystem sandbox', async t => {
  const { run } = await fixture(t);
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'umay-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  const file = path.join(outside, 'other.txt');
  await run('write', { path: file, content: 'yetkili' });
  assert.equal((await run('read', { path: file })).content, 'yetkili');
});

test('read is paged by bytes and rejects oversize requests without reading everything', async t => {
  const { run, p } = await fixture(t);
  await fs.writeFile(p('large.txt'), 'abcdef');
  const first = await run('read', { path: p('large.txt'), maxBytes: 3 });
  assert.equal(first.content, 'abc');
  assert.equal(first.nextOffset, 3);
  assert.equal(first.truncated, true);
  assert.equal((await run('read', { path: p('large.txt'), offset: 3, maxBytes: 3 })).content, 'def');
  await assert.rejects(run('read', { path: p('large.txt'), maxBytes: 999999999 }), { code: 'INVALID_ARGUMENT' });
});

test('UTF-8 text pagination never splits a multibyte character even with tiny pages', async t => {
  const { run, p } = await fixture(t);
  await fs.writeFile(p('text'), 'ağ😊z');
  let offset = 0, text = '', page;
  do {
    page = await run('read', { path: p('text'), offset, maxBytes: 2 });
    assert.ok(page.nextOffset > offset);
    text += page.content;
    offset = page.nextOffset;
  } while (page.truncated);
  assert.equal(text, 'ağ😊z');
});

test('undeclared arguments cannot disable link traversal protection', async t => {
  const { run, p } = await fixture(t);
  await fs.writeFile(p('target'), 'do not replace');
  await assert.rejects(run('write', { path: p('target'), content: 'oops', finalLink: true }), { code: 'INVALID_ARGUMENT' });
  assert.equal(await fs.readFile(p('target'), 'utf8'), 'do not replace');
});

test('copying a directory containing a link reports the created partial destination', async t => {
  const { run, p } = await fixture(t);
  await fs.mkdir(p('source'));
  await fs.mkdir(p('elsewhere'));
  await fs.writeFile(p('elsewhere/untouched'), 'keep');
  await fs.symlink(p('elsewhere'), p('source/link'), 'junction');
  await assert.rejects(run('copy', { source: p('source'), destination: p('partial') }), error => {
    assert.equal(error.code, 'SYMLINK_NOT_ALLOWED');
    assert.equal(error.receipt.status, 'partial');
    assert.equal(error.receipt.completed[0].path, p('partial'));
    return true;
  });
  assert.equal(await fs.readFile(p('elsewhere/untouched'), 'utf8'), 'keep');
});

test('list and recursive find continue bounded pages and reset invalidates cursors', async t => {
  const { run, tools, p, root } = await fixture(t);
  await fs.mkdir(p('nested'));
  for (const file of ['a.txt', 'b.txt', 'nested/c.txt']) await fs.writeFile(p(file), file);
  const first = await run('list', { path: root, limit: 1 });
  assert.equal(first.entries.length, 1);
  const second = await run('list', { cursor: first.nextCursor, limit: 1 });
  assert.equal(second.entries.length, 1);
  assert.notEqual(first.entries[0].path, second.entries[0].path);
  const found = [];
  let page = await run('find', { path: root, query: '.txt', limit: 1 });
  do { found.push(...page.entries.map(x => x.name)); page = page.nextCursor ? await run('find', { cursor: page.nextCursor, limit: 1 }) : null; } while (page);
  assert.deepEqual(found.sort(), ['a.txt', 'b.txt', 'c.txt']);
  tools.reset();
  await assert.rejects(run('list', { cursor: first.nextCursor }), { code: 'INVALID_CURSOR' });
});

test('resuming find rejects a nested ancestor replaced by a junction', async t => {
  const { run, p } = await fixture(t);
  await fs.mkdir(p('search/nested'), { recursive: true });
  await fs.mkdir(p('elsewhere'));
  await fs.writeFile(p('search/nested/a'), 'first');
  await fs.writeFile(p('search/nested/b'), 'second');
  await fs.writeFile(p('elsewhere/b'), 'must not be observed');
  const first = await run('find', { path: p('search'), query: '', limit: 2 });
  assert.deepEqual(first.entries.map(entry => entry.name), ['nested', 'a']);
  await fs.rename(p('search/nested'), p('saved'));
  await fs.symlink(p('elsewhere'), p('search/nested'), 'junction');
  await assert.rejects(run('find', { cursor: first.nextCursor, limit: 2 }), error => ['SYMLINK_NOT_ALLOWED', 'TRAVERSAL_CHANGED'].includes(error.code));
  await assert.rejects(run('find', { cursor: first.nextCursor }), { code: 'INVALID_CURSOR' });
});

test('resuming find rejects a nested ancestor replaced by a different ordinary directory', async t => {
  const { run, p } = await fixture(t);
  await fs.mkdir(p('search/nested'), { recursive: true });
  await fs.writeFile(p('search/nested/a'), 'first');
  await fs.writeFile(p('search/nested/b'), 'second');
  const first = await run('find', { path: p('search'), query: '', limit: 2 });
  await fs.rename(p('search/nested'), p('saved'));
  await fs.mkdir(p('search/nested'));
  await fs.writeFile(p('search/nested/b'), 'different directory');
  await assert.rejects(run('find', { cursor: first.nextCursor, limit: 2 }), { code: 'TRAVERSAL_CHANGED' });
});

test('missing or disconnected locations retain the OS error code', async t => {
  const { run, p } = await fixture(t);
  await assert.rejects(run('list', { path: p('disconnected') }), { code: 'ENOENT' });
});

test('mkdir, directory copy and collisions preserve sources and unrelated destinations', async t => {
  const { run, p } = await fixture(t);
  await run('mkdir', { path: p('kaynak') });
  await run('mkdir', { path: p('kaynak/alt') });
  await fs.writeFile(p('kaynak/alt/ö.txt'), 'içerik');
  const result = await run('copy', { source: p('kaynak'), destination: p('hedef') }, { taskId: 'task-1' });
  assert.equal(result.receipt.status, 'completed');
  assert.equal(result.receipt.taskId, 'task-1');
  assert.equal(await fs.readFile(p('hedef/alt/ö.txt'), 'utf8'), 'içerik');
  await assert.rejects(run('copy', { source: p('kaynak'), destination: p('hedef') }), { code: 'EEXIST' });
  await assert.rejects(run('copy', { source: p('kaynak'), destination: p('kaynak/child') }), { code: 'INVALID_DESTINATION' });
});

test('file move and rename never overwrite a collision and enforce optional source version', async t => {
  const { run, p } = await fixture(t);
  await fs.writeFile(p('a.txt'), 'a');
  await fs.writeFile(p('b.txt'), 'b');
  const version = (await run('stat', { path: p('a.txt') })).version;
  await assert.rejects(run('move', { source: p('a.txt'), destination: p('b.txt') }), { code: 'EEXIST' });
  assert.equal(await fs.readFile(p('b.txt'), 'utf8'), 'b');
  await assert.rejects(run('move', { source: p('a.txt'), destination: p('c.txt'), expectedVersion: 'stale' }), { code: 'VERSION_CONFLICT' });
  await run('move', { source: p('a.txt'), destination: p('c.txt'), expectedVersion: version });
  await assert.rejects(fs.stat(p('a.txt')), { code: 'ENOENT' });
  await run('rename', { path: p('c.txt'), name: 'yeni ü.txt' });
  assert.equal(await fs.readFile(p('yeni ü.txt'), 'utf8'), 'a');
  await assert.rejects(run('rename', { path: p('yeni ü.txt'), name: '../escape' }), { code: 'INVALID_ARGUMENT' });
});

test('Windows case-only rename updates the actual file and directory names', { skip: process.platform !== 'win32' }, async t => {
  const { run, p, root } = await fixture(t);
  await fs.writeFile(p('note.txt'), 'preserved');
  const version = (await run('stat', { path: p('note.txt') })).version;
  await run('rename', { path: p('note.txt'), name: 'NOTE.txt', expectedVersion: version });
  assert.ok((await fs.readdir(root)).includes('NOTE.txt'));
  assert.equal(await fs.readFile(p('NOTE.txt'), 'utf8'), 'preserved');
  await fs.mkdir(p('folder'));
  await fs.writeFile(p('folder/child'), 'child');
  await run('rename', { path: p('folder'), name: 'FOLDER' });
  assert.ok((await fs.readdir(root)).includes('FOLDER'));
  assert.equal(await fs.readFile(p('FOLDER/child'), 'utf8'), 'child');
});

test('move never deletes a replacement introduced by a policy check after observing the source', async t => {
  const { run, tools, p } = await fixture(t);
  await fs.writeFile(p('source'), 'authorized');
  let sourceWasObserved = false, replaced = false;
  const stat = tools._stat.bind(tools);
  tools._stat = async (...args) => {
    const result = await stat(...args);
    if (args[0] === p('source')) {
      try { await fs.stat(p('destination')); sourceWasObserved = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    return result;
  };
  const context = { check: async () => {
    if (sourceWasObserved && !replaced) {
      replaced = true;
      await fs.rename(p('source'), p('backup'));
      await fs.writeFile(p('source'), 'new unobserved content');
    }
  } };
  const result = await run('move', { source: p('source'), destination: p('destination') }, context).catch(error => error);
  if (replaced) {
    assert.equal(await fs.readFile(p('source'), 'utf8'), 'new unobserved content');
    assert.equal(result.code, 'VERSION_CONFLICT');
  } else {
    assert.equal(result.moved, true);
    await assert.rejects(fs.stat(p('source')), { code: 'ENOENT' });
  }
  assert.equal(await fs.readFile(p('destination'), 'utf8'), 'authorized');
});

test('unsupported filesystem moves preserve the source and return actionable recovery without retry', async t => {
  const { run, p } = await fixture(t);
  await fs.writeFile(p('source'), 'preserved');
  // This host has no FAT/exFAT test volume. Inject only the OS capability error;
  // all path validation, guards, receipts and source preservation remain real.
  const link = fs.link;
  t.mock.method(fs, 'link', async (source, destination) => {
    if (source === p('source')) throw Object.assign(new Error('Hard links unsupported on test filesystem'), { code: 'ENOTSUP' });
    return link(source, destination);
  });
  await assert.rejects(run('move', { source: p('source'), destination: p('destination') }), error => {
    assert.equal(error.code, 'ENOTSUP');
    assert.equal(error.receipt.status, 'not-started');
    assert.equal(error.details.sourcePreserved, true);
    assert.match(error.details.recovery, /files_copy/);
    assert.match(error.details.recovery, /files_trash/);
    return true;
  });
  assert.equal(await fs.readFile(p('source'), 'utf8'), 'preserved');
  await assert.rejects(fs.stat(p('destination')), { code: 'ENOENT' });
});

test('directory move preserves descendants', async t => {
  const { run, p } = await fixture(t);
  await fs.mkdir(p('source'));
  await fs.writeFile(p('source/file'), 'value');
  await run('move', { source: p('source'), destination: p('moved') });
  assert.equal(await fs.readFile(p('moved/file'), 'utf8'), 'value');
  await assert.rejects(fs.stat(p('source')), { code: 'ENOENT' });
});

test('trash is recoverable-only, guarded, refuses volume roots and reports real opening errors', async t => {
  const trashed = [];
  const { run, p, root } = await fixture(t, {
    trash: async target => { trashed.push(target); await fs.rename(target, `${target}.trash`); },
    openPath: async target => target.endsWith('bad') ? 'No association' : ''
  });
  await fs.writeFile(p('note'), 'keep');
  const version = (await run('stat', { path: p('note') })).version;
  await assert.rejects(run('trash', { path: p('note'), expectedVersion: 'old' }), { code: 'VERSION_CONFLICT' });
  assert.equal(trashed.length, 0);
  await run('trash', { path: p('note'), expectedVersion: version });
  assert.equal(await fs.readFile(p('note.trash'), 'utf8'), 'keep');
  await assert.rejects(run('trash', { path: path.parse(root).root }), { code: 'ROOT_OPERATION_FORBIDDEN' });
  await fs.writeFile(p('bad'), 'bad');
  await assert.rejects(run('open', { path: p('bad') }), { code: 'OPEN_FAILED' });
  assert.equal((await run('open', { path: p('note.trash') })).opened, true);
});

test('aborted and stale task checks stop before any mutation', async t => {
  const { run, p } = await fixture(t);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(run('write', { path: p('never'), content: 'no' }, { signal: controller.signal }), { code: 'ABORT_ERR' });
  await assert.rejects(fs.stat(p('never')), { code: 'ENOENT' });
  await assert.rejects(run('mkdir', { path: p('stale') }, { check: () => { throw Object.assign(new Error('stale'), { code: 'STALE_TASK' }); } }), { code: 'STALE_TASK' });
  await assert.rejects(fs.stat(p('stale')), { code: 'ENOENT' });
});

test('large copies cancel between chunks and include precise partial completion evidence', async t => {
  const controller = new AbortController();
  const { run, p } = await fixture(t, { publish: event => { if (event.bytesCopied > 0) controller.abort(); } });
  await fs.writeFile(p('big'), Buffer.alloc(4 * 1024 * 1024, 7));
  let failure;
  try { await run('copy', { source: p('big'), destination: p('partial') }, { signal: controller.signal, taskId: 'stop-me' }); } catch (error) { failure = error; }
  assert.equal(failure?.code, 'ABORT_ERR');
  assert.equal(failure.receipt.status, 'partial');
  assert.equal(failure.receipt.taskId, 'stop-me');
  assert.ok(failure.receipt.bytesCopied > 0);
  assert.ok((await fs.stat(p('partial'))).size < 4 * 1024 * 1024);
  assert.equal((await fs.stat(p('big'))).size, 4 * 1024 * 1024);
});

test('changing a source during copy is detected and never presented as completed', async t => {
  let changed = false;
  let source;
  const { run, p } = await fixture(t, { publish: async event => {
    if (!changed && event.bytesCopied > 0) { changed = true; await fs.appendFile(source, 'changed'); }
  } });
  source = p('source');
  await fs.writeFile(source, Buffer.alloc(1024 * 1024, 3));
  await assert.rejects(run('copy', { source, destination: p('copy') }), error => error.code === 'VERSION_CONFLICT' && error.receipt.status === 'partial');
});

test('symlinks are visible to stat but reads, traversal and mutation do not follow them', async t => {
  const { run, p } = await fixture(t);
  await fs.mkdir(p('real'));
  await fs.writeFile(p('real/secret'), 'untouched');
  await fs.symlink(p('real'), p('link'), 'junction');
  assert.equal((await run('stat', { path: p('link') })).type, 'symlink');
  await assert.rejects(run('read', { path: p('link/secret') }), { code: 'SYMLINK_NOT_ALLOWED' });
  await assert.rejects(run('write', { path: p('link/secret'), content: 'oops' }), { code: 'SYMLINK_NOT_ALLOWED' });
  await assert.rejects(run('copy', { source: p('link'), destination: p('other') }), { code: 'SYMLINK_NOT_ALLOWED' });
  const page = await run('find', { path: p('link'), query: '' });
  assert.equal(page.entries.length, 0);
  assert.equal(page.skippedLinks, 1);
  assert.equal(await fs.readFile(p('real/secret'), 'utf8'), 'untouched');
});
