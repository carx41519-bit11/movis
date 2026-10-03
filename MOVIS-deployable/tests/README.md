# Reproducible checks

Run from the extracted application source directory. Never point these tests at production.

1. Install Python requirements: `python -m pip install -r backend/requirements-cloud.txt`.
2. Run `python -m unittest discover -s backend -p "test_*.py"`.
   PostgreSQL checks skip unless MOVIS_TEST_DATABASE_URL points to an isolated disposable PostgreSQL database. Those tests erase their test tables.
3. Install Node.js and Playwright: `npm install --no-save playwright` then `npx playwright install chromium`.
4. In terminal one run `python tests/browser_server.py`. It creates a temporary SQLite database and synthetic image with random test credentials in .work.
5. In terminal two run `node tests/browser_integration.cjs`. On Windows an installed Edge may be used with `$env:BROWSER_CHANNEL='msedge'`.
6. Stop the temporary server after the run. Restart it before each fresh integration run.

The browser check verifies cookie refresh, Android-style API calls, stock synchronization, duplicate prevention, return processing, role restrictions and layout. It does not operate an actual Android device or trained detector. Screenshots are written to .work.
