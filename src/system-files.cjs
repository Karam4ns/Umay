'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash, randomUUID } = require('node:crypto');

const MAX_READ = 64 * 1024;
const MAX_WRITE = 1024 * 1024;
const MAX_PAGE = 100;
const MAX_PAGE_BYTES = 128 * 1024;
const MAX_SCAN = 5000;
const MAX_CURSORS = 32;
const CURSOR_TTL = 5 * 60 * 1000;
const s = description => ({ type: 'string', description });
const number = (description, minimum, maximum) => ({ type: 'integer', description, minimum, maximum });
const absolutePath = s('Absolute filesystem path, including drive or UNC paths. Known roots are discovery hints, not access restrictions.');
const version = s('Version returned by files_stat. Required to replace an existing file; optional stale-source guard for copy/move/rename/trash.');
const schemas = [
  ['roots', 'Discover known folders and currently connected volumes; inaccessible locations include real OS error codes.', {}, []],
  ['list', 'List a bounded directory page without following symbolic links. Continue with nextCursor; cursors expire after five minutes.', { path: absolutePath, cursor: s('Continuation cursor from this tool.'), limit: number('Maximum entries.', 1, MAX_PAGE) }, []],
  ['find', 'Recursively search filenames by literal substring, without following symbolic links. Empty pages can still have nextCursor when the scan budget is exhausted.', { path: absolutePath, query: s('Literal filename substring; empty matches all.'), caseSensitive: { type: 'boolean' }, cursor: s('Continuation cursor from this tool.'), limit: number('Maximum matches.', 1, MAX_PAGE) }, []],
  ['stat', 'Inspect an existing object without following its final symbolic link; return a version fingerprint for guarded mutations.', { path: absolutePath }, ['path']],
  ['read', 'Read a bounded UTF-8 text page. Offsets and nextOffset are bytes. UTF-8 pages preserve complete characters (up to 3 extra bytes for a tiny page). Use encoding=base64 for binary or exact byte chunks.', { path: absolutePath, offset: number('Byte offset at a UTF-8 character boundary.', 0, Number.MAX_SAFE_INTEGER), maxBytes: number('Target page size in bytes.', 1, MAX_READ), encoding: { type: 'string', enum: ['utf8', 'base64'] } }, ['path']],
  ['write', 'Create UTF-8 text exclusively by default. To replace, supply expectedVersion from files_stat. Size is limited to 1 MiB; cancellation may leave a partial write described by the receipt.', { path: absolutePath, content: s('UTF-8 text, at most 1 MiB.'), expectedVersion: version }, ['path', 'content']],
  ['mkdir', 'Create one directory exclusively. The parent must exist; existing destinations are never merged or replaced.', { path: absolutePath }, ['path']],
  ['copy', 'Copy a file or directory tree exclusively. Never merge/replace or follow links. Cancellation/failure leaves destinations with a partial receipt; inspect before continuing.', { source: absolutePath, destination: absolutePath, expectedVersion: version }, ['source', 'destination']],
  ['move', 'Move within a volume without replacing a destination. File moves require hard-link support. Unsupported filesystems and cross-device moves return source-preserving recovery instructions: copy, verify, then separately authorized trash. Directory moves use Windows rename semantics.', { source: absolutePath, destination: absolutePath, expectedVersion: version }, ['source', 'destination']],
  ['rename', 'Rename within the same parent without replacing another object. name must be a single filename.', { path: absolutePath, name: s('New filename, without path separators.'), expectedVersion: version }, ['path', 'name']],
  ['trash', 'Send an object to the OS recycle bin through Electron shell.trashItem. Never permanently delete. Volume roots and symbolic links are rejected.', { path: absolutePath, expectedVersion: version }, ['path']],
  ['open', 'Open an existing file or directory with the OS associated application; this is not proof that application content was processed.', { path: absolutePath }, ['path']]
];

