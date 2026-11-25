const fs=require('node:fs'),path=require('node:path');
const out=path.resolve(process.argv[2]||'dist/taskbar-probe/Xunjian-Taskbar-Probe.cmd');
const body=fs.readFileSync(path.join(__dirname,'taskbar-probe.ps1'),'utf8');
const header=`@echo off
setlocal
chcp 65001 >nul
title Xunjian Taskbar Diagnostic
set "XUNJIAN_TASKBAR_PROBE_SELF=%~f0"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$t=[IO.File]::ReadAllText($env:XUNJIAN_TASKBAR_PROBE_SELF); $body=($t -split '(?m)^# XUNJIAN_POWERSHELL_START\\r?$',2)[1]; & ([ScriptBlock]::Create($body))"
set "probe_exit=%ERRORLEVEL%"
if not "%XUNJIAN_TASKBAR_PROBE_AUTOMATIC%"=="1" pause
exit /b %probe_exit%
# XUNJIAN_POWERSHELL_START
`;
fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,(header+body).replace(/\r?\n/g,'\r\n'),'utf8');console.log(out);
