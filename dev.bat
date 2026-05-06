@echo off
cd /d "%~dp0"
echo Starting Vite + local API (uses npm.cmd; avoids PowerShell npm.ps1 policy issues).
call npm.cmd run dev
if errorlevel 1 pause
