"""Exercise release preservation with an isolated fake GitHub CLI."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
FAKE_GH = r'''#!/usr/bin/env python3
import base64, json, os
from pathlib import Path
import shutil, sys
state_path = Path(os.environ['MM_PUBLICATION_TEST_STATE'])
state = json.loads(state_path.read_text())
args = sys.argv[1:]
state['calls'].append(args)
def finish(value=None, code=0):
    state_path.write_text(json.dumps(state))
    if value is not None: print(json.dumps(value))
    sys.exit(code)
if args[:2] == ['release', 'view']:
    if args[-1] == 'body': finish({'body': state.get('body', '')})
    finish({'url': 'https://github.com/bradthomasbrown/Mercenary-Moderators/releases/tag/v0.16.8', 'tagName': 'v0.16.8', 'isDraft': False, 'isPrerelease': True, 'assets': [{'name': n} for n in state['assets']]})
if args[:2] == ['release', 'download']:
    name = args[args.index('--pattern') + 1]
    target = Path(args[args.index('--dir') + 1]) / name
    target.write_bytes(base64.b64decode(state['assets'][name]))
    finish()
if args[:2] == ['release', 'upload']:
    path = Path(args[3])
    if path.name in state['assets']:
        print('Refusing duplicate asset', file=sys.stderr); finish(code=1)
    state['assets'][path.name] = base64.b64encode(path.read_bytes()).decode()
    finish()
if args[:2] == ['release', 'edit']:
    state['body'] = Path(args[args.index('--notes-file') + 1]).read_text()
    finish()
if args[0] == 'api':
    if '/contents/' not in args[1]: finish({'private': state['private']})
    if '--method' in args:
        value = json.loads(sys.stdin.read())
        state['record'] = json.loads(base64.b64decode(value['content']))
        finish({'content': {'sha': 'fixture'}})
    print('HTTP 404', file=sys.stderr); finish(code=1)
print('Unexpected fake CLI call', file=sys.stderr); finish(code=1)
'''

class PublicationNoticesTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='mm-publication-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for name in ('scripts', 'extension', 'docs/releases', 'LICENSES'):
            shutil.copytree(ROOT / name, self.root / name, ignore=shutil.ignore_patterns('__pycache__'))
        for name in ('release.json', 'LICENSE', 'NOTICE', 'CONTRIBUTING.md', 'THIRD-PARTY-NOTICES.md'):
            shutil.copy2(ROOT / name, self.root / name)
        self.invoke('scripts/prepare_release.py', '--tag', 'v0.16.8', check=True)
        self.legal = json.loads(self.invoke('scripts/build_notices.py', check=True).stdout)
        import base64
        self.state = {'private': False, 'calls': [], 'assets': {p.name: base64.b64encode(p.read_bytes()).decode() for p in (self.root / 'dist').iterdir() if not p.name.startswith('mm-legal-')}}
        self.state_path = self.root / 'fake-state.json'
        binary = self.root / 'bin'; binary.mkdir()
        (binary / 'gh').write_text(FAKE_GH); (binary / 'gh').chmod(0o755)
        (binary / 'git').write_text('#!/bin/sh\n[ "$1 $2" = "rev-parse HEAD" ] || exit 1\nprintf "%s\\n" 1111111111111111111111111111111111111111\n')
        (binary / 'git').chmod(0o755)
        self.env = dict(os.environ, PATH=str(binary) + os.pathsep + os.environ['PATH'], MM_PUBLICATION_TEST_STATE=str(self.state_path), GITHUB_REPOSITORY='bradthomasbrown/Mercenary-Moderators', GITHUB_RUN_ID='123')

    def invoke(self, *args, **kwargs):
        return subprocess.run([sys.executable, *args], cwd=self.root, text=True, capture_output=True, **kwargs)

    def sync(self):
        self.state_path.write_text(json.dumps(self.state))
        result = self.invoke('scripts/sync_publication_notices.py', env=self.env)
        self.state = json.loads(self.state_path.read_text())
        return result

    def test_public_release_preserves_installer_and_updates_notices(self):
        original = dict(self.state['assets'])
        result = self.sync()
        self.assertEqual(result.returncode, 0, result.stderr)
        for name, value in original.items(): self.assertEqual(self.state['assets'][name], value)
        self.assertIn(self.legal['filename'], self.state['assets'])
        self.assertFalse(self.state['record']['repositoryPrivate'])
        self.assertTrue(self.state['record']['installerUnchanged'])
        self.assertIn('PolyForm Shield', self.state['body'])

    def test_corrupt_existing_installer_stops_before_mutation(self):
        self.state['assets']['mm-user-0.16.8.zip'] = 'YmFk'
        result = self.sync()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Existing release asset mismatch', result.stderr)
        self.assertFalse(any(call[:2] in (['release', 'upload'], ['release', 'edit']) for call in self.state['calls']))
        self.assertNotIn('record', self.state)

    def test_existing_bad_legal_asset_is_not_replaced(self):
        self.state['assets'][self.legal['filename']] = 'YmFk'
        result = self.sync()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('Legal-notices asset mismatch', result.stderr)
        self.assertFalse(any(call[:2] in (['release', 'upload'], ['release', 'edit']) for call in self.state['calls']))

    def test_private_retry_reuses_verified_legal_asset(self):
        import base64
        self.state['private'] = True
        self.state['assets'][self.legal['filename']] = base64.b64encode((self.root / 'dist' / self.legal['filename']).read_bytes()).decode()
        result = self.sync()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.state['record']['repositoryPrivate'])
        self.assertFalse(any(call[:2] == ['release', 'upload'] for call in self.state['calls']))

if __name__ == '__main__': unittest.main()
