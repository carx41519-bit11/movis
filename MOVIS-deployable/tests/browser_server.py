import sys, tempfile, secrets, json, io, base64
from pathlib import Path
project=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(project/'backend'))
(project/'.work').mkdir(exist_ok=True)
from service import Service
from webapp import Application
from wsgiref.simple_server import make_server, WSGIRequestHandler
from PIL import Image
class Quiet(WSGIRequestHandler):
    def log_message(self,*args):pass
with tempfile.TemporaryDirectory() as temp:
    service=Service(Path(temp)/'browser.db')
    password=secrets.token_urlsafe(20);service.bootstrap('defense-admin',password,True)
    accounts={'admin':{'username':'defense-admin','password':password}}
    user={'id':1,'role':'admin'}
    for role in ('operator','viewer'):
        accounts[role]={'username':'defense-'+role,'password':secrets.token_urlsafe(20)}
        service.create_user(user,{**accounts[role],'role':role})
    photo=io.BytesIO();Image.new('RGB',(100,100),'white').save(photo,format='JPEG')
    (project/'.work/browser-fixture.json').write_text(json.dumps({'accounts':accounts,'image':base64.b64encode(photo.getvalue()).decode()}))
    print('Isolated WSGI test server on http://127.0.0.1:8088 (synthetic scans)',flush=True)
    make_server('127.0.0.1',8088,Application(service),handler_class=Quiet).serve_forever()
