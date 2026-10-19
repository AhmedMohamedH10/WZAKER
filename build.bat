@echo off
chcp 65001 >nul
title WZAKER Quick Build
cd /d "%~dp0"

if not exist package.json (
  echo package.json not found in: %cd%
  pause & exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Download it from https://nodejs.org then run this file again.
  pause & exit /b 1
)

rem ---- version is read from package.json
for /f %%v in ('node -p "require('./package.json').version"') do set VER=%%v

rem ---- maximum compression is set in package.json ("compression": "maximum") - smaller download, slower build
rem ---- skip code signing lookup (faster, avoids winCodeSign symlink error)
set CSC_IDENTITY_AUTO_DISCOVERY=false

rem ---- mode: 1 = installer | 2 = fast test (no installer)
set MODE=%1
if "%MODE%"=="" (
  echo.
  echo  WZAKER v%VER% - Quick Build
  echo  [1] Installer  ^(WZAKER-Setup-%VER%.exe^)
  echo  [2] Fast test  ^(unpacked folder, much faster^)
  echo.
  choice /c 12 /n /m "Choose 1 or 2: "
  if errorlevel 2 ( set MODE=2 ) else ( set MODE=1 )
)

rem ---- close the running app (and wait) so its files are not locked
echo Closing running WZAKER...
taskkill /f /t /im WZAKER.exe >nul 2>nul
timeout /t 2 /nobreak >nul

rem ---- clean the old unpacked folder; if Windows still refuses (file locked), build into a fresh folder instead
set OUT=dist
if exist "%OUT%\win-unpacked" (
  attrib -r "%OUT%\win-unpacked\*" /s /d >nul 2>nul
  rmdir /s /q "%OUT%\win-unpacked" >nul 2>nul
)
if exist "%OUT%\win-unpacked" (
  set OUT=dist-%RANDOM%
  echo Old dist\win-unpacked is locked. Building into "%OUT%" instead.
  echo ^(You can delete the old dist folder later after restarting Windows.^)
)

rem ---- install dependencies only when needed
if not exist node_modules (
  echo [1/2] Installing dependencies...
  call npm install
  if errorlevel 1 ( echo npm install failed & pause & exit /b 1 )
) else (
  echo [1/2] Dependencies found - skipping npm install
)

echo [2/2] Building (maximum compression, this takes a bit longer)...
if "%MODE%"=="2" (
  call npx electron-builder --dir --config.directories.output=%OUT%
  if errorlevel 1 ( echo Build failed & pause & exit /b 1 )
  if not exist "%OUT%\win-unpacked\WZAKER.exe" ( echo Build failed: WZAKER.exe not found & pause & exit /b 1 )
  echo.
  echo Done. Starting %OUT%\win-unpacked\WZAKER.exe
  start "" "%OUT%\win-unpacked\WZAKER.exe"
  exit /b 0
)

call npx electron-builder --config.directories.output=%OUT%
if errorlevel 1 ( echo Build failed & pause & exit /b 1 )
if not exist "%OUT%\WZAKER-Setup-%VER%.exe" ( echo Build failed: installer not found in %OUT% & pause & exit /b 1 )
echo.
echo Done. Your installer is in the "%OUT%" folder: WZAKER-Setup-%VER%.exe
start "" "%OUT%"
pause
