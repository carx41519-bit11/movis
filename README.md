# MOVIS 0.3.0 — online deployment package

Start with **deploy/ONLINE-DEPLOYMENT.md**. Upload this repository root to GitHub
and use **render.yaml** to deploy the website and Python API together on Render,
with **DATABASE_URL** pointing to Neon PostgreSQL. No live deployment is included.

The backend supports PostgreSQL for hosting and SQLite for existing local use.
Android 0.3.0 accepts your hosted HTTPS address; release builds require HTTPS.
Demo scanning remains synthetic. Warehouse-specific trained YOLO weights are not supplied.

GitHub checks cover PostgreSQL/SQLite and Android builds. Private databases,
credentials, keys and local build files must stay out of the repository.
For details, data migration and verification, follow the online deployment guide.

The older local setup notes below describe the prototype; use the online guide
for hosted deployment and the current Gradle files for Android build versions.

# MOVIS — Android warehouse inventory capstone

Current workflow: take/select a still photo → Analyze photo → edit/select quantities → Add to inventory or Discard. Inventory also offers manual total editing in Android and web. PHOTO-WORKFLOW.md supersedes the initial scanner reconciliation flow described below.

MOVIS combines a native Android photo scanner with inventory records, verified stock adjustments, and return monitoring. This package contains a functioning Python backend, Android application source, tests, database schema, system design, and a guide for training your own YOLO model later.

The package now also includes a browser inventory monitor. Open the server's root address (for example `http://localhost:8080`) and sign in using your MOVIS account. It reads the same database as Android and refreshes every 15 seconds. See `web/README.md` for dashboard setup and features.

**Current status:** demo scanning is synthetic. Real YOLO inference is an optional adapter without tested warehouse weights. Follow deploy/ONLINE-DEPLOYMENT.md for current packaging and hosted setup; phone installation, camera and network behavior require device testing.

## Server recommendation

For one warehouse and a student capstone, start with a dedicated laptop or desktop on the same Wi-Fi as the Android phones. It holds the database and runs inference. The phone captures and uploads photos; it does not need to run YOLO locally. A proposed starting machine is a modern four-core computer with 8 GB RAM and SSD storage. These are planning assumptions, not measured performance requirements; test the selected model on your actual hardware.

A local server avoids hosting costs and can work without internet after dependencies and weights are installed. The computer must remain awake, phones must reach it on Wi-Fi, and uploads require a connection. There is no offline synchronization in this prototype. If access from outside the warehouse becomes necessary, move to an HTTPS server and consider PostgreSQL, backups, and a production application server. Do not expose this development HTTP server directly to the internet.

## Start the backend

Install Python 3.11 or newer. In a terminal inside `backend`:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe server.py --db demo.db --init --seed-demo
```

The initializer asks you to choose an administrator username and password. There is no built-in password. Start it:

```powershell
.\.venv\Scripts\python.exe server.py --db demo.db --host 0.0.0.0 --mode demo
```

On a real phone, enter `http://YOUR_COMPUTER_LOCAL_IP:8080`. On the standard Android emulator, enter `http://10.0.2.2:8080`. Keep both devices on the same trusted Wi-Fi. If the connection is blocked, allow the Python server through Windows Firewall on the private network only; the project does not change firewall settings. Check `http://YOUR_COMPUTER_LOCAL_IP:8080/health` in a browser.

For real inventory later, initialize a separate database without synthetic items:

```powershell
.\.venv\Scripts\python.exe server.py --db real.db --init
```

Create your actual items, locations, and zero-stock registrations from the Android Manage screen. Once you have trained and tested weights, install `ultralytics` and follow `training/README.md` to start YOLO mode. Do not use synthetic scans to reconcile operational stock.

## Open and build the Android app

1. Install Android Studio and open the `android` folder as a project.
2. Install Android SDK Platform 35 and its build tools. Select JDK 17 for Gradle.
3. Use the Gradle wrapper and Android Gradle Plugin versions already configured in this project; sync in Android Studio.
4. Sync the project, then run it on an emulator or Android 8.0+ phone.
5. To create an installable debug package, use Android Studio's Build APK action or `gradlew.bat assembleDebug` after generating the wrapper. The result is `app/build/outputs/apk/debug/app-debug.apk`.

The debug build permits HTTP for the local prototype. Release builds require HTTPS. The app delegates capture to the device camera and uses Android's document picker for existing images. It sends a resized JPEG to the server and draws normalized detection boxes over that same image. A session is kept in memory; reopening the app requires sign-in. App process termination discards uncommitted photo results; take a new scan after signing in.

## Main workflows

- **Photo entry:** choose a shelf/bin → capture/select photo → analyze → select/edit quantities → give a reason → confirm Add to inventory or Discard.
- **Manual edit:** Inventory → Edit quantity → corrected total and reason → Save.
- **Return:** record item/quantity/reason/destination → pending inspection → accepted or damaged → explicitly confirm suitability before moving accepted items to available stock. Damaged returns cannot be restocked.
- **Administration:** create/edit item class mappings, create locations, register zero-stock records, and create administrator/operator/viewer accounts.
- **Reporting:** view inventory, scans, adjustments, returns, status histories, and stock movements. Share CSV text using Android's share sheet, or download CSV from the authenticated API.

Photo entry adds multiple selected items together and clears the scan after success. The same scan cannot be added twice.

## Run checks

```powershell
cd backend
python -m unittest -v
```

See `DESIGN.md` for architecture, database relationships, pseudocode, phases, and evaluation checklist. See `VALIDATION.md` for the actual verification performed and remaining checks.

## Files

- `android/`: native Android project (Java and Android SDK widgets; no third-party runtime UI dependency).
- `backend/`: authenticated HTTP API, SQLite transactions, scanner adapter, tests, and SQL schema.
- `web/`: responsive browser dashboard for available stock, locations, returns, and adjustment/movement history.
- `training/`: future training script and dataset example.
- `DESIGN.md`: source requirement mapping and implementation design.
- `VALIDATION.md`: measured development checks and remaining device checks.

Official setup references: [Android Gradle Plugin compatibility](https://developer.android.com/build/releases/about-agp), [Gradle 8.9](https://docs.gradle.org/8.9/release-notes.html), and [Ultralytics Python usage](https://docs.ultralytics.com/usage/python/).
