@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Install Node.js LTS and run this file again.
  pause
  exit /b 1
)

rem LOADIN public Supabase runtime config (publishable values only; no service-role secret here)
set "LOADIN_SUPABASE_URL=https://wnehhzzdpkzwtxaipgdv.supabase.co"
set "LOADIN_SUPABASE_PUBLISHABLE_KEY=sb_publishable_bNvuThgSTbF-zHvyG3avIg_XCdwQ0zH"

start "" http://127.0.0.1:4173/
node scripts\preview-server.mjs
endlocal
