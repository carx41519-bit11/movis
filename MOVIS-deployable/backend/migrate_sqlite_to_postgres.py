"""Copy a consistent SQLite snapshot into an EMPTY PostgreSQL database.
Secrets come from DATABASE_URL. Sessions are deliberately not migrated.
"""
import argparse
import os
import sqlite3
from pathlib import Path
from service import Service
import database

TABLES=['users','items','locations','stock','scans','adjustments','returns','return_events','movements','scan_commits']

def migrate(source,target):
    if not database.is_postgres(target):raise ValueError('Target must be PostgreSQL')
    path=Path(source).resolve()
    if not path.is_file():raise ValueError('Source database does not exist')
    original=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
    snapshot=sqlite3.connect(':memory:');snapshot.row_factory=sqlite3.Row
    try:
        original.backup(snapshot)
        service=Service(target)
        counts={}
        with service.connection() as con:
            con.execute('BEGIN IMMEDIATE')
            for table in TABLES+['sessions']:
                if con.execute('SELECT count(*) FROM '+table).fetchone()[0]:
                    raise ValueError('Target must be empty; nothing was migrated')
            for table in TABLES:
                rows=snapshot.execute('SELECT * FROM '+table).fetchall()
                for row in rows:
                    columns=','.join(row.keys());marks=','.join('?' for _ in row)
                    con.execute('INSERT INTO '+table+'('+columns+') VALUES('+marks+')',tuple(row))
                if table in database.IDENTITY_TABLES:
                    con.execute("SELECT setval(pg_get_serial_sequence(?, 'id'), COALESCE(MAX(id),1), COUNT(*)>0) FROM "+table,(table,))
                counts[table]=len(rows)
        return counts
    finally:
        original.close();snapshot.close()

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--source',required=True)
    args=parser.parse_args()
    url=os.environ.get('DATABASE_URL')
    if not url:raise SystemExit('Set DATABASE_URL privately before running migration')
    try:
        print('Migrated row counts:',migrate(args.source,url))
        print('Users must sign in again. Source SQLite data was preserved.')
    except Exception:
        raise SystemExit('Migration failed; target transaction was rolled back. Check database access and ensure the target is empty.')
if __name__=='__main__':main()
