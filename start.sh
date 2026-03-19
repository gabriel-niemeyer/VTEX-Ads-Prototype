#!/bin/bash
cd "$(dirname "$0")"
echo "Instalando dependências..."
npm install
echo "Iniciando servidor..."
npm run dev
