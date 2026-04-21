#!/bin/bash
# Inicia el túnel de Cloudflare con una URL fija permanente
# Requiere: cloudflared instalado y autenticado (cloudflared login)
#
# Para instalar cloudflared en Windows:
#   winget install --id Cloudflare.cloudflared
#
# Para crear un túnel permanente (hacer una vez):
#   cloudflared tunnel login
#   cloudflared tunnel create bot-whatsapp
#   cloudflared tunnel route dns bot-whatsapp <tu-subdominio>.tu-dominio.com
#
# Uso: bash scripts/start-tunnel.sh

TUNNEL_NAME="bot-whatsapp"
LOCAL_PORT=3131

echo "Iniciando túnel Cloudflare: $TUNNEL_NAME → localhost:$LOCAL_PORT"
cloudflared tunnel run --url "http://localhost:$LOCAL_PORT" "$TUNNEL_NAME"
