# Configurar Node.js no Mac

Siga **uma** das opções abaixo. A **Opção A** é a mais simples; a **Opção B** permite ter várias versões do Node (recomendado se você trabalha em vários projetos).

---

## Opção A – Instalar Node direto (mais simples)

### 1. Instalar Homebrew (se ainda não tiver)

Abra o **Terminal** (Spotlight: `Cmd + Espaço` → digite "Terminal") e rode:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Siga as instruções na tela. No final, ele pode pedir para você rodar 2 linhas de `echo` e `eval` para configurar o PATH — **rode essas linhas**.

### 2. Instalar Node com Homebrew

```bash
brew install node
```

### 3. Conferir

```bash
node -v    # deve mostrar algo como v20.x.x ou v22.x.x
npm -v     # deve mostrar a versão do npm
```

Pronto. Depois disso, na pasta do projeto:

```bash
cd "/Users/gabrielniemeyer/Desktop/Campaign Timeline Manager (3)"
npm install
npm run dev
```

---

## Opção B – NVM (várias versões de Node)

Bom se você quiser trocar de versão do Node por projeto (ex.: Node 18 em um e Node 20 em outro).

### 1. Instalar o NVM

No Terminal:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
```

### 2. Carregar o NVM no terminal

Feche e abra o Terminal de novo, ou rode:

```bash
source ~/.zshrc
```

### 3. Instalar uma versão do Node (ex.: LTS)

```bash
nvm install --lts
nvm use --lts
```

### 4. Conferir

```bash
node -v
npm -v
```

### 5. Uso no dia a dia

- Usar a versão LTS: `nvm use --lts`
- Instalar outra versão: `nvm install 20`
- Trocar: `nvm use 20`

Depois, na pasta do projeto:

```bash
cd "/Users/gabrielniemeyer/Desktop/Campaign Timeline Manager (3)"
npm install
npm run dev
```

---

## Opção C – Site oficial (instalador .pkg)

1. Acesse: https://nodejs.org/
2. Baixe a versão **LTS** (botão verde).
3. Abra o `.pkg` e conclua a instalação.
4. Feche e abra o Terminal e teste: `node -v` e `npm -v`.

---

## Depois de instalar o Node

No Terminal, na pasta do projeto:

```bash
cd "/Users/gabrielniemeyer/Desktop/Campaign Timeline Manager (3)"
npm install
npm run dev
```

Abra no navegador o endereço que aparecer (geralmente `http://localhost:5173`).
