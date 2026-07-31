@echo off
setlocal
cd /d "%~dp0"
for /f "delims=" %%N in ('dir /b /s /o-d "%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\*\bin\node.exe" 2^>nul') do (
  set "NODE=%%N"
  goto :found
)
echo Node.js олдсонгүй. Codex-оо нээгээд дахин ажиллуулна уу.
pause
exit /b 1
:found
start "" http://127.0.0.1:4330/
"%NODE%" server.js
