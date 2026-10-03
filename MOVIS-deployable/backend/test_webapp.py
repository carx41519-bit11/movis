import io
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from service import Service
from webapp import Application, create_app

class CloudTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.db=Path(self.temp.name)/'persistent.db'
        self.service=Service(self.db);self.service.bootstrap('cloudadmin','private-password-2026',True)
        self.app=Application(self.service)
    def tearDown(self):self.temp.cleanup()
    def request(self,path,body=None,token=None):
        raw=json.dumps(body).encode() if body is not None else b'';status=[]
        environ={'REQUEST_METHOD':'POST' if body is not None else 'GET','PATH_INFO':path,'CONTENT_LENGTH':str(len(raw)), 'CONTENT_TYPE':'application/json','wsgi.input':io.BytesIO(raw),'HTTP_AUTHORIZATION':'Bearer '+token if token else ''}
        output=b''.join(self.app(environ,lambda s,h:status.append((s,dict(h)))))
        return int(status[0][0].split()[0]),output,status[0][1]
    def login(self):
        status,body,_=self.request('/login',{'username':'cloudadmin','password':'private-password-2026'});self.assertEqual(status,200);return json.loads(body)['token']
    def test_static_assets_health_and_auth(self):
        for path in ['/','/dashboard.js','/styles.css','/favicon.svg','/health']:self.assertEqual(self.request(path)[0],200)
        self.assertEqual(self.request('/inventory')[0],401)
        self.assertEqual(self.request('/../backend/schema.sql')[0],401)
    def test_write_persists_after_restart_and_logout_revokes(self):
        token=self.login();payload={'item_id':1,'location_id':1,'quantity':15,'expected_version':0,'reason':'Online correction','confirmed':True,'request_key':'cloud-edit'}
        self.assertEqual(self.request('/manual-adjustments',payload,token)[0],200)
        self.app=Application(Service(self.db))
        status,body,_=self.request('/inventory',token=token);self.assertEqual(status,200)
        self.assertEqual(next(s['quantity'] for s in json.loads(body)['stock'] if s['item_id']==1),15)
        self.assertEqual(self.request('/logout',{},token)[0],200);self.assertEqual(self.request('/inventory',token=token)[0],401)
    def test_factory_never_reinitializes_existing_database(self):
        with patch.dict(os.environ,{'MOVIS_DB_PATH':str(self.db),'MOVIS_MODE':'demo','MOVIS_ADMIN_USERNAME':'ignored','MOVIS_ADMIN_PASSWORD':'another-password-2026'}):
            app=create_app()
            with app.service.connection() as con:self.assertEqual(con.execute('SELECT username FROM users').fetchone()[0],'cloudadmin')
    def test_fresh_factory_requires_private_password(self):
        with patch.dict(os.environ,{'MOVIS_DB_PATH':str(Path(self.temp.name)/'fresh.db'),'MOVIS_MODE':'demo','MOVIS_ADMIN_USERNAME':'admin','MOVIS_ADMIN_PASSWORD':'movis-demo-2026'}):
            with self.assertRaises(RuntimeError):create_app()
        with patch.dict(os.environ,{'MOVIS_DB_PATH':str(Path(self.temp.name)/'fresh.db'),'MOVIS_MODE':'demo','MOVIS_ADMIN_USERNAME':'admin','MOVIS_ADMIN_PASSWORD':'brand-new-password-2026'}):
            app=create_app()
            with app.service.connection() as con:self.assertEqual(con.execute('SELECT count(*) FROM items').fetchone()[0],0)
    def test_headers_invalid_quantities_and_stale_conflict(self):
        token=self.login();status,body,headers=self.request('/inventory',token=token)
        self.assertEqual(headers['X-Frame-Options'],'DENY');self.assertIn("script-src 'self'",headers['Content-Security-Policy'])
        payload={'item_id':1,'location_id':1,'quantity':-1,'expected_version':0,'reason':'Correction','confirmed':True,'request_key':'bad'}
        self.assertEqual(self.request('/manual-adjustments',payload,token)[0],400)
        payload.update(quantity=11);self.assertEqual(self.request('/manual-adjustments',payload,token)[0],200)
        payload.update(request_key='stale',quantity=12);self.assertEqual(self.request('/manual-adjustments',payload,token)[0],409)
    def test_login_rate_limit(self):
        for _ in range(10):self.request('/login',{'username':'cloudadmin','password':'bad'})
        self.assertEqual(self.request('/login',{'username':'cloudadmin','password':'bad'})[0],429)

    def test_session_restore_and_expiry(self):
        token=self.login()
        status,body,_=self.request('/session',token=token)
        self.assertEqual(status,200)
        account=json.loads(body)
        self.assertEqual(account['username'],'cloudadmin')
        self.assertEqual(account['role'],'admin')
        self.assertNotIn('password',account)
        with self.service.connection() as con:
            con.execute('UPDATE sessions SET expires=0 WHERE token=?',(token,))
        self.assertEqual(self.request('/session',token=token)[0],401)

if __name__=='__main__':unittest.main()
