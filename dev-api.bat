@echo off
cd /d "%~dp0"
echo Starting local API only. Port comes from DEV_API_PORT in .env or defaults to 8788 — see URL printed below.
call npm.cmd run dev:api
if errorlevel 1 pause
