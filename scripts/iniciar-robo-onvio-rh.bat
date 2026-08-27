@echo off
title Robô RPA Onvio - Workforce Hub
color 0A
cls

echo ============================================================
echo   ROBO RPA ONVIO - WORKFORCE HUB
echo   Motor: Digitacao Real (Teclado) + Polling Nuvem
echo ============================================================
echo.
echo  [OK] O Chrome abrira automaticamente quando disparado pelo sistema.
echo  [OK] Polling da fila Vercel ativo (verificando a cada 3 segundos).
echo  [OK] Mantenha esta janela aberta enquanto utiliza o sistema.
echo ============================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado. Instale em https://nodejs.org
    pause
    exit /b 1
)

if exist bin\Robo-Onvio-RH.exe (
    bin\Robo-Onvio-RH.exe
) else (
    cd /d "%~dp0.."
    node scripts/rpa-bridge-windows.js
)

echo.
echo [AVISO] O robo foi encerrado. Pressione qualquer tecla para sair.
pause
