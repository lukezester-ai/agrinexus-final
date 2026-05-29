@echo off
REM Opens cmd in the monorepo root — see docs/CANONICAL-WORKSPACE-BG.md
set "ROOT1=C:\Users\expre\OneDrive\Desktop\project\agrinexus-final-main"
set "ROOT2=C:\Users\expre\Academy"
if exist "%ROOT1%\.git" (
  cd /d "%ROOT1%"
) else if exist "%ROOT2%\.git" (
  cd /d "%ROOT2%"
) else if exist "%~dp0.git" (
  cd /d "%~dp0"
) else (
  echo Missing repo. Clone or open from repo root — see docs\CANONICAL-WORKSPACE-BG.md
  pause
  exit /b 1
)
title AI Agri Academy
cmd /k
