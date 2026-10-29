#!/usr/bin/env python3
"""manifest.py: hash every text knowledge source into the pedia manifest.
Stdlib only. Skips binaries, vendored deps, VCS dirs, huge blobs.
Usage: python manifest.py  (run from workspace root)
"""
import hashlib
import json
import os

ROOTS = {
    'book': 'lab-depot/compression-box-load/training/book',
    'psi': 'psi',
    'spl-src': 'SlidPhiLabs/src',
    'spl-pkgs': 'SlidPhiLabs/packages',
    'spl-docs': 'SlidPhiLabs/docs',
    'spl-exp': 'SlidPhiLabs/experiments',
    'cuni': 'cuni-repo',
    'conductor-src': 'conductor/src',
    'biblecodec': 'lab-depot/repos/AgentBibleCodec',
    'training': 'lab-depot/compression-box-load/training',
}
SKIP_DIRS = {'node_modules', '.git', 'vendor', '__pycache__',
             'chrome-profile', '.slidphi'}
SKIP_EXT = {'.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2',
            '.ttf', '.eot', '.mp4', '.zip', '.gz', '.exe', '.bin', '.pcc',
            '.cae', '.pdf', '.sqlite', '.db'}
MAX_BYTES = 2_000_000


def main():
    recs = []
    for role, root in ROOTS.items():
        for dp, dn, fn in os.walk(root):
            dn[:] = [d for d in dn if d not in SKIP_DIRS]
            for f in fn:
                p = os.path.join(dp, f)
                if os.path.splitext(f)[1].lower() in SKIP_EXT:
                    continue
                try:
                    with open(p, 'rb') as fh:
                        b = fh.read()
                except OSError:
                    continue
                if len(b) > MAX_BYTES:
                    continue
                try:
                    b.decode('utf-8')
                except UnicodeDecodeError:
                    continue
                recs.append({'role': role, 'path': p.replace(os.sep, '/'),
                             'bytes': len(b),
                             'sha256': hashlib.sha256(b).hexdigest()})
    out = os.path.join('SlidPhiLabs', 'docs', 'slidphiclepedia',
                       'corpora', 'manifest.jsonl')
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fh:
        for r in recs:
            fh.write(json.dumps(r) + '\n')
    total = sum(r['bytes'] for r in recs)
    print('MANIFEST-OK records=%d bytes=%d' % (len(recs), total))


if __name__ == '__main__':
    main()
