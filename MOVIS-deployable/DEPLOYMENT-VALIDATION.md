# Deployment validation — 0.3.0

Completed locally:
- 32 SQLite/domain/HTTP/WSGI tests passed.
- 20 inherited stock/scan/return/concurrency tests passed against an isolated
  PostgreSQL 18.6 cluster on loopback, with separate disposable schemas.
- 2 additional PostgreSQL checks passed: transactional SQLite import preserves
  data/login and resets sequences; hosted factory/session survive restart.
- Android Java source compiled with Java 17 language level against Android API.
- Browser tests passed for login persistence on refresh, logout and session expiry.
- Render, Compose and GitHub workflow YAML files parsed successfully.

Limitations:
- Android Gradle packaging failed because this execution environment cannot access
  required SDK files. No NEW 0.3.0 APK is supplied. Existing MOVIS APKs are 0.2.0.
  Build 0.3.0 in Android Studio or use the GitHub Actions debug APK artifact.
- Docker is not installed in this environment; the image was not built locally.
  The GitHub workflow includes an image-build check; it has not run in your account.
- No Render/Neon resources have been provisioned and no online URL exists yet.
- Phone installation, camera, HTTPS networking and online persistence need hosted
  and actual-device testing following deploy/ONLINE-DEPLOYMENT.md.
- YOLO mode has no trained warehouse model and no measured accuracy claims.
