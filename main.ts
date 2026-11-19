import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outputDir, { recursive: true });

const appSrc = join(scriptDir, 'app');
const appDst = join(outputDir, 'app');
cpSync(appSrc, appDst, { recursive: true });

const shotsSrc = join(scriptDir, 'screenshots');
const shotsDst = join(outputDir, 'screenshots');
mkdirSync(shotsDst, { recursive: true });

if (!existsSync(shotsSrc)) {
  console.warn('WARNING: screenshots directory missing');
} else {
  const entries = readdirSync(shotsSrc, { withFileTypes: true });
  const images = entries.filter(e => e.isFile() && /\.(png|jpg|jpeg|svg|webp)$/i.test(e.name));
  if (images.length === 0) {
    console.warn('WARNING: screenshots directory has no image files');
  } else {
    cpSync(shotsSrc, shotsDst, { recursive: true });
  }
}

const dossierPath = join(outputDir, 'dossier.json');
const dossierJson = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
});
writeFileSync(dossierPath, dossierJson);