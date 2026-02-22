@echo off
setlocal

cd /d "%~dp0src\bot"

if not exist ".env" (
  echo [ERROR] src\bot\.env not found.
  echo Copy src\bot\.env.example to src\bot\.env and fill your keys first.
  exit /b 1
)

if not exist "node_modules" (
  echo Installing bot dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

echo Starting ArbiLoop Telegram bot...
call npm start

