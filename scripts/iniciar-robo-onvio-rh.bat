@echo off
title Robô RPA Onvio - Conexão RH Workforce Hub
color 0A

echo ============================================================
echo   ROBO RPA ONVIO - WORKFORCE HUB (AUTOMACAO WINDOWS RH)
echo ============================================================
echo.
echo Verificando instalacao do Node.js e Playwright...

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] Node.js nao encontrado neste computador Windows!
    echo Por favor, instale o Node.js em: https://nodejs.org/
    pause
    exit /b
)

if not exist node_modules\playwright (
    echo Instalando o robô e navegador Playwright...
    call npm install playwright
    call npx playwright install chromium
)

echo.
echo ============================================================
echo  [V] Robô ativo e aguardando na porta 3000!
echo  [V] Mantenha esta janela aberta durante os testes do RH.
echo  [V] Ao clicar em 'Transmitir via Robô RPA' no sistema, 
echo      o Chrome abrirá visivelmente na sua tela preenchido!
echo ============================================================
echo.

node scripts/rpa-bridge-windows.js

pause
