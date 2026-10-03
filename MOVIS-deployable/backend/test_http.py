import json
import tempfile
import threading
import unittest
import urllib.request
import urllib.error
from pathlib import Path
from http.server import ThreadingHTTPServer
from server import Handler
from service import Service

class HttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory()
        service=Service(Path(cls.temp.name)/'http.db')
        service.bootstrap('admin','test-password-http',True)
        class QuietHandler(Handler):
            def log_message(self,*args):pass
        QuietHandler.service=service
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),QuietHandler)
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.base='http://127.0.0.1:'+str(cls.server.server_port)
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.temp.cleanup()
    def request(self,path,data=None,token=None):
        headers={}
        if token:headers['Authorization']='Bearer '+token
        if data is not None:headers['Content-Type']='application/json'
        request=urllib.request.Request(self.base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers)
        try:
            with urllib.request.urlopen(request,timeout=5) as response:return response.status,response.read().decode()
        except urllib.error.HTTPError as response:return response.code,response.read().decode()
    def login(self):
        code,body=self.request('/login',{'username':'admin','password':'test-password-http'})
        self.assertEqual(code,200);return json.loads(body)['token']
    def test_health_and_unauthorized_inventory(self):
        self.assertEqual(self.request('/health')[0],200)
        self.assertEqual(self.request('/inventory')[0],401)
    def test_web_dashboard_assets_and_path_restriction(self):
        for path,marker in [('/', 'Inventory at a glance'),('/dashboard.js','function renderInventory'),('/styles.css', '.sidebar'),('/favicon.svg','<svg')]:
            code,body=self.request(path)
            self.assertEqual(code,200)
            self.assertIn(marker,body)
        self.assertNotEqual(self.request('/../backend/schema.sql')[0],200)
    def test_login_inventory_csv_and_logout(self):
        token=self.login()
        code,body=self.request('/inventory',token=token);self.assertEqual(code,200);self.assertEqual(len(json.loads(body)['stock']),2)
        code,body=self.request('/reports/inventory?format=csv',token=token);self.assertEqual(code,200);self.assertIn('quantity',body)
        self.assertEqual(self.request('/logout',{},token)[0],200)
        self.assertEqual(self.request('/inventory',token=token)[0],401)
    def test_bad_payload_and_conflict_status(self):
        token=self.login()
        self.assertEqual(self.request('/returns',{'quantity':-1},token)[0],400)
        payload={'kind':'location','name':'Duplicate location'}
        self.assertEqual(self.request('/catalog',payload,token)[0],200)
        self.assertEqual(self.request('/catalog',payload,token)[0],409)

    def test_two_clients_share_scans_edits_and_returns(self):
        # Separate sessions exercise the API used by Android and the dashboard.
        import base64
        import io
        from PIL import Image
        android=self.login();web=self.login()
        def post(path,payload,token=android):
            status,body=self.request(path,payload,token)
            self.assertEqual(status,200,body)
            return json.loads(body)
        item=post('/catalog',{'kind':'item','sku':'HTTP-SHARED','name':'Shared test item','model_class':'shared_test'})['id']
        location=post('/catalog',{'kind':'location','name':'Shared test shelf'})['id']
        post('/catalog',{'kind':'stock','item_id':item,'location_id':location})
        def stock(token):
            status,body=self.request('/inventory',token=token)
            self.assertEqual(status,200)
            return next(r for r in json.loads(body)['stock'] if r['item_id']==item and r['location_id']==location)
        image=io.BytesIO();Image.new('RGB',(32,32),'white').save(image,format='JPEG')
        scan=post('/scans',{'location_id':location,'image':base64.b64encode(image.getvalue()).decode()})
        self.assertEqual(stock(web)['quantity'],0) # Scanning alone cannot change stock.
        payload={'scan_id':scan['id'],'items':[{'item_id':item,'quantity':3}],'reason':'Test receipt','confirmed':True,'request_key':'http-shared-add'}
        post('/scan-additions',payload);post('/scan-additions',payload)
        self.assertEqual(stock(web)['quantity'],3)
        post('/manual-adjustments',{'item_id':item,'location_id':location,'quantity':5,'expected_version':stock(web)['version'],'reason':'Test recount','confirmed':True,'request_key':'http-shared-edit'},web)
        self.assertEqual(stock(android)['quantity'],5)
        ret=post('/returns',{'item_id':item,'location_id':location,'quantity':2,'reason':'Test return','request_key':'http-shared-return'})
        self.assertEqual(stock(web)['quantity'],5)
        post('/returns/'+str(ret['id']),{'status':'accepted'},web)
        payload={'status':'returned to available stock','confirmed_suitable':True}
        post('/returns/'+str(ret['id']),payload,web);post('/returns/'+str(ret['id']),payload,web)
        self.assertEqual(stock(android)['quantity'],7)

if __name__=='__main__':unittest.main()
