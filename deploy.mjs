// Publish dist/ to the gh-pages branch. Use this when GitHub Actions is not
// wired up (see DEPLOY.md); once it is, pushing to main is enough.
// `npm run deploy`
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, 'dist');
const WORK = join(ROOT, '.deploy');
const BRANCH = 'gh-pages';

const git = (args, cwd = ROOT) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim();

execFileSync('node', [join(ROOT, 'build.mjs'), '--check'], { stdio: 'inherit' });
if (!existsSync(OUT)) throw new Error('build produced no dist/');

const remote = git(['remote', 'get-url', 'origin']);
const sha = git(['rev-parse', '--short', 'HEAD']);

rmSync(WORK, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });
git(['init', '-q', '-b', BRANCH], WORK);
git(['remote', 'add', 'origin', remote], WORK);
cpSync(OUT, WORK, { recursive: true });
writeFileSync(join(WORK, '.nojekyll'), '');
git(['add', '-A'], WORK);
git(['-c', 'user.email=deploy@praxis-research.org', '-c', 'user.name=deploy',
  'commit', '-q', '-m', `Build ${sha}`], WORK);
git(['push', '-f', 'origin', BRANCH], WORK);
rmSync(WORK, { recursive: true, force: true });

console.log(`\npushed dist/ (build ${sha}) to ${BRANCH}`);
