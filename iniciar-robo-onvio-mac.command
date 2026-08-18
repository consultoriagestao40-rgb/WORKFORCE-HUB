#!/bin/bash
cd "$(dirname "$0")"
echo "============================================================"
echo "  ROBO RPA ONVIO - WORKFORCE HUB (AUTOMACAO MAC/WINDOWS RH)"
echo "============================================================"
echo ""
echo " [✓] Servidor do Robô RPA Ativo!"
echo " [✓] O Robô abrirá o Google Chrome quando disparado pelo sistema."
echo " [✓] Mantenha esta janela aberta enquanto utiliza o sistema."
echo "============================================================"
echo ""
node scripts/rpa-bridge-windows.js
