@echo off
REM Start the quokka-hud dev environment on Windows.
REM Window placement is done by hand; this only launches things.

REM Move to the project root, based on where this file lives.
cd /d "%~dp0"

REM 1. Vite dev server in its own window.
start "quokka vite" cmd /k npm run dev

REM 2. Give Vite a moment, then open the page in the default browser.
timeout /t 3 /nobreak > nul
start "" http://localhost:1420/

REM 3. Claude Code in its own window.
start "quokka claude" cmd /k claude --continue
