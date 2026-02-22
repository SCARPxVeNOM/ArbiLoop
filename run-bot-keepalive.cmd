@echo off
setlocal

set RESTART_DELAY=5

echo ArbiLoop bot keepalive mode.
echo It will restart the bot automatically after exit.
echo Press Ctrl+C to stop this loop.
echo.

:loop
call "%~dp0run-bot-local.cmd"
set EXIT_CODE=%ERRORLEVEL%

echo.
echo Bot exited with code %EXIT_CODE%.
echo Restarting in %RESTART_DELAY% seconds...
timeout /t %RESTART_DELAY% /nobreak >nul
echo.
goto loop

