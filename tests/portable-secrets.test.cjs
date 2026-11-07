'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { PortableSecretStore } = require('../src/portable-secrets.cjs');

// Device protection is the only platform boundary replaced by a test double.
function device() {
  const key = crypto.randomBytes(32);
  return {
    async protect(bytes) {
      const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
      return Buffer.concat([nonce, cipher.update(bytes), cipher.final(), cipher.getAuthTag()]);
    },
    async unprotect(bytes) {
      const cipher = crypto.createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      cipher.setAuthTag(bytes.subarray(-16));
      return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]);
    }
  };
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'umay-portable-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const stores = [];
  t.after(() => stores.forEach(s => s.close()));
  function store(name, options = {}) {
    const s = new PortableSecretStore({ keyDirectory: path.join(root, name, 'device'), ...options });
    s.activate('owner-a', { directory: path.join(root, name, 'portable') });
    stores.push(s);
    return s;
  }
  return { root, store };
}
const record = (secret = 'fake-password-789') => ({ id: 'login', kind: 'account', label: 'Deneme hesabı', public: { origin: 'https://example.test' }, secret: { password: secret, username: 'deneme' }, expectedVersion: null });
function snapshot(directory) {
  if (!fs.existsSync(directory)) return {};
  const result = {};
  for (const entry of fs.readdirSync(directory, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const file = path.join(entry.parentPath || entry.path, entry.name);
      result[path.relative(directory, file)] = fs.readFileSync(file).toString('base64');
    }
  }
  return result;
}
const code = expected => error => error.code === expected;

function recoveryDataKey(header, recoveryKey) {
  const d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(recoveryKey.slice(16), 'base64url'), Buffer.from(header.wrapped.nonce, 'base64url'));
  d.setAAD(Buffer.from(JSON.stringify({ format: 1, owner: header.owner, vault: header.vault, id: '$key' })));
  d.setAuthTag(Buffer.from(header.wrapped.tag, 'base64url'));
  return Buffer.concat([d.update(Buffer.from(header.wrapped.ciphertext, 'base64url')), d.final()]);
}

// Build valid encrypted history in O(N), not through N full-history API writes.
// The real list/unlock/export methods validate this fixture before it is exercised.
function seedNearLimit(root, header, recoveryKey) {
  const target = 64 * 1024 * 1024 - 100, key = recoveryDataKey(header, recoveryKey);
  const directory = path.join(root, header.owner, 'revisions'); fs.mkdirSync(directory);
  let count = 0;
  let size = Buffer.byteLength(JSON.stringify({ format: 1, owner: header.owner, header, revisions: [], mac: 'A'.repeat(43) }));
  function candidate(padding) {
    const rev = { id: 'seed_' + count, revision: crypto.randomBytes(16).toString('hex'), parents: [] };
    const clear = Buffer.from(JSON.stringify({ deleted: false, kind: 'account', label: 'Sentetik kayıt', public: {}, secret: { password: 'synthetic-seed', padding: 'x'.repeat(padding) }, updatedAt: '2026-11-07T00:00:00.000Z' }));
    assert.ok(clear.length <= 64 * 1024);
    const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    cipher.setAAD(Buffer.from(JSON.stringify({ format: 1, owner: header.owner, vault: header.vault, id: rev.id, revision: rev.revision, parents: [] })));
    rev.box = { nonce: nonce.toString('base64url'), ciphertext: Buffer.concat([cipher.update(clear), cipher.final()]).toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
    return { rev, bytes: Buffer.from(JSON.stringify(rev)) };
  }
  function append(value) {
    const file = crypto.createHash('sha256').update(value.rev.id).digest('hex') + '.' + value.rev.revision + '.json';
    fs.writeFileSync(path.join(directory, file), value.bytes, { flag: 'wx' });
    size += value.bytes.length + (count ? 1 : 0); count++;
  }
  try {
    for (;;) {
      const value = candidate(60000);
      if (size + value.bytes.length + 3000 > target) break;
      append(value);
    }
    let low = 0, high = 65000, last;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2), value = candidate(middle);
      if (size + value.bytes.length + 1 <= target) { last = value; low = middle + 1; }
      else high = middle - 1;
    }
    assert.ok(last); append(last);
    assert.ok(target - size < 3, 'Fixture must exercise envelope overhead, not only revision bytes');
    return { count, size };
  } finally { key.fill(0); }
}

