# MOVIS 0.5.0

Android photographs inventory, users correct detections and explicitly confirm incoming additions or complete-location reconciliation. The website monitors shared stock, returns and histories; it has no photo scanner.

The cloud URL is https://movis-1fxf.onrender.com. Updated code is local until uploaded and deployed. Demo detections are synthetic. Real YOLO training and device validation are still required.

Start with [defense/START-HERE.md](defense/START-HERE.md), then [deployment](defense/DEPLOYMENT.md), [user guide](defense/USER-GUIDE.md), [architecture](defense/ARCHITECTURE.md), [audit](defense/AUDIT.md) and [evaluation](defense/EVALUATION.md).

Python backend uses PostgreSQL in hosting and SQLite for disposable development. Android supports Android 8/API26 onward. Browser sessions use HttpOnly cookies; Android uses bearer sessions. Account creation requires a 12–128 character password. Preserve existing database and credentials.

For local development: install backend/requirements-cloud.txt and run `python backend/server.py --db demo.db --host 127.0.0.1 --port 8080 --mode demo`. A fresh database prompts for administrator credentials. Local development is optional and is not the deployed phone endpoint.

Run the checks in tests/README.md. The defense kit includes signed test APK, source ZIP and evidence limits. The supplied APK is debug signed for direct testing; use a private release signing key for store distribution.
