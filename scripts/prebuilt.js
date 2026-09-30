'use strict';

/**
 * Fetch the prebuilt Next.js output from the repo's `deploy` branch (published by
 * GitHub Actions) — used by servers that cannot compile Next.js themselves.
 * Only a build whose SOURCE_HASH matches this checkout is accepted.
 *
 * Uses only Node built-ins (fetch, zlib and a minimal tar reader), so it works on
 * hosts without git, npm or tar at runtime.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const cstr = (buf) => {
  const end = buf.indexOf(0);
  return buf.subarray(0, end === -1 ? buf.length : end).toString('utf8');
};

/** pax extended header records: "<len> key=value\n" (length in bytes). */
function parsePax(buf) {
  const out = {};
  let i = 0;
  while (i < buf.length) {
    const space = buf.indexOf(0x20, i);
    if (space === -1) break;
    const len = Number.parseInt(buf.subarray(i, space).toString('ascii'), 10);
    if (!len) break;
    const record = buf.subarray(space + 1, i + len - 1).toString('utf8');
    const eq = record.indexOf('=');
    if (eq > 0) out[record.slice(0, eq)] = record.slice(eq + 1);
    i += len;
  }
  return out;
}

/** Minimal ustar/pax/GNU tar reader → [{ name, type, data }]. */
function untar(buf) {
  const entries = [];
  let offset = 0;
  let nextName = null;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const name = cstr(header.subarray(0, 100));
    const size = Number.parseInt(cstr(header.subarray(124, 136)).trim() || '0', 8);
    const type = String.fromCharCode(header[156] || 48); // NUL means a regular file
    const prefix = header.subarray(257, 263).toString('ascii').startsWith('ustar') ? cstr(header.subarray(345, 500)) : '';
    const data = buf.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;

    if (type === 'x') {
      nextName = parsePax(data).path || nextName;
      continue;
    }
    if (type === 'g') continue; // global pax header (e.g. commit id)
    if (type === 'L') {
      nextName = cstr(data);
      continue;
    }
    entries.push({ name: nextName || (prefix ? `${prefix}/${name}` : name), type, data });
    nextName = null;
  }
  return entries;
}

/**
 * @returns {Promise<{ ok: true } | { ok: false, remoteHash: string }>}
 */
async function fetchPrebuilt({ repo, branch = 'deploy', sourceHash, frontendDir, log = () => {} }) {
  const url = `https://codeload.github.com/${repo}/tar.gz/refs/heads/${branch}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${url}`);
  const entries = untar(zlib.gunzipSync(Buffer.from(await res.arrayBuffer())));

  const NEXT = /^[^/]+\/frontend\/\.next\/(.+)$/;
  const marker = entries.find((e) => /^[^/]+\/frontend\/\.next\/SOURCE_HASH$/.test(e.name));
  const remoteHash = marker ? marker.data.toString('utf8').trim() : 'none';
  if (remoteHash !== sourceHash) return { ok: false, remoteHash };

  const tmp = path.join(frontendDir, '.next-prebuilt');
  fs.rmSync(tmp, { recursive: true, force: true });
  let count = 0;
  for (const entry of entries) {
    const match = entry.name.match(NEXT);
    if (!match || match[1].split('/').some((part) => part === '..')) continue;
    const dest = path.join(tmp, match[1]);
    if (entry.type === '5') {
      fs.mkdirSync(dest, { recursive: true });
    } else if (entry.type === '0' || entry.type === '7') {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.data);
      count += 1;
    }
  }
  if (!fs.existsSync(path.join(tmp, 'BUILD_ID'))) throw new Error('downloaded build is incomplete (no BUILD_ID)');

  const target = path.join(frontendDir, '.next');
  fs.rmSync(target, { recursive: true, force: true });
  fs.renameSync(tmp, target);
  log(`[web] installed prebuilt frontend (${count} files, source ${sourceHash}) from ${repo}@${branch}`);
  return { ok: true };
}

module.exports = { fetchPrebuilt, untar };