function diskDigest(directory) {
  const digest = crypto.createHash('sha256');
  const files = fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter(e => e.isFile())
    .map(e => path.join(e.parentPath || e.path, e.name)).sort();
  for (const file of files) digest.update(path.relative(directory, file)).update(fs.readFileSync(file));
  return digest.digest('hex');
}

test('recovery imports onto a different device without exporting secret or key material', async t => {
  const { root, store } = fixture(t), a = store('a', device()), b = store('b', device());
  const { recoveryKey } = await a.initialize();
  assert.match(recoveryKey, /^UMAY-RECOVERY-1-[A-Za-z0-9_-]{43}$/);
  await assert.rejects(a.initialize(), code('ALREADY_INITIALIZED'));
  const saved = await a.put(record());
  const bytes = await a.exportEncrypted();
  await b.importEncrypted(bytes, { recoveryKey });
  assert.deepEqual(await b.resolve('login', { fields: ['password'] }), { password: 'fake-password-789' });
  assert.equal((await b.list())[0].version, saved.version);
  const visible = JSON.stringify([a.state(), await a.list(), saved, a, b]);
  const disk = Object.values(snapshot(root)).map(v => Buffer.from(v, 'base64').toString()).join('');
  for (const text of [visible, disk, bytes.toString()]) {
    assert.ok(!text.includes('fake-password-789'));
    assert.ok(!text.includes(recoveryKey));
    assert.ok(!text.includes(recoveryKey.slice('UMAY-RECOVERY-1-'.length)));
  }
  b.lock();
  await assert.rejects(b.resolve('login'), code('LOCKED'));
  await b.unlock({ useDeviceKey: true });
  assert.equal((await b.resolve('login')).password, 'fake-password-789');
});

test('wrong recovery, wrong owner and envelope tampering leave destination untouched', async t => {
  const { root, store } = fixture(t), a = store('a'), b = store('b');
  const { recoveryKey } = await a.initialize();
  await a.put(record());
  const bytes = await a.exportEncrypted(), before = snapshot(root);
  const wrongKey = 'UMAY-RECOVERY-1-' + crypto.randomBytes(32).toString('base64url');
  await assert.rejects(b.importEncrypted(bytes, { recoveryKey: wrongKey }));
  assert.deepEqual(snapshot(root), before);
  b.activate('owner-b', { directory: path.join(root, 'b', 'portable') });
  await assert.rejects(b.importEncrypted(bytes, { recoveryKey }), code('WRONG_OWNER'));
  assert.deepEqual(snapshot(root), before);
  b.activate('owner-a', { directory: path.join(root, 'b', 'portable') });
  const tampered = JSON.parse(bytes); tampered.revisions = [];
  await assert.rejects(b.importEncrypted(Buffer.from(JSON.stringify(tampered)), { recoveryKey }));
  assert.deepEqual(snapshot(root), before);
});

test('manual recovery works without device protection and wrong unlock stays locked', async t => {
  const { root, store } = fixture(t), a = store('a');
  const { recoveryKey } = await a.initialize();
  await a.put(record()); a.close();
  assert.equal(fs.existsSync(path.join(root, 'a', 'device')), false);
  const reopened = store('a');
  await assert.rejects(reopened.unlock({ useDeviceKey: true }), code('DEVICE_KEY_UNAVAILABLE'));
  await assert.rejects(reopened.unlock({ recoveryKey: 'wrong' }));
  assert.equal(reopened.state().unlocked, false);
  await reopened.unlock({ recoveryKey });
  assert.equal((await reopened.resolve('login')).username, 'deneme');
});

