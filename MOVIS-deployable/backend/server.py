"""Run with python server.py --help. Local capstone server; use HTTPS for deployment."""
import argparse
import csv
import io
import json
import logging
import sqlite3
import threading
import time
from pathlib import Path
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from service import Service, Error

class Handler(BaseHTTPRequestHandler):
    service = None
    attempts = {}
    attempt_lock = threading.Lock()

    def send(self, status, value, mime='application/json'):
        body = json.dumps(value).encode() if mime == 'application/json' else value.encode()
        self.send_response(status)
        self.send_header('Content-Type', mime + '; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.end_headers()
        self.wfile.write(body)

    def handle_request(self):
        try:
            path = urlparse(self.path)
            if self.command == 'GET' and path.path in ['/', '/index.html', '/dashboard.js', '/styles.css', '/favicon.svg']:
                name = 'index.html' if path.path == '/' else path.path[1:]
                mime = {'index.html':'text/html','dashboard.js':'text/javascript','styles.css':'text/css','favicon.svg':'image/svg+xml'}[name]
                return self.send(200, (Path(__file__).parent.parent/'web'/name).read_text(encoding='utf-8'),mime)
            if path.path == '/health' and self.command == 'GET':
                return self.send(200, {'status':'ok','mode':self.service.mode})
            data = {}
            if self.command == 'POST':
                length = int(self.headers.get('Content-Length','0'))
                if length < 1 or length > 9*1024*1024:
                    raise Error('Invalid request size',413)
                data = json.loads(self.rfile.read(length))
                if not isinstance(data,dict):
                    raise Error('Expected a JSON object')
            if path.path == '/login' and self.command == 'POST':
                address = self.client_address[0]
                with self.attempt_lock:
                    recent = [t for t in self.attempts.get(address,[]) if time.time()-t < 60]
                    if len(recent) >= 10:
                        raise Error('Too many sign-in attempts. Wait one minute.',429)
                    self.attempts[address] = recent + [time.time()]
                return self.send(200,self.service.login(data))
            user = self.service.auth(self.headers.get('Authorization','').removeprefix('Bearer '))
            if self.command == 'GET':
                if path.path == '/session':
                    return self.send(200, user)
                if path.path == '/inventory':
                    return self.send(200,self.service.inventory())
                if path.path.startswith('/reports/'):
                    rows = self.service.report(path.path.split('/')[-1])
                    if parse_qs(path.query).get('format') == ['csv']:
                        output = io.StringIO()
                        if rows:
                            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
                            writer.writeheader()
                            # Prevent spreadsheet formulas when exporting user-provided text.
                            writer.writerows({k: ("'"+v if isinstance(v,str) and v.startswith(('=','+','-','@','\t','\r')) else v) for k,v in r.items()} for r in rows)
                        return self.send(200,output.getvalue(),'text/csv')
                    return self.send(200,{'rows':rows})
            if self.command == 'POST':
                actions = {'/catalog':self.service.catalog,'/users':self.service.create_user,'/scans':self.service.scan,'/scan-additions':self.service.add_scan,'/manual-adjustments':self.service.manual_adjust,'/adjustments':self.service.adjust,'/returns':self.service.create_return}
                if path.path == '/account/security':
                    return self.send(200,self.service.account_security(user,data))
                if path.path in actions:
                    return self.send(200,actions[path.path](user,data))
                if path.path.startswith('/returns/'):
                    return self.send(200,self.service.transition(user,int(path.path.split('/')[-1]),data))
                if path.path == '/logout':
                    with self.service.connection() as con:
                        con.execute('DELETE FROM sessions WHERE token=?', (self.headers.get('Authorization','').removeprefix('Bearer '),))
                    return self.send(200,{'message':'Signed out'})
            raise Error('Endpoint not found',404)
        except Error as exc:
            self.send(exc.status, {'error':str(exc)})
        except (ValueError, TypeError, KeyError):
            self.send(400, {'error':'Invalid request fields'})
        except sqlite3.IntegrityError:
            self.send(409, {'error':'Duplicate entry or invalid item/location reference'})
        except Exception:
            logging.exception('Request failed')
            self.send(500, {'error':'Server could not complete the request'})

    do_GET = handle_request
    do_POST = handle_request

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--db',default='movis.db')
    parser.add_argument('--host',default='127.0.0.1')
    parser.add_argument('--port',type=int,default=8080)
    parser.add_argument('--mode',choices=['demo','yolo'],default='demo')
    parser.add_argument('--weights')
    parser.add_argument('--init',action='store_true')
    parser.add_argument('--seed-demo',action='store_true')
    args = parser.parse_args()
    service = Service(args.db,args.mode,args.weights)
    if args.init:
        from getpass import getpass
        service.bootstrap(input('Administrator username: '),getpass('Administrator password (10+ characters): '),args.seed_demo)
        print('Database initialized. Run without --init to start the server.')
        return
    Handler.service = service
    print(f'MOVIS {args.mode.upper()} server at http://{args.host}:{args.port}. Demo detections are synthetic.')
    ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()

if __name__ == '__main__':
    main()
