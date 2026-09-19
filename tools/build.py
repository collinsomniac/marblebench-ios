#!/usr/bin/env python3
"""Deterministic, dependency-free PortableWeb v0.1 and standalone HTML builder."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZIP_STORED
import json, re, sys, subprocess
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist'
SITE = ROOT / 'site'
OUT.mkdir(exist_ok=True)
html = (SITE / 'index.html').read_text()
js = (SITE / 'main.js').read_text()
subprocess.run(['node', '--check', str(SITE/'main.js')], check=True)
subprocess.run(['node', '--check', str(SITE/'sw.js')], check=True)
assert html.count('<script src="./main.js" defer></script>') == 1
standalone = html.replace('<script src="./main.js" defer></script>', '<script>\n'+js.replace('</script','<\\/script')+'\n</script>')
# The real PortableWeb specification is https://github.com/portableweb/spec (draft 0.1).
manifest = {
    'spec_version':'0.1', 'id':'io.github.collinsomniac.marblebench-ios',
    'version':'0.2.0', 'title':'Marble Garden',
    'description':'An offline kinetic marble garden and mobile physics performance test.',
    'entry':'index.html', 'content_type':'game',
    'permissions':{'network':False,'storage':'none','fullscreen':True},
    'rights':{'license':'MIT'}
}
(OUT/'marble-garden.html').write_text(standalone)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
pweb = OUT/'marble-garden.pweb'
with ZipFile(pweb,'w',allowZip64=True) as z:
    # Format requires mimetype as the FIRST, STORED (uncompressed) ZIP entry.
    z.writestr('mimetype','application/vnd.portableweb+zip',compress_type=ZIP_STORED)
    z.writestr('manifest.json',json.dumps(manifest,indent=2)+'\n',compress_type=ZIP_DEFLATED)
    z.writestr('index.html',standalone,compress_type=ZIP_DEFLATED)
    z.writestr('source/main.js',js,compress_type=ZIP_DEFLATED)
    z.writestr('source/index.html',html,compress_type=ZIP_DEFLATED)
    z.writestr('source/sw.js',(SITE/'sw.js').read_text(),compress_type=ZIP_DEFLATED)
    z.writestr('source/README.md',(ROOT/'README.md').read_text(),compress_type=ZIP_DEFLATED)
with ZipFile(pweb) as z:
    assert z.namelist()[0] == 'mimetype'
    assert z.getinfo('mimetype').compress_type == ZIP_STORED
    assert z.read('mimetype') == b'application/vnd.portableweb+zip'
    assert json.loads(z.read('manifest.json'))['entry'] == 'index.html'
    assert b'<script>\n' in z.read('index.html')
print('BUILD OK')
for p in (OUT/'marble-garden.html',pweb):print(p.name,p.stat().st_size,'bytes')