test('stale or missing expectedVersion cannot overwrite and tombstones prevent old export resurrection', async t => {
  const { root, store } = fixture(t), a = store('a'), b = store('b');
  const { recoveryKey } = await a.initialize();
  const first = await a.put(record()), old = await a.exportEncrypted();
  await a.put({ ...record('new'), expectedVersion: first.version });
  const before = snapshot(root);
  await assert.rejects(a.put({ ...record('stale'), expectedVersion: first.version }), code('VERSION_CONFLICT'));
  await assert.rejects(a.put(record('missing')), code('VERSION_CONFLICT'));
  await assert.rejects(a.remove('login', first.version), code('VERSION_CONFLICT'));
  assert.deepEqual(snapshot(root), before);
  const current = (await a.list())[0];
  const removed = await a.remove('login', current.version);
  assert.equal(removed.deleted, true);
  await assert.rejects(a.resolve('login'), code('DELETED'));
  await b.importEncrypted(await a.exportEncrypted(), { recoveryKey });
  await b.importEncrypted(old, { recoveryKey });
  await assert.rejects(b.resolve('login'), code('DELETED'));
});

test('offline writers preserve both immutable heads until explicit all-head merge', async t => {
  const { store } = fixture(t), a = store('a'), b = store('b');
  const { recoveryKey } = await a.initialize();
  const first = await a.put(record());
  await b.importEncrypted(await a.exportEncrypted(), { recoveryKey });
  await a.put({ ...record('device-a'), expectedVersion: first.version });
  await b.put({ ...record('device-b'), expectedVersion: first.version });
  const fromB = await b.exportEncrypted();
  await a.importEncrypted(fromB, { recoveryKey });
  const conflict = (await a.list())[0];
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.heads.length, 2);
  await assert.rejects(a.resolve('login'), code('CONFLICT'));
  await assert.rejects(a.put({ ...record('stale'), expectedVersion: first.version }), code('VERSION_CONFLICT'));
  const merged = await a.put({ ...record('chosen-value'), expectedVersion: conflict.version });
  assert.equal(merged.conflict, false);
  await b.importEncrypted(await a.exportEncrypted(), { recoveryKey });
  assert.equal((await b.resolve('login')).password, 'chosen-value');
  await b.importEncrypted(fromB, { recoveryKey });
  assert.equal((await b.resolve('login')).password, 'chosen-value');
});

test('delete versus offline edit is a conflict, never an implicit resurrection', async t => {
  const { store } = fixture(t), a = store('a'), b = store('b');
  const { recoveryKey } = await a.initialize(), first = await a.put(record());
  await b.importEncrypted(await a.exportEncrypted(), { recoveryKey });
  await a.remove('login', first.version);
  await b.put({ ...record('offline'), expectedVersion: first.version });
  await a.importEncrypted(await b.exportEncrypted(), { recoveryKey });
  await assert.rejects(a.resolve('login'), code('CONFLICT'));
  const conflict = (await a.list())[0];
  await a.remove('login', conflict.version);
  await assert.rejects(a.resolve('login'), code('DELETED'));
});

test('late device decryption cannot unlock or return secrets after an account switch', async t => {
  const { root, store } = fixture(t), platform = device();
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const a = store('a', { ...platform, unprotect: async bytes => {
    entered(); await new Promise(resolve => { release = resolve; });
    return platform.unprotect(bytes);
  } });
  await a.initialize(); await a.put(record()); a.lock();
  const pending = a.unlock({ useDeviceKey: true });
  await started;
  a.activate('owner-b', { directory: path.join(root, 'a', 'portable') });
  const before = snapshot(root); release();
  await assert.rejects(pending, code('CANCELLED'));
  assert.equal(a.state().unlocked, false);
  assert.deepEqual(snapshot(root), before);
});

test('late protection during import is cancelled without writing either account', async t => {
  const { root, store } = fixture(t), a = store('a'), platform = device();
  const { recoveryKey } = await a.initialize(); await a.put(record());
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const b = store('b', { ...platform, protect: async bytes => {
    entered(); await new Promise(resolve => { release = resolve; });
    return platform.protect(bytes);
  } });
  const pending = b.importEncrypted(await a.exportEncrypted(), { recoveryKey });
  await started; b.activate('owner-b', { directory: path.join(root, 'b', 'portable') });
  const before = snapshot(root); release();
  await assert.rejects(pending, code('CANCELLED'));
  assert.deepEqual(snapshot(root), before);
});

