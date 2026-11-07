'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes, createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual } = require('node:crypto');

const FORMAT = 1;
const RECORD_LIMIT = 64 * 1024;
const PACKAGE_LIMIT = 64 * 1024 * 1024;
const PREFIX = 'UMAY-RECOVERY-1-';
const revisionPattern = /^[a-f0-9]{32}$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value));
const fail = (code, message = 'Kasa işlemi güvenli biçimde tamamlanamadı.') => Object.assign(new Error(message), { code });
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function exact(value, keys) {
  if (!object(value) || Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) throw fail('INVALID_DATA');
}
function idValid(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw fail('INVALID_ID');
}
function decode64(value, length) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value)) throw fail('INVALID_DATA');
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.toString('base64url') !== value || (length !== undefined && bytes.length !== length)) throw fail('INVALID_DATA');
  return bytes;
}
function parse(bytes) {
  try { return JSON.parse(bytes.toString('utf8')); } catch { throw fail('INVALID_DATA'); }
}
function recoveryBytes(text) {
  if (typeof text !== 'string' || !text.startsWith(PREFIX)) throw fail('INVALID_RECOVERY');
  try { return decode64(text.slice(PREFIX.length), 32); } catch { throw fail('INVALID_RECOVERY'); }
}
function seal(key, bytes, aad) {
  const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(encode(aad));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return { nonce: nonce.toString('base64url'), ciphertext: ciphertext.toString('base64url'), tag: cipher.getAuthTag().toString('base64url') };
}
function open(key, box, aad, limit = RECORD_LIMIT) {
  exact(box, ['nonce', 'ciphertext', 'tag']);
  const ciphertext = decode64(box.ciphertext);
  if (ciphertext.length > limit) throw fail('TOO_LARGE');
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, decode64(box.nonce, 12));
    decipher.setAAD(encode(aad)); decipher.setAuthTag(decode64(box.tag, 16));
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch { throw fail('AUTHENTICATION_FAILED'); }
}

