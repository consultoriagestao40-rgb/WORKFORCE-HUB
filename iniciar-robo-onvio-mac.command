#!/bin/bash
# ============================================================
#  ROBÔ RPA ONVIO - WORKFORCE HUB (MAC)
#  Motor: Digitação Real (Teclado) + Polling Fila Vercel
# ============================================================
cd "$(dirname "$0")"

echo "============================================================"
echo "  ROBÔ RPA ONVIO - WORKFORCE HUB"
echo "  Motor: Digitação Real + Polling Nuvem Vercel"
echo "============================================================"
echo ""
echo "  [OK] O Chrome abrirá automaticamente ao receber um disparo."
echo "  [OK] Polling da fila Vercel ativo (a cada 3 segundos)."
echo "  [OK] Mantenha esta janela aberta enquanto usa o sistema."
echo "============================================================"
echo ""

# Verificar se node está instalado
if ! command -v node &> /dev/null; then
    # Tentar nvm
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
    
    if ! command -v node &> /dev/null; then
        echo "[ERRO] Node.js não encontrado. Instale em: https://nodejs.org"
        echo "Pressione Enter para sair."
        read
        exit 1
    fi
fi

echo "[OK] Node.js: $(node --version)"
echo ""

# Verificar puppeteer-core
if [ ! -d "node_modules/puppeteer-core" ]; then
    echo "[INFO] Instalando dependências (puppeteer-core)..."
    npm install puppeteer-core --save 2>&1
    echo ""
fi

node scripts/rpa-bridge-windows.js