test('record and package size limits reject before changing disk', async t => {
  const { root, store } = fixture(t), a = store('a');
  await a.initialize(); const before = snapshot(root);
  await assert.rejects(a.put(record('x'.repeat(64 * 1024))), code('TOO_LARGE'));
  await assert.rejects(a.importEncrypted(Buffer.alloc(64 * 1024 * 1024 + 1)), code('TOO_LARGE'));
  assert.deepEqual(snapshot(root), before);
});

test('record ids and linked directory components cannot escape the portable namespace', async t => {
  const { root, store } = fixture(t), a = store('a');
  await a.initialize(); const before = snapshot(root);
  await assert.rejects(a.put({ ...record(), id: '../escape' }), code('INVALID_ID'));
  assert.deepEqual(snapshot(root), before);
  const outside = path.join(root, 'outside'), link = path.join(root, 'linked');
  fs.mkdirSync(outside); fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
  const b = store('b');
  assert.throws(() => b.activate('owner-a', { directory: path.join(link, 'portable') }), code('UNSAFE_PATH'));
  assert.deepEqual(fs.readdirSync(outside), []);
});

test('existing unrelated vault cannot be silently replaced by import', async t => {
  const { root, store } = fixture(t), a = store('a'), b = store('b');
  const { recoveryKey } = await a.initialize(); await a.put(record());
  await b.initialize(); await b.put(record('other-vault'));
  const before = snapshot(root);
  await assert.rejects(b.importEncrypted(await a.exportEncrypted(), { recoveryKey }), code('VAULT_CONFLICT'));
  assert.deepEqual(snapshot(root), before);
  assert.equal((await b.resolve('login')).password, 'other-vault');
});

test('a failed device-cache write cannot leave an initialized vault with an undisclosed recovery key', async t => {
  const { root, store } = fixture(t), a = store('a', device());
  fs.mkdirSync(path.join(root, 'a')); fs.writeFileSync(path.join(root, 'a', 'device'), 'blocked');
  await assert.rejects(a.initialize());
  assert.equal(a.state().initialized, false);
  fs.unlinkSync(path.join(root, 'a', 'device'));
  const { recoveryKey } = await a.initialize();
  a.lock(); await a.unlock({ recoveryKey });
  assert.equal(a.state().unlocked, true);
});

test('plaintext data key never reaches disk and a foreign device cannot use a copied protected cache', async t => {
  const { root, store } = fixture(t), platform = device();
  let dataKey;
  const a = store('a', { ...platform, protect: async bytes => {
    dataKey = JSON.parse(bytes).key; return platform.protect(bytes);
  } });
  const { recoveryKey } = await a.initialize(); await a.put(record());
  const files = snapshot(root);
  for (const bytes of Object.values(files).map(v => Buffer.from(v, 'base64'))) {
    assert.ok(!bytes.includes(Buffer.from(dataKey)));
    assert.ok(!bytes.includes(Buffer.from(dataKey, 'base64url')));
  }
  fs.cpSync(path.join(root, 'a'), path.join(root, 'b'), { recursive: true });
  const b = store('b', device());
  await assert.rejects(b.unlock({ useDeviceKey: true }), code('DEVICE_KEY_UNAVAILABLE'));
  assert.equal(b.state().unlocked, false);
  await b.unlock({ recoveryKey }); b.lock(); await b.unlock({ useDeviceKey: true });
  assert.equal((await b.resolve('login')).password, 'fake-password-789');
});

test('an account switch or lock cancels a pending secret resolution', async t => {
  const { root, store } = fixture(t), a = store('a');
  const { recoveryKey } = await a.initialize(); await a.put(record());
  const pending = a.resolve('login'); a.lock();
  await assert.rejects(pending, code('CANCELLED'));
  await a.unlock({ recoveryKey });
  const switched = a.resolve('login');
  a.activate('owner-b', { directory: path.join(root, 'a', 'portable') });
  await assert.rejects(switched, code('CANCELLED'));
  assert.equal(a.state().initialized, false);
});

