import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Supprime la fixture E2E (voir scripts/e2e-fixtures.mjs) qu'importe l'issue des tests. */
export default function globalTeardown(): void {
  execFileSync('node', [path.join(__dirname, '..', 'scripts', 'e2e-fixtures.mjs'), 'remove'], {
    stdio: 'inherit',
  });
}
