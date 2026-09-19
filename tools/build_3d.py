#!/usr/bin/env python3
"""Dependency-free release packaging. Keep GitHub Pages source split into normal files."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED,ZIP_STORED
import json,re
ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/'site'/'3d';OUT=ROOT/'dist';OUT.mkdir(exist_ok=True)
html=(SRC/'index.html').read_text()
parts=[]
for name in ('physics.js','render.js','main.js'):
    code=(SRC/name).read_text()
    code=re.sub(r'^import [^\n]+;\s*$', '', code, flags=re.M)
    code=re.sub(r'^export (?=(?:const|function|class|async))','',code,flags=re.M)
    parts.append(f'/* --- {name} --- */\n'+code)
inline='\n'.join(parts).replace('</script','<\\/script')
html=html.replace('<script type="module" src="./main.js"></script>', '<script type="module">\n'+inline+'\n</script>')
assert '<script type="module" src=' not in html
single=OUT/'marblebench-3d.html';single.write_text(html)
manifest={'spec_version':'0.1','id':'io.github.collinsomniac.marblebench-3d','version':'0.3.0','title':'MarbleBench 3D kinetic garden','entry':'index.html','content_type':'simulation','permissions':{'network':False,'storage':'isolated'}}
package=OUT/'marblebench-3d.pweb'
with ZipFile(package,'w') as z:
    z.writestr('mimetype','application/vnd.portableweb+zip',compress_type=ZIP_STORED)
    z.writestr('manifest.json',json.dumps(manifest,indent=2),compress_type=ZIP_DEFLATED)
    z.write(single,'index.html',compress_type=ZIP_DEFLATED)
    for name in ('physics.js','render.js','main.js'):
        z.write(SRC/name,'source/'+name,compress_type=ZIP_DEFLATED)
print('PACKAGED',single,single.stat().st_size,'bytes',package,package.stat().st_size,'bytes')