test('late initialization protection is cancelled by close before writing a header or cache', async t => {
  const { root, store } = fixture(t), platform = device();
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const a = store('a', { ...platform, protect: async bytes => {
    entered(); await new Promise(resolve => { release = resolve; });
    return platform.protect(bytes);
  } });
  const pending = a.initialize(); await started;
  a.close(); release();
  await assert.rejects(pending, code('CANCELLED'));
  assert.deepEqual(snapshot(root), {});
});

test('a junction introduced during asynchronous protection is checked again before import writes', async t => {
  const { root, store } = fixture(t), a = store('a'), platform = device();
  const { recoveryKey } = await a.initialize(); await a.put(record());
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  const b = store('b', { ...platform, protect: async bytes => {
    entered(); await new Promise(resolve => { release = resolve; });
    return platform.protect(bytes);
  } });
  const pending = b.importEncrypted(await a.exportEncrypted(), { recoveryKey }); await started;
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside); fs.mkdirSync(path.join(root, 'b'));
  fs.symlinkSync(outside, path.join(root, 'b', 'portable'), process.platform === 'win32' ? 'junction' : 'dir');
  release(); await assert.rejects(pending, code('UNSAFE_PATH'));
  assert.deepEqual(fs.readdirSync(outside), []);
  assert.equal(fs.existsSync(path.join(root, 'b', 'device')), false);
});

test('changing encrypted revision identity or ciphertext on disk fails authentication', async t => {
  const { root, store } = fixture(t), a = store('a');
  await a.initialize(); await a.put(record());
  const revisionRelative = Object.keys(snapshot(root)).find(name => name.includes('revisions'));
  const file = path.join(root, revisionRelative), original = fs.readFileSync(file), revision = JSON.parse(original);
  const other = { ...revision, id: 'other' };
  const movedFile = path.join(path.dirname(file), crypto.createHash('sha256').update('other').digest('hex') + '.' + revision.revision + '.json');
  fs.unlinkSync(file); fs.writeFileSync(movedFile, JSON.stringify(other));
  await assert.rejects(a.list(), code('AUTHENTICATION_FAILED'));
  fs.unlinkSync(movedFile);
  const cipher = Buffer.from(revision.box.ciphertext, 'base64url'); cipher[0] ^= 1;
  revision.box.ciphertext = cipher.toString('base64url'); fs.writeFileSync(file, JSON.stringify(revision));
  await assert.rejects(a.resolve('login'), code('AUTHENTICATION_FAILED'));
});

test('valid-looking import paths and invalid record ids are rejected without filesystem effects', async t => {
  const { root, store } = fixture(t), a = store('a'), b = store('b');
  const { recoveryKey } = await a.initialize(); await a.put(record());
  const exported = JSON.parse(await a.exportEncrypted());
  // Re-sign with the recovery-derived data key to exercise schema/path validation,
  // rather than merely tripping the outer MAC check.
  const h = exported.header, d = crypto.createDecipheriv('aes-256-gcm', Buffer.from(recoveryKey.slice(16), 'base64url'), Buffer.from(h.wrapped.nonce, 'base64url'));
  d.setAAD(Buffer.from(JSON.stringify({ format: 1, owner: h.owner, vault: h.vault, id: '$key' })));
  d.setAuthTag(Buffer.from(h.wrapped.tag, 'base64url'));
  const key = Buffer.concat([d.update(Buffer.from(h.wrapped.ciphertext, 'base64url')), d.final()]);
  const before = snapshot(root);
  for (const mutate of [p => { p.revisions[0].path = '../../escape'; }, p => { p.revisions[0].id = '../escape'; }, p => { p.revisions.push(p.revisions[0]); }]) {
    const pack = structuredClone(exported); mutate(pack);
    const { mac, ...body } = pack;
    pack.mac = crypto.createHmac('sha256', key).update(JSON.stringify(body)).digest('base64url');
    await assert.rejects(b.importEncrypted(Buffer.from(JSON.stringify(pack)), { recoveryKey }));
    assert.deepEqual(snapshot(root), before);
  }
  key.fill(0);
});

