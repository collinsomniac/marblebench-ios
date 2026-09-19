import json, subprocess, time, unittest
from pathlib import Path
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
ROOT = Path(__file__).resolve().parent.parent
PORT = 18765
class MarbleGardenSmoke(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.server=subprocess.Popen(['python3','-m','http.server',str(PORT),'--bind','127.0.0.1','--directory',str(ROOT/'site')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  for _ in range(30):
   try:
    urlopen(f'http://127.0.0.1:{PORT}/',timeout=.2);break
   except Exception: time.sleep(.1)
  cls.pw=sync_playwright().start();cls.browser=cls.pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 @classmethod
 def tearDownClass(cls):cls.browser.close();cls.pw.stop();cls.server.terminate();cls.server.wait(timeout=5)
 def test_mobile_play_and_controls(self):
  context=self.browser.new_context(viewport={'width':393,'height':852},device_scale_factor=3,is_mobile=True,has_touch=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.set_content((ROOT/'dist'/'marble-garden.html').read_text(), wait_until='load')
  page.wait_for_function('!!window.__MARBLE_GARDEN__',timeout=15000)
  page.wait_for_timeout(1100)
  self.assertEqual(errors,[])
  self.assertEqual(page.locator('#loader').get_attribute('class'),'done')
  self.assertEqual(page.evaluate('window.__MARBLE_GARDEN__.state.balls.length'),70)
  page.locator('#spawn').click();self.assertEqual(page.evaluate('window.__MARBLE_GARDEN__.state.balls.length'),82)
  page.locator('#pause').click();self.assertEqual(page.locator('#pause').inner_text(),'Resume')
  page.locator('#pause').click();self.assertEqual(page.locator('#pause').inner_text(),'Pause')
  page.locator('#bench').click();self.assertIn('120-step CPU bench',page.evaluate('window.__MARBLE_GARDEN__.state.benchText'))
  page.screenshot(path=str(ROOT/'dist'/'marble-garden-preview.png'),full_page=True)
  print('BROWSER SMOKE PASS: mobile viewport, loader, 70 balls, spawn/pause/bench, no JS page errors')
  context.close()
 def test_scripts_disabled_explains_preview_limit(self):
  context=self.browser.new_context(viewport={'width':393,'height':852},java_script_enabled=False)
  page=context.new_page();page.set_content((ROOT/'dist'/'marble-garden.html').read_text(),wait_until='load')
  self.assertIn('preview needs JavaScript',page.locator('#phase').inner_text())
  self.assertIn('Not started',page.locator('#progress-text').inner_text())
  context.close()
  print('NO-SCRIPT PREVIEW PASS: explains that browser execution is required')
 def test_gpu_adapter_never_resolves_but_game_starts(self):
  context=self.browser.new_context(viewport={'width':393,'height':852})
  context.add_init_script("Object.defineProperty(navigator, 'gpu', {configurable:true,value:{requestAdapter:()=>new Promise(()=>{})}})")
  page=context.new_page();page.goto('about:blank');page.set_content((ROOT/'dist'/'marble-garden.html').read_text(),wait_until='load')
  page.wait_for_function('!!window.__MARBLE_GARDEN__',timeout=10000)
  page.wait_for_function("document.querySelector('#loader').classList.contains('done')",timeout=10000)
  self.assertEqual(page.evaluate('window.__MARBLE_GARDEN__.state.balls.length'),70)
  page.locator('#spawn').click()
  self.assertEqual(page.evaluate('window.__MARBLE_GARDEN__.state.balls.length'),82)
  context.close()
  print('GPU HANG PASS: optional adapter request cannot block playable Canvas game')
 def test_archive_format(self):
  from zipfile import ZipFile,ZIP_STORED
  z=ZipFile(ROOT/'dist'/'marble-garden.pweb');m=json.loads(z.read('manifest.json'))
  self.assertEqual(z.namelist()[0],'mimetype')
  self.assertEqual(z.getinfo('mimetype').compress_type,ZIP_STORED)
  self.assertEqual(z.read('mimetype'),b'application/vnd.portableweb+zip')
  self.assertIn(m['entry'],z.namelist());self.assertEqual(m['spec_version'],'0.1')
  self.assertNotIn(b'<script src="./main.js" defer></script>',z.read('index.html'))
  print('PACKAGE SMOKE PASS: ZIP mimetype first/STORED, manifest/entry valid, self-contained HTML')
if __name__=='__main__':unittest.main(verbosity=2)
