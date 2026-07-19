#!/usr/bin/env node
/**
 * Remove unreachable package records from an npm v3 package-lock without
 * changing dependency versions. Useful when npm itself is unavailable in a
 * controlled runtime but package.json dependencies have already been removed.
 *
 * The traversal mirrors Node's nested node_modules lookup: local package
 * dependencies first, then each ancestor node_modules directory.
 */

import { readFile, writeFile } from 'node:fs/promises';

const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));

if (lock.lockfileVersion !== 3 || !lock.packages?.['']) {
  throw new Error('Expected an npm lockfileVersion 3 package-lock.');
}

const packages = lock.packages;
const root = packages[''];
root.name = packageJson.name;
root.version = packageJson.version;
root.dependencies = packageJson.dependencies ?? {};
root.devDependencies = packageJson.devDependencies ?? {};
if (packageJson.optionalDependencies) root.optionalDependencies = packageJson.optionalDependencies;
else delete root.optionalDependencies;

function parentPackagePath(path) {
  if (!path) return null;
  const nestedIndex = path.lastIndexOf('/node_modules/');
  return nestedIndex >= 0 ? path.slice(0, nestedIndex) : '';
}

function resolveDependency(fromPath, name) {
  for (let current = fromPath; current !== null; current = parentPackagePath(current)) {
    const candidate = current ? `${current}/node_modules/${name}` : `node_modules/${name}`;
    if (packages[candidate]) return candidate;
  }
  return null;
}

const keep = new Set(['']);
const queue = [''];

while (queue.length > 0) {
  const path = queue.shift();
  const record = packages[path];
  const dependencyNames = new Set([
    ...Object.keys(record.dependencies ?? {}),
    ...Object.keys(record.optionalDependencies ?? {}),
    ...Object.keys(record.peerDependencies ?? {}),
  ]);

  for (const name of dependencyNames) {
    const target = resolveDependency(path, name);
    if (!target || keep.has(target)) continue;
    keep.add(target);
    queue.push(target);
  }
}

const originalKeys = Object.keys(packages);
const removedKeys = originalKeys.filter((key) => !keep.has(key));
lock.packages = Object.fromEntries(originalKeys.filter((key) => keep.has(key)).map((key) => [key, packages[key]]));

// Assert every resolvable edge from every retained package still points at a
// retained record before rewriting the lockfile.
for (const [path, record] of Object.entries(lock.packages)) {
  const dependencyNames = new Set([
    ...Object.keys(record.dependencies ?? {}),
    ...Object.keys(record.optionalDependencies ?? {}),
    ...Object.keys(record.peerDependencies ?? {}),
  ]);
  for (const name of dependencyNames) {
    const target = resolveDependency(path, name);
    if (target && !keep.has(target)) {
      throw new Error(`Prune would orphan ${path || '<root>'} -> ${name} (${target}).`);
    }
  }
}

await writeFile('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`, 'utf8');

console.log(`Kept ${keep.size} package records; removed ${removedKeys.length} unreachable records.`);
const retired = removedKeys.filter((key) => /monaco|puckeditor|tiptap/i.test(key));
console.log(`Removed ${retired.length} Monaco/Puck/Tiptap records.`);
