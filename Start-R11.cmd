@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is unavailable. Opening the offline HTML file.
  start "" "%~dp0index.html"
  exit /b
)
start "" "http://127.0.0.1:4311"
node server.mjs