function fail(code, message) { return Object.assign(new Error(message), { code }); }
function absolute(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || !path.isAbsolute(value)) throw fail('INVALID_PATH', 'An absolute path is required.');
  // Drive-relative paths, device namespaces and NTFS alternate streams are not ordinary file paths.
  if (process.platform === 'win32' && (/^\\\\[?.]\\/.test(value) || /:/.test(value.slice(2)) || !(/^[a-z]:[\\/]/i.test(value) || /^\\\\[^\\]+\\[^\\]+/.test(value)))) throw fail('INVALID_PATH', 'Use a fully qualified drive or UNC file path, without device namespaces or alternate streams.');
  return path.resolve(value);
}
function bounded(value, fallback, max, min = 1) {
  if (value === undefined) return fallback;
  if (!Number.isSafeInteger(value) || value < min || value > max) throw fail('INVALID_ARGUMENT', `Expected an integer from ${min} to ${max}.`);
  return value;
}
function fingerprint(stat) {
  return createHash('sha256').update([stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs, stat.birthtimeNs].join(':')).digest('hex');
}
function sameContentIdentity(a, b) { return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeNs === b.mtimeNs; }
function sameObjectIdentity(a, b) { return a.dev === b.dev && a.ino === b.ino && a.birthtimeNs === b.birthtimeNs && kind(a) === kind(b); }
function kind(stat) { return stat.isSymbolicLink() ? 'symlink' : stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other'; }
function info(target, stat) {
  return { path: target, name: path.basename(target), type: kind(stat), size: Number(stat.size), modifiedAt: new Date(Number(stat.mtimeMs)).toISOString(), version: fingerprint(stat), versionScope: 'entry-metadata' };
}
function notVolumeRoot(target) {
  if (target === path.parse(target).root) throw fail('ROOT_OPERATION_FORBIDDEN', 'Volume roots cannot be moved, renamed or trashed.');
}

class FileTools {
  constructor({ roots = [], discoverDrives = false, trash, openPath, publish } = {}) {
    this.roots = roots.map(root => typeof root === 'string' ? { name: path.basename(root) || root, path: absolute(root) } : { name: String(root.name || root.path), path: absolute(root.path) });
    this.discoverDrives = discoverDrives || !roots.length;
    this.trash = trash;
    this.openPath = openPath;
    this.publish = publish;
    this.cursors = new Map();
  }

  definitions() {
    return schemas.map(([name, description, properties, required]) => ({ name: `files_${name}`, description, inputSchema: { type: 'object', properties, required, additionalProperties: false } }));
  }

  reset() {
    const states = [...this.cursors.values()];
    this.cursors.clear();
    return Promise.allSettled(states.map(state => state.iterator.return()));
  }

  async _check(context) {
    if (context.signal?.aborted) throw fail('ABORT_ERR', 'File operation cancelled.');
    await context.check();
    if (context.signal?.aborted) throw fail('ABORT_ERR', 'File operation cancelled.');
  }

  // Reject existing link ancestors as well as final links. This is a snapshot check,
  // not a security boundary against another process replacing parent directories.
  async _safe(target, context, { finalLink = false } = {}) {
    const root = path.parse(target).root;
    const parts = target.slice(root.length).split(path.sep).filter(Boolean);
    let current = root;
    for (let i = -1; i < parts.length; i++) {
      if (i >= 0) current = path.join(current, parts[i]);
      await this._check(context);
      let stat;
      try { stat = await fs.lstat(current, { bigint: true }); }
      catch (error) { if (error.code === 'ENOENT') return; throw error; }
      if (stat.isSymbolicLink() && !(finalLink && current === target)) throw fail('SYMLINK_NOT_ALLOWED', `Symbolic link/reparse-point traversal refused: ${current}`);
    }
  }

  async _stat(target, context, { finalLink = false, expectedVersion } = {}) {
    await this._safe(target, context, { finalLink });
    await this._check(context);
    const stat = await fs.lstat(target, { bigint: true });
    if (expectedVersion !== undefined && fingerprint(stat) !== expectedVersion) throw fail('VERSION_CONFLICT', `Object changed since its observed version: ${target}`);
    return stat;
  }

  _record(receipt, target, effect) {
    receipt.effects += 1;
    if (receipt.completed.length < MAX_PAGE) receipt.completed.push({ path: target, effect });
    else receipt.omittedEffects += 1;
  }

  async _event(context, receipt, extra = {}) {
    if (this.publish) await this.publish({ type: 'file-progress', taskId: context.taskId, operation: receipt.operation, bytesCopied: receipt.bytesCopied, effects: receipt.effects, ...extra });
  }

  async perform(name, args = {}, { signal, check = () => {}, taskId } = {}) {
    const operation = typeof name === 'string' && name.startsWith('files_') ? name.slice(6) : '';
    const definition = schemas.find(([key]) => key === operation);
    if (!definition) throw fail('UNKNOWN_TOOL', `Unknown filesystem tool: ${name}`);
    if (!args || typeof args !== 'object' || Array.isArray(args)) throw fail('INVALID_ARGUMENT', 'Arguments must be an object.');
    const [, , properties, required] = definition;
    for (const key of required) if (args[key] === undefined) throw fail('INVALID_ARGUMENT', `Missing required argument: ${key}`);
    for (const [key, value] of Object.entries(args)) {
      if (value === undefined) continue;
      const schema = properties[key];
      if (!schema || (schema.type === 'integer' ? !Number.isSafeInteger(value) || value < schema.minimum || value > schema.maximum : typeof value !== schema.type) || (schema.enum && !schema.enum.includes(value))) throw fail('INVALID_ARGUMENT', `Invalid or undeclared argument: ${key}`);
    }
    const context = { signal, check, taskId };
    const receipt = { operation: name, taskId: taskId ?? null, status: 'not-started', effects: 0, bytesCopied: 0, completed: [], omittedEffects: 0 };
    try {
      await this._check(context);
      let result;
      if (operation === 'roots') result = await this._roots(context);
      else if (operation === 'list' || operation === 'find') result = await this._page(operation, args, context);
      else if (operation === 'copy' || operation === 'move') result = await this[`_${operation}`](args, context, receipt);
      else {
        const target = absolute(args.path);
        if (operation === 'stat') result = info(target, await this._stat(target, context, { finalLink: true }));
        else if (operation === 'read') result = await this._read(target, args, context);
        else if (operation === 'write') result = await this._write(target, args, context, receipt);
        else if (operation === 'mkdir') {
          await this._safe(target, context); await this._check(context);
          await fs.mkdir(target); this._record(receipt, target, 'created-directory');
          result = info(target, await fs.lstat(target, { bigint: true }));
        } else if (operation === 'rename') {
          if (typeof args.name !== 'string' || !args.name || args.name === '.' || args.name === '..' || /[\\/\0]/.test(args.name) || (process.platform === 'win32' && /[:<>"|?*]/.test(args.name))) throw fail('INVALID_ARGUMENT', 'name must be a single valid filename.');
          result = await this._move({ source: target, destination: path.join(path.dirname(target), args.name), expectedVersion: args.expectedVersion }, context, receipt);
        } else if (operation === 'trash') {
          notVolumeRoot(target);
          await this._stat(target, context, args);
          const trash = this.trash || this._shell().trashItem.bind(this._shell());
          await this._check(context);
          await trash(target); this._record(receipt, target, 'trashed');
          result = { path: target, trashed: true };
        } else if (operation === 'open') {
          await this._stat(target, context);
          const open = this.openPath || this._shell().openPath.bind(this._shell());
          await this._check(context);
          const error = await open(target);
          if (error) throw fail('OPEN_FAILED', String(error));
          this._record(receipt, target, 'opened'); result = { path: target, opened: true };
        }
      }
      receipt.status = 'completed';
      return { ...result, receipt };
    } catch (error) {
      receipt.status = receipt.effects || receipt.bytesCopied ? 'partial' : 'not-started';
      error.receipt = receipt;
      if (error.code === 'EXDEV') error.details = { source: args.source || args.path, destination: args.destination, sourcePreserved: true, retryable: false, recovery: 'Cross-volume move is unsupported. Inspect any partial destination. Use files_copy to an unused destination, verify it, obtain a fresh files_stat source version, then files_trash only with existing user authorization.' };
      throw error; // Keep ENOENT/EACCES/EPERM/etc. intact for the broker/elevation path.
    }
  }

  _shell() {
    const shell = require('electron').shell;
    if (!shell) throw fail('SHELL_UNAVAILABLE', 'Opening and recycling require the Electron main process or injected adapters.');
    return shell;
  }

  async _roots(context) {
    let roots = [...this.roots];
    if (!roots.length) {
      const home = os.homedir();
      roots = [{ name: 'Home', path: home }, ...['Desktop', 'Documents', 'Downloads'].map(name => ({ name, path: path.join(home, name) }))];
    }
    if (this.discoverDrives) {
      if (process.platform === 'win32') {
        for (let drive = 65; drive <= 90; drive++) {
          await this._check(context);
          const target = `${String.fromCharCode(drive)}:\\`;
          try { await fs.stat(target); roots.push({ name: target, path: target, kind: 'volume' }); }
          catch (error) { if (!['ENOENT', 'ENOTDIR', 'ENXIO'].includes(error.code)) roots.push({ name: target, path: target, kind: 'volume', error: { code: error.code, message: error.message } }); }
        }
      } else roots.push({ name: '/', path: '/', kind: 'volume' });
    }
    const result = [];
    for (const root of roots.slice(0, MAX_PAGE)) {
      await this._check(context);
      try { const stat = await fs.lstat(root.path); result.push({ ...root, available: true, type: kind(stat) }); }
      catch (error) { result.push({ ...root, available: false, error: { code: error.code, message: error.message } }); }
    }
    return { roots: result, truncated: roots.length > MAX_PAGE };
  }

  async _validateTraversal(state) {
    for (const [target, observed] of state.ancestors) {
      const current = await this._stat(target, state.context);
      if (!sameObjectIdentity(current, observed)) throw fail('TRAVERSAL_CHANGED', `A traversed directory was replaced: ${target}`);
    }
  }

  async *_walk(target, recursive, state, depth = 0, observed) {
    if (depth > 128) throw fail('DEPTH_LIMIT', 'Directory nesting exceeded 128 levels.');
    await this._safe(target, state.context, { finalLink: !observed });
    const stat = await fs.lstat(target, { bigint: true });
    if (stat.isSymbolicLink()) { state.skippedLinks++; return; }
    if (observed && !sameObjectIdentity(stat, observed)) throw fail('TRAVERSAL_CHANGED', `A directory changed before traversal: ${target}`);
    if (!stat.isDirectory()) throw fail('ENOTDIR', `Not a directory: ${target}`);
    state.ancestors.set(target, stat);
    const directory = await fs.opendir(target);
    try {
      for await (const entry of directory) {
        // An open directory iterator can outlive a rename. Validate its saved
        // pathname ancestors before resolving a child on a later page.
        await this._validateTraversal(state);
        const child = path.join(target, entry.name);
        const childStat = await fs.lstat(child, { bigint: true });
        const result = info(child, childStat);
        if (childStat.isSymbolicLink()) state.skippedLinks++;
        yield result;
        if (recursive && childStat.isDirectory()) yield* this._walk(child, true, state, depth + 1, childStat);
      }
    } finally {
      // for-await closes on return/error; explicit close covers a failed iterator.
      try { await directory.close(); } catch (error) { if (error.code !== 'ERR_DIR_CLOSED') throw error; }
      state.ancestors.delete(target);
    }
  }

  async _page(operation, args, context) {
    const limit = bounded(args.limit, 50, MAX_PAGE);
    const now = Date.now();
    for (const [key, state] of this.cursors) if (now - state.used > CURSOR_TTL) { this.cursors.delete(key); await state.iterator.return(); }
    let state, cursor = args.cursor;
    if (cursor !== undefined) {
      state = this.cursors.get(cursor);
      if (!state || state.operation !== operation) throw fail('INVALID_CURSOR', 'Cursor expired, was reset, or belongs to another tool.');
      if (state.busy) throw fail('CURSOR_BUSY', 'Do not concurrently advance the same cursor.');
    } else {
      const target = absolute(args.path);
      await this._safe(target, context, { finalLink: operation === 'find' });
      if (args.query !== undefined && (typeof args.query !== 'string' || args.query.length > 1024)) throw fail('INVALID_ARGUMENT', 'query must be a string of at most 1024 characters.');
      if (this.cursors.size >= MAX_CURSORS) {
        const [key, stale] = this.cursors.entries().next().value;
        this.cursors.delete(key); await stale.iterator.return();
      }
      state = { operation, used: now, skippedLinks: 0, query: args.query || '', caseSensitive: args.caseSensitive === true, path: target, pending: null, ancestors: new Map() };
      state.iterator = this._walk(target, operation === 'find', state);
      cursor = randomUUID(); this.cursors.set(cursor, state);
    }
    state.busy = true;
    state.context = context;
    const entries = [];
    let bytes = 0, scanned = 0, done = false;
    try {
      while (entries.length < limit && scanned < MAX_SCAN) {
        await this._check(context);
        // Re-check the path each page; never resume through a replaced root link.
        if (!scanned) await this._safe(state.path, context, { finalLink: operation === 'find' });
        await this._validateTraversal(state);
        const next = state.pending ? { value: state.pending, done: false } : await state.iterator.next();
        state.pending = null;
        if (next.done) { done = true; break; }
        scanned++;
        const entry = next.value;
        const name = state.caseSensitive ? entry.name : entry.name.toLocaleLowerCase();
        const query = state.caseSensitive ? state.query : state.query.toLocaleLowerCase();
        if (operation === 'find' && !name.includes(query)) continue;
        const size = Buffer.byteLength(JSON.stringify(entry));
        if (bytes + size > MAX_PAGE_BYTES && entries.length) { state.pending = entry; break; }
        entries.push(entry); bytes += size;
      }
      if (done) { this.cursors.delete(cursor); await state.iterator.return(); }
      state.used = Date.now();
      return { path: state.path, entries, nextCursor: done ? null : cursor, scanned, skippedLinks: state.skippedLinks };
    } catch (error) { this.cursors.delete(cursor); await state.iterator.return(); throw error; }
    finally { state.busy = false; }
  }

  async _read(target, args, context) {
    const offset = bounded(args.offset, 0, Number.MAX_SAFE_INTEGER, 0);
    const maxBytes = bounded(args.maxBytes, MAX_READ, MAX_READ);
    const encoding = args.encoding || 'utf8';
    if (!['utf8', 'base64'].includes(encoding)) throw fail('INVALID_ARGUMENT', 'encoding must be utf8 or base64.');
    const observed = await this._stat(target, context);
    if (!observed.isFile()) throw fail('NOT_FILE', 'Only regular files can be read.');
    const handle = await fs.open(target, 'r');
    try {
      const stat = await handle.stat({ bigint: true });
      if (fingerprint(stat) !== fingerprint(observed)) throw fail('VERSION_CONFLICT', 'File changed while opening.');
      await this._check(context);
      const buffer = Buffer.alloc(maxBytes + (encoding === 'utf8' ? 3 : 0));
      const read = await handle.read(buffer, 0, buffer.length, offset);
      let bytesRead = Math.min(maxBytes, read.bytesRead);
      if (encoding === 'utf8') {
        while (bytesRead > 0 && bytesRead < read.bytesRead && (buffer[bytesRead] & 0xc0) === 0x80) bytesRead--;
        if (!bytesRead && read.bytesRead) {
          const first = buffer[0];
          bytesRead = Math.min(read.bytesRead, first < 0x80 ? 1 : first < 0xe0 ? 2 : first < 0xf0 ? 3 : 4);
        }
      }
      await this._check(context);
      if (fingerprint(await handle.stat({ bigint: true })) !== fingerprint(stat)) throw fail('VERSION_CONFLICT', 'File changed while reading.');
      const nextOffset = offset + bytesRead;
      let content;
      if (encoding === 'utf8') {
        try { content = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buffer.subarray(0, bytesRead)); }
        catch { throw fail('INVALID_ENCODING', 'Invalid UTF-8 or offset is inside a character. Use encoding=base64 for exact bytes.'); }
      } else content = buffer.subarray(0, bytesRead).toString('base64');
      return { path: target, content, encoding, bytesRead, nextOffset, truncated: nextOffset < Number(stat.size), version: fingerprint(stat) };
    } finally { await handle.close(); }
  }

  async _write(target, args, context, receipt) {
    if (typeof args.content !== 'string' || Buffer.byteLength(args.content) > MAX_WRITE) throw fail('INVALID_ARGUMENT', 'content must be UTF-8 text of at most 1 MiB.');
    await this._safe(target, context);
    const replacing = args.expectedVersion !== undefined;
    if (replacing && (typeof args.expectedVersion !== 'string' || !args.expectedVersion)) throw fail('INVALID_ARGUMENT', 'expectedVersion must be a nonempty version fingerprint.');
    if (replacing) await this._stat(target, context, args);
    await this._check(context);
    const handle = await fs.open(target, replacing ? 'r+' : 'wx');
    if (!replacing) this._record(receipt, target, 'created-file');
    try {
      if (replacing) {
        const stat = await handle.stat({ bigint: true });
        if (!stat.isFile() || fingerprint(stat) !== args.expectedVersion) throw fail('VERSION_CONFLICT', 'File changed before replacement.');
        await this._check(context);
        await handle.truncate(0); this._record(receipt, target, 'truncated-for-replacement');
      }
      const data = Buffer.from(args.content);
      let offset = 0;
      while (offset < data.length) {
        await this._check(context);
        const { bytesWritten } = await handle.write(data, offset, Math.min(64 * 1024, data.length - offset), offset);
        if (!bytesWritten) throw fail('EIO', 'Write made no progress.');
        offset += bytesWritten;
      }
      await handle.sync();
      return { ...info(target, await handle.stat({ bigint: true })), bytesWritten: offset };
    } finally { await handle.close(); }
  }

  async _copy(args, context, receipt) {
    const source = absolute(args.source), destination = absolute(args.destination);
    const stat = await this._stat(source, context, args);
    await this._safe(destination, context);
    const relative = path.relative(source, destination);
    if (!relative || (stat.isDirectory() && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))) throw fail('INVALID_DESTINATION', 'Cannot copy a directory into itself or copy an object to itself.');
    await this._copyObject(source, destination, stat, context, receipt);
    return { source, destination, copied: true };
  }

  async _copyObject(source, destination, observed, context, receipt, depth = 0) {
    if (depth > 128) throw fail('DEPTH_LIMIT', 'Directory nesting exceeded 128 levels.');
    await this._safe(source, context); await this._safe(destination, context);
    await this._check(context);
    if (observed.isSymbolicLink()) throw fail('SYMLINK_NOT_ALLOWED', 'Copying symbolic links is not supported.');
    if (observed.isDirectory()) {
      await fs.mkdir(destination); this._record(receipt, destination, 'created-directory');
      const directory = await fs.opendir(source);
      for await (const entry of directory) {
        await this._check(context);
        const child = path.join(source, entry.name);
        await this._copyObject(child, path.join(destination, entry.name), await fs.lstat(child, { bigint: true }), context, receipt, depth + 1);
      }
      const after = await fs.lstat(source, { bigint: true });
      if (fingerprint(after) !== fingerprint(observed)) throw fail('VERSION_CONFLICT', 'Source directory changed during copy.');
      return;
    }
    if (!observed.isFile()) throw fail('NOT_FILE', 'Only regular files and directories can be copied.');
    const input = await fs.open(source, 'r');
    let output;
    try {
      if (fingerprint(await input.stat({ bigint: true })) !== fingerprint(observed)) throw fail('VERSION_CONFLICT', 'Source changed before copy.');
      await this._check(context);
      output = await fs.open(destination, 'wx'); this._record(receipt, destination, 'created-file');
      const buffer = Buffer.alloc(256 * 1024);
      let position = 0;
      while (position < Number(observed.size)) {
        await this._check(context);
        const { bytesRead } = await input.read(buffer, 0, Math.min(buffer.length, Number(observed.size) - position), position);
        if (!bytesRead) throw fail('VERSION_CONFLICT', 'Source shortened during copy.');
        let written = 0;
        while (written < bytesRead) {
          await this._check(context);
          const result = await output.write(buffer, written, bytesRead - written, position + written);
          if (!result.bytesWritten) throw fail('EIO', 'Copy made no progress.');
          written += result.bytesWritten; receipt.bytesCopied += result.bytesWritten;
        }
        position += bytesRead;
        await this._event(context, receipt, { source, destination });
      }
      await this._check(context);
      await output.sync();
      if (fingerprint(await input.stat({ bigint: true })) !== fingerprint(observed) || fingerprint(await fs.lstat(source, { bigint: true })) !== fingerprint(observed)) throw fail('VERSION_CONFLICT', 'Source changed during copy.');
      this._record(receipt, destination, 'copied-file');
    } finally { await output?.close(); await input.close(); }
  }

  async _move(args, context, receipt) {
    const source = absolute(args.source), destination = absolute(args.destination);
    notVolumeRoot(source);
    if (source === destination) throw fail('INVALID_DESTINATION', 'Source and destination must differ.');
    const observed = await this._stat(source, context, args);
    await this._safe(destination, context);
    let existing;
    try { existing = await fs.lstat(destination, { bigint: true }); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (existing) {
      if (process.platform === 'win32' && source.toLowerCase() === destination.toLowerCase() && sameObjectIdentity(existing, observed)) {
        return await this._caseRename(source, destination, observed, context, receipt);
      }
      throw fail('EEXIST', 'Destination already exists.');
    }
    await this._check(context);
    if (observed.isDirectory()) {
      // Node has no portable RENAME_NOREPLACE for directories. Windows refuses
      // an existing directory target; elsewhere refuse rather than risk clobber.
      if (process.platform !== 'win32') throw fail('DIRECTORY_MOVE_UNSUPPORTED', 'Atomic no-replace directory move requires Windows. Copy then inspect and explicitly trash the source instead.');
      const relative = path.relative(source, destination);
      if (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) throw fail('INVALID_DESTINATION', 'Cannot move a directory into itself.');
      await this._stat(source, context, { expectedVersion: fingerprint(observed) });
      await this._check(context);
      await fs.rename(source, destination); // EXDEV is propagated with source untouched.
      this._record(receipt, destination, 'moved-directory');
    } else if (observed.isFile()) {
      // link creates exclusively and is same-volume only. A failure NEVER falls
      // back to rename/copy+delete, which could overwrite or remove live data.
      try { await fs.link(source, destination); }
      catch (error) {
        if (error.code !== 'EEXIST') error.details = {
          source, destination, sourcePreserved: true, retryable: false,
          reason: 'Exclusive hard-link move failed. The OS error may indicate missing filesystem support or insufficient rights. No copy/delete fallback was attempted.',
          recovery: 'Use files_copy to an unused destination, verify the complete copy, obtain a fresh files_stat source version, then files_trash only with existing user authorization. Do not blindly repeat the move.'
        };
        throw error;
      }
      this._record(receipt, destination, 'linked-destination');
      await this._check(context);
      const after = await this._stat(source, context);
      if (!sameContentIdentity(after, observed)) throw fail('VERSION_CONFLICT', 'Source changed after creating move destination; both names retained.');
      // _stat above performed the last cancellation/policy check before reading
      // the current identity. Do not call arbitrary policy code after that
      // snapshot and before unlinking the observed pathname.
      await fs.unlink(source); this._record(receipt, source, 'removed-source-name');
    } else throw fail('NOT_FILE', 'Only regular files and directories can be moved.');
    return { source, destination, moved: true, ...info(destination, await fs.lstat(destination, { bigint: true })) };
  }

  async _caseRename(source, destination, observed, context, receipt) {
    const directory = await fs.opendir(path.dirname(source));
    const destinationName = path.basename(destination);
    for await (const entry of directory) {
      await this._check(context);
      // Windows also supports case-sensitive directories. A distinct exact
      // destination entry must not be overwritten, even if it is a hard link.
      if (entry.name === destinationName) throw fail('EEXIST', 'A distinct destination entry already exists.');
    }
    const current = await this._stat(source, context, { expectedVersion: fingerprint(observed) });
    const existing = await this._stat(destination, context);
    if (!sameObjectIdentity(current, existing)) throw fail('VERSION_CONFLICT', 'Case-only rename target changed.');
    await fs.rename(source, destination);
    this._record(receipt, destination, 'renamed-case');
    return { source, destination, moved: true, caseOnly: true, ...info(destination, await fs.lstat(destination, { bigint: true })) };
  }
}

module.exports = { FileTools };