test('near-limit put and remove preserve history and usability when the full export envelope would overflow', async t => {
  const { root, store } = fixture(t), baseline = store('baseline');
  const { recoveryKey } = await baseline.initialize(), header = JSON.parse(await baseline.exportEncrypted()).header;
  const portable = path.join(root, 'baseline', 'portable');
  const seeded = seedNearLimit(portable, header, recoveryKey), records = await baseline.list();
  assert.equal(records.length, seeded.count);
  const version = records.find(r => r.id === 'seed_0').version;
  let exported = await baseline.exportEncrypted();
  assert.equal(exported.length, seeded.size);
  assert.ok(exported.length < 64 * 1024 * 1024);
  t.diagnostic(`Synthetic history: ${seeded.count} revisions, ${exported.length} export bytes`);
  const exportDigest = crypto.createHash('sha256').update(exported).digest('hex'); exported = null;
  const before = diskDigest(portable);
  for (const action of ['put', 'remove']) await t.test(action, async () => {
    if (action === 'put') await assert.rejects(baseline.put(record('x'.repeat(65000))), code('TOO_LARGE'));
    else await assert.rejects(baseline.remove('seed_0', version), code('TOO_LARGE'));
    assert.equal(diskDigest(portable), before, 'Rejected operation must leave every prior file byte unchanged');
  });
  // Both refusals preserve identical bytes; verify every read/reopen route once
  // against that unchanged history instead of re-reading 64 MiB for each refusal.
  assert.equal((await baseline.list()).length, seeded.count);
  assert.equal((await baseline.resolve('seed_0', { fields: ['password'] })).password, 'synthetic-seed');
  assert.equal(crypto.createHash('sha256').update(await baseline.exportEncrypted()).digest('hex'), exportDigest);
  baseline.lock(); await baseline.unlock({ recoveryKey });
  assert.equal((await baseline.resolve('seed_0', { fields: ['password'] })).password, 'synthetic-seed');
});

test('a cooperating writer lock rejects put, remove and import without changing history', async t => {
  const { root, store } = fixture(t), a = store('a');
  const { recoveryKey } = await a.initialize(), saved = await a.put(record()), bytes = await a.exportEncrypted();
  const header = JSON.parse(bytes).header, lock = path.join(root, 'a', 'portable', header.owner, '.write.lock');
  fs.writeFileSync(lock, 'other-writer', { flag: 'wx' });
  const before = snapshot(root);
  await assert.rejects(a.put({ ...record('new'), expectedVersion: saved.version }), code('STORE_BUSY'));
  await assert.rejects(a.remove('login', saved.version), code('STORE_BUSY'));
  await assert.rejects(a.importEncrypted(bytes, { recoveryKey }), code('STORE_BUSY'));
  assert.deepEqual(snapshot(root), before);
  assert.equal((await a.resolve('login')).password, 'fake-password-789');
  assert.equal((await a.list())[0].version, saved.version);
  assert.deepEqual(await a.exportEncrypted(), bytes);
  fs.unlinkSync(lock);
  await a.put({ ...record('new'), expectedVersion: saved.version });
  assert.equal((await a.resolve('login')).password, 'new');
});

test('writer lock is released after serialization and stale-version errors as well as successful writes', async t => {
  const { root, store } = fixture(t), a = store('a');
  await a.initialize(); const first = await a.put(record()), before = snapshot(root);
  const cyclic = {}; cyclic.self = cyclic;
  await assert.rejects(a.put({ ...record(), secret: cyclic, expectedVersion: first.version }), TypeError);
  assert.deepEqual(snapshot(root), before);
  await assert.rejects(a.remove('login', 'stale'), code('VERSION_CONFLICT'));
  assert.deepEqual(snapshot(root), before);
  const saved = await a.put({ ...record('after-error'), expectedVersion: first.version });
  assert.equal((await a.resolve('login')).password, 'after-error');
  await a.remove('login', saved.version);
  assert.ok(Object.keys(snapshot(root)).every(name => !name.endsWith('.write.lock')));
});
