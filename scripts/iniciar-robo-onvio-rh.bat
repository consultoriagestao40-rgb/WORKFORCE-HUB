@echo off
title Robô RPA Onvio - Conexão RH Workforce Hub
color 0A
cls

echo ============================================================
echo   ROBO RPA ONVIO - WORKFORCE HUB (AUTOMACAO WINDOWS RH)
echo ============================================================
echo.
echo  [✓] Servidor do Robô RPA Ativo!
echo  [✓] O Robô abrirá o Google Chrome no seu Windows quando disparado.
echo  [✓] Mantenha esta janela aberta enquanto utiliza o sistema.
echo ============================================================
echo.

if exist bin\Robo-Onvio-RH.exe (
    bin\Robo-Onvio-RH.exe
) else if exist Robo-Onvio-RH.exe (
    Robo-Onvio-RH.exe
) else (
    node scripts/rpa-bridge-windows.js
)

if %errorlevel% neq 0 (
    echo.
    echo [AVISO] Ocorreu uma exceção no robô. A janela permanecerá aberta.
)

pause