// Reject junctions/symlinks in every existing ancestor, including the supplied root.
// Sync filesystem calls leave no JS/await gap between validation and effects.
function safePath(file) {
  const absolute = path.resolve(file), parsed = path.parse(absolute);
  let current = parsed.root;
  for (const part of absolute.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    if (['raw', '.obsidian', '.git'].includes(part.toLowerCase()) || /[:]/.test(part)) throw fail('UNSAFE_PATH');
    current = path.join(current, part);
    try {
      const stat = fs.lstatSync(current);
      if (stat.isSymbolicLink()) throw fail('UNSAFE_PATH');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return absolute;
}
function mkdir(directory) {
  safePath(directory); fs.mkdirSync(directory, { recursive: true, mode: 0o700 }); safePath(directory);
}
function read(file, limit = PACKAGE_LIMIT) {
  safePath(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1) throw fail('UNSAFE_PATH');
    if (stat.size > limit) throw fail('TOO_LARGE');
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
function immutable(file, bytes) {
  safePath(file);
  try {
    const fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | (fs.constants.O_NOFOLLOW || 0), 0o600);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    if (!read(file).equals(bytes)) throw fail('REVISION_COLLISION');
  }
}
function headerAAD(header) { return { format: FORMAT, owner: header.owner, vault: header.vault, id: '$key' }; }
function validateHeader(header, owner) {
  exact(header, ['format', 'owner', 'vault', 'wrapped', 'check']);
  if (header.format !== FORMAT || !revisionPattern.test(header.vault)) throw fail('INVALID_DATA');
  if (header.owner !== owner) throw fail('WRONG_OWNER');
  exact(header.wrapped, ['nonce', 'ciphertext', 'tag']);
  exact(header.check, ['nonce', 'ciphertext', 'tag']);
}
function verifyKey(header, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw fail('AUTHENTICATION_FAILED');
  const clear = open(key, header.check, { ...headerAAD(header), id: '$check', wrapped: header.wrapped });
  try { if (clear.toString() !== 'UMAY-PORTABLE-1') throw fail('AUTHENTICATION_FAILED'); } finally { clear.fill(0); }
}
function unwrap(header, text) {
  const recovery = recoveryBytes(text);
  let key;
  try {
    key = open(recovery, header.wrapped, headerAAD(header));
    verifyKey(header, key); return key;
  } catch (error) { key?.fill(0); throw error; } finally { recovery.fill(0); }
}
function revisionAAD(header, rev) {
  return { format: FORMAT, owner: header.owner, vault: header.vault, id: rev.id, revision: rev.revision, parents: rev.parents };
}
function validateBody(body) {
  if (body?.deleted === true) { exact(body, ['deleted', 'updatedAt']); return; }
  exact(body, ['deleted', 'kind', 'label', 'public', 'secret', 'updatedAt']);
  if (body.deleted !== false || typeof body.kind !== 'string' || !body.kind || typeof body.label !== 'string' || !object(body.public) || !object(body.secret)) throw fail('INVALID_DATA');
}
function graph(header, revisions, key) {
  const nodes = new Map(), groups = new Map();
  for (const rev of revisions) {
    exact(rev, ['id', 'revision', 'parents', 'box']); idValid(rev.id);
    if (!revisionPattern.test(rev.revision) || !Array.isArray(rev.parents) || rev.parents.some(p => typeof p !== 'string' || !revisionPattern.test(p)) || new Set(rev.parents).size !== rev.parents.length || [...rev.parents].sort().join() !== rev.parents.join()) throw fail('INVALID_DATA');
    if (nodes.has(rev.revision)) throw fail('REVISION_COLLISION');
    const clear = open(key, rev.box, revisionAAD(header, rev));
    let body;
    try { body = parse(clear); validateBody(body); } finally { clear.fill(0); }
    const node = { rev, body }; nodes.set(rev.revision, node);
    if (!groups.has(rev.id)) groups.set(rev.id, []);
    groups.get(rev.id).push(node);
  }
  // Kahn traversal validates parent ownership, completeness and cycles without recursion.
  const children = new Map(), degrees = new Map(), ready = [];
  for (const [id, node] of nodes) {
    degrees.set(id, node.rev.parents.length);
    if (!node.rev.parents.length) ready.push(id);
    for (const parent of node.rev.parents) {
      if (!nodes.has(parent) || nodes.get(parent).rev.id !== node.rev.id) throw fail('INVALID_GRAPH');
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(id);
    }
  }
  for (let i = 0; i < ready.length; i++) for (const child of children.get(ready[i]) || []) {
    degrees.set(child, degrees.get(child) - 1); if (degrees.get(child) === 0) ready.push(child);
  }
  if (ready.length !== nodes.size) throw fail('INVALID_GRAPH');
  const records = new Map();
  for (const [id, group] of groups) {
    const heads = group.filter(n => !children.has(n.rev.revision)).sort((a, b) => a.rev.revision.localeCompare(b.rev.revision));
    const ids = heads.map(n => n.rev.revision);
    records.set(id, { heads, version: 'v1-' + hash(encode(ids)) });
  }
  return { records, nodes, order: ready.map(id => nodes.get(id).rev) };
}
function summary(id, record) {
  const result = { id, version: record.version, heads: record.heads.map(n => n.rev.revision), conflict: record.heads.length !== 1 };
  if (result.conflict) return { ...result, deleted: false };
  const body = record.heads[0].body;
  return body.deleted ? { ...result, deleted: true } : { ...result, deleted: false, kind: body.kind, label: body.label, public: structuredClone(body.public), updatedAt: body.updatedAt };
}
function packageBody(owner, header, revisions) { return { format: FORMAT, owner, header, revisions }; }
function mac(key, body) { return createHmac('sha256', key).update(encode(body)).digest(); }
function requirePackageCapacity(owner, header, revisions) {
  // A SHA-256 MAC always encodes to 43 base64url characters. Include the actual
  // JSON envelope, header, array commas and MAC field, without allocating 64 MiB.
  let size = encode({ ...packageBody(owner, header, []), mac: Buffer.alloc(32).toString('base64url') }).length;
  for (let i = 0; i < revisions.length; i++) {
    size += encode(revisions[i]).length + (i ? 1 : 0);
    if (size > PACKAGE_LIMIT) throw fail('TOO_LARGE');
  }
  if (size > PACKAGE_LIMIT) throw fail('TOO_LARGE');
}

class PortableSecretStore {
  #keyDirectory; #protect; #unprotect; #now; #epoch = 0; #account = null; #owner; #directory; #key = null; #vault = null;
  constructor({ keyDirectory, protect, unprotect, now = () => new Date().toISOString() } = {}) {
    this.#keyDirectory = keyDirectory ? path.resolve(keyDirectory) : null;
    this.#protect = protect; this.#unprotect = unprotect; this.#now = now;
  }
  activate(account, { directory } = {}) {
    this.lock(); this.#account = null; this.#directory = null; this.#owner = null;
    if (account === null || account === undefined) return this.state();
    if (typeof account !== 'string' || !account.trim() || account.length > 4096 || typeof directory !== 'string' || !path.isAbsolute(directory)) throw fail('INVALID_ARGUMENT');
    const root = safePath(directory);
    this.#owner = hash(account); this.#directory = path.join(root, this.#owner); safePath(this.#directory);
    this.#account = account;
    return this.state();
  }
  lock() { this.#epoch++; this.#key?.fill(0); this.#key = null; this.#vault = null; }
  close() { this.lock(); this.#account = null; this.#owner = null; this.#directory = null; }
  #check(epoch, unlocked = false) {
    if (epoch !== this.#epoch) throw fail('CANCELLED', 'Hesap veya kilit durumu değişti; işlem iptal edildi.');
    if (!this.#account) throw fail('INACTIVE');
    if (unlocked && !this.#key) throw fail('LOCKED', 'Kasa kilitli.');
    safePath(this.#directory);
  }
  #header(optional = false) {
    const file = path.join(this.#directory, 'header.json');
    try { const header = parse(read(file, RECORD_LIMIT)); validateHeader(header, this.#owner); return header; }
    catch (error) { if (optional && error.code === 'ENOENT') return null; throw error; }
  }
  state() {
    const initialized = this.#account ? !!this.#header(true) : false;
    return { account: this.#account, initialized, unlocked: !!this.#key };
  }
  #cacheFile(header) { return path.join(this.#keyDirectory, header.owner, header.vault + '.key'); }
  async #protectKey(header, key, epoch) {
    if (!this.#protect || !this.#keyDirectory) return null;
    const clear = encode({ format: FORMAT, owner: header.owner, vault: header.vault, key: key.toString('base64url') });
    try {
      let result;
      try { result = await this.#protect(clear); } catch { this.#check(epoch); throw fail('DEVICE_PROTECTION_FAILED'); }
      this.#check(epoch);
      if (!Buffer.isBuffer(result) || !result.length || result.length > RECORD_LIMIT || result.equals(clear)) throw fail('DEVICE_PROTECTION_FAILED');
      return Buffer.from(result);
    } finally { clear.fill(0); }
  }
  #writeCache(header, protectedKey) {
    if (!protectedKey) return;
    const file = this.#cacheFile(header), directory = path.dirname(file);
    mkdir(directory);
    // Cache is replaceable; portable header and revisions are always immutable.
    safePath(file);
    const temporary = path.join(directory, randomBytes(16).toString('hex') + '.tmp');
    try { immutable(temporary, protectedKey); safePath(file); fs.renameSync(temporary, file); }
    finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  async initialize() {
    const epoch = this.#epoch; this.#check(epoch);
    if (this.#header(true)) throw fail('ALREADY_INITIALIZED');
    const key = randomBytes(32), recovery = randomBytes(32);
    const header = { format: FORMAT, owner: this.#owner, vault: randomBytes(16).toString('hex') };
    try {
      header.wrapped = seal(recovery, key, headerAAD(header));
      header.check = seal(key, Buffer.from('UMAY-PORTABLE-1'), { ...headerAAD(header), id: '$check', wrapped: header.wrapped });
      const protectedKey = await this.#protectKey(header, key, epoch); this.#check(epoch);
      if (this.#header(true)) throw fail('ALREADY_INITIALIZED');
      this.#writeCache(header, protectedKey);
      mkdir(this.#directory); immutable(path.join(this.#directory, 'header.json'), encode(header));
      this.#key = Buffer.from(key); this.#vault = header.vault;
      return { recoveryKey: PREFIX + recovery.toString('base64url') };
    } finally { key.fill(0); recovery.fill(0); }
  }
  async unlock({ recoveryKey, useDeviceKey = false } = {}) {
    this.lock(); const epoch = this.#epoch; this.#check(epoch);
    const header = this.#header(); let key;
    try {
      if (recoveryKey !== undefined) key = unwrap(header, recoveryKey);
      else if (useDeviceKey && this.#unprotect && this.#keyDirectory) {
        let protectedKey;
        try { protectedKey = read(this.#cacheFile(header), RECORD_LIMIT); }
        catch (error) { if (error.code === 'ENOENT') throw fail('DEVICE_KEY_UNAVAILABLE'); throw error; }
        let clear;
        try {
          try { clear = await this.#unprotect(protectedKey); } catch { this.#check(epoch); throw fail('DEVICE_KEY_UNAVAILABLE'); }
          this.#check(epoch);
          if (!Buffer.isBuffer(clear)) throw fail('DEVICE_KEY_UNAVAILABLE');
          const payload = parse(clear);
          exact(payload, ['format', 'owner', 'vault', 'key']);
          if (payload.format !== FORMAT || payload.owner !== header.owner || payload.vault !== header.vault) throw fail('AUTHENTICATION_FAILED');
          key = decode64(payload.key, 32);
        } finally { if (Buffer.isBuffer(clear)) clear.fill(0); }
      } else throw fail('DEVICE_KEY_UNAVAILABLE');
      verifyKey(header, key); this.#load(header, key);
      const protectedKey = recoveryKey !== undefined ? await this.#protectKey(header, key, epoch) : null;
      this.#check(epoch); this.#writeCache(header, protectedKey);
      this.#key = Buffer.from(key); this.#vault = header.vault;
      return this.state();
    } finally { key?.fill(0); }
  }
  #load(header, key) {
    const directory = path.join(this.#directory, 'revisions'); safePath(directory);
    let files;
    try { files = fs.readdirSync(directory); } catch (error) { if (error.code === 'ENOENT') files = []; else throw error; }
    const revisions = []; let size = 0;
    for (const name of files.sort()) {
      if (!/^[a-f0-9]{64}\.[a-f0-9]{32}\.json$/.test(name)) throw fail('INVALID_DATA');
      const bytes = read(path.join(directory, name), RECORD_LIMIT * 2);
      size += bytes.length; if (size > PACKAGE_LIMIT) throw fail('TOO_LARGE');
      const rev = parse(bytes); idValid(rev.id);
      if (name !== this.#revisionName(rev)) throw fail('INVALID_DATA');
      revisions.push(rev);
    }
    return { revisions, ...graph(header, revisions, key) };
  }
  #current() {
    const epoch = this.#epoch; this.#check(epoch, true);
    const header = this.#header();
    if (header.vault !== this.#vault) throw fail('VAULT_CONFLICT');
    verifyKey(header, this.#key);
    return { header, ...this.#load(header, this.#key) };
  }
  #revisionName(rev) { return hash(rev.id) + '.' + rev.revision + '.json'; }
  #withWriteLock(operation) {
    this.#check(this.#epoch); mkdir(this.#directory);
    // Cooperative processes sharing this filesystem serialize budget checks and
    // writes. This ephemeral lock is not exported; external raw sync is not atomic.
    // Never steal a lock: a crash requires explicit recovery after writers stop.
    const file = path.join(this.#directory, '.write.lock'); safePath(file);
    let fd;
    try { fd = fs.openSync(file, fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL, 0o600); }
    catch (error) { if (error.code === 'EEXIST') throw fail('STORE_BUSY', 'Kasa yazma kilidi kullanımda; diğer işlemin tamamlanmasını bekleyin.'); throw error; }
    try { return operation(); }
    finally { fs.closeSync(fd); safePath(file); fs.unlinkSync(file); }
  }
  async list() {
    const epoch = this.#epoch; await Promise.resolve(); this.#check(epoch, true);
    return [...this.#current().records].sort(([a], [b]) => a.localeCompare(b)).map(([id, record]) => summary(id, record));
  }
  #writeRevision(id, body, expectedVersion) {
    idValid(id);
    this.#check(this.#epoch, true);
    return this.#withWriteLock(() => {
      const { header, records, revisions } = this.#current(), previous = records.get(id);
      if ((previous?.version ?? null) !== expectedVersion) throw fail('VERSION_CONFLICT', 'Kayıt değişti; güncel sürümleri inceleyin.');
      const clear = encode(body);
      try {
        if (clear.length > RECORD_LIMIT) throw fail('TOO_LARGE');
        validateBody(parse(clear));
        const rev = { id, revision: randomBytes(16).toString('hex'), parents: previous?.heads.map(n => n.rev.revision).sort() || [] };
        rev.box = seal(this.#key, clear, revisionAAD(header, rev));
        requirePackageCapacity(this.#owner, header, [...revisions, rev]);
        const directory = path.join(this.#directory, 'revisions'); mkdir(directory);
        immutable(path.join(directory, this.#revisionName(rev)), encode(rev));
        return summary(id, this.#current().records.get(id));
      } finally { clear.fill(0); }
    });
  }
  async put({ id, kind, label, public: publicData = {}, secret, expectedVersion = null }) {
    return this.#writeRevision(id, { deleted: false, kind, label, public: publicData, secret, updatedAt: this.#now() }, expectedVersion);
  }
  async remove(id, expectedVersion) {
    if (expectedVersion == null) throw fail('VERSION_CONFLICT');
    return this.#writeRevision(id, { deleted: true, updatedAt: this.#now() }, expectedVersion);
  }
  // Trusted main-process use only. Never expose this method over generic model IPC.
  async resolve(id, { fields } = {}) {
    const epoch = this.#epoch; await Promise.resolve(); this.#check(epoch, true); idValid(id);
    const record = this.#current().records.get(id);
    if (!record) throw fail('NOT_FOUND');
    if (record.heads.length !== 1) throw fail('CONFLICT', 'Kayıtta çözümlenmemiş sürüm çatışması var.');
    const body = record.heads[0].body;
    if (body.deleted) throw fail('DELETED');
    if (fields === undefined) return structuredClone(body.secret);
    if (!Array.isArray(fields) || fields.some(f => typeof f !== 'string')) throw fail('INVALID_ARGUMENT');
    return Object.fromEntries(fields.filter(f => Object.hasOwn(body.secret, f)).map(f => [f, structuredClone(body.secret[f])]));
  }
  async exportEncrypted() {
    const { header, revisions } = this.#current();
    const body = packageBody(this.#owner, header, revisions);
    const bytes = encode({ ...body, mac: mac(this.#key, body).toString('base64url') });
    if (bytes.length > PACKAGE_LIMIT) throw fail('TOO_LARGE');
    return bytes;
  }
  async importEncrypted(bytes, { recoveryKey } = {}) {
    const epoch = this.#epoch; this.#check(epoch);
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) throw fail('INVALID_ARGUMENT');
    if (bytes.byteLength > PACKAGE_LIMIT) throw fail('TOO_LARGE');
    const input = parse(Buffer.from(bytes));
    exact(input, ['format', 'owner', 'header', 'revisions', 'mac']);
    if (input.owner !== this.#owner) throw fail('WRONG_OWNER');
    if (input.format !== FORMAT || !Array.isArray(input.revisions)) throw fail('INVALID_DATA');
    validateHeader(input.header, this.#owner);
    let key;
    try {
      key = unwrap(input.header, recoveryKey);
      const expectedMac = mac(key, packageBody(input.owner, input.header, input.revisions));
      if (!timingSafeEqual(expectedMac, decode64(input.mac, 32))) throw fail('AUTHENTICATION_FAILED');
      graph(input.header, input.revisions, key);
      const prepare = () => {
        const existingHeader = this.#header(true);
        if (existingHeader && !encode(existingHeader).equals(encode(input.header))) throw fail('VAULT_CONFLICT');
        const existing = existingHeader ? this.#load(existingHeader, key).revisions : [];
        const merged = new Map(existing.map(rev => [rev.revision, rev]));
        for (const rev of input.revisions) {
          if (merged.has(rev.revision) && !encode(merged.get(rev.revision)).equals(encode(rev))) throw fail('REVISION_COLLISION');
          merged.set(rev.revision, rev);
        }
        const revisions = [...merged.values()];
        requirePackageCapacity(input.owner, input.header, revisions);
        return graph(input.header, revisions, key);
      };
      prepare();
      const protectedKey = await this.#protectKey(input.header, key, epoch); this.#check(epoch);
      return this.#withWriteLock(() => {
        // Re-read under the lock after platform await: a writer may have added
        // revisions. No await separates this final capacity check from the writes.
        this.#check(epoch); const merged = prepare();
        immutable(path.join(this.#directory, 'header.json'), encode(input.header));
        const directory = path.join(this.#directory, 'revisions'); mkdir(directory);
        for (const rev of merged.order) immutable(path.join(directory, this.#revisionName(rev)), encode(rev));
        this.#writeCache(input.header, protectedKey);
        this.#key?.fill(0); this.#key = Buffer.from(key); this.#vault = input.header.vault;
        return this.state();
      });
    } finally { key?.fill(0); }
  }
}

module.exports = { PortableSecretStore };
