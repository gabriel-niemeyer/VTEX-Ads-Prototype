<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1KFZAF64wsnwodOMf2MeK5ae9C0kgBeHG

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## PNG banners gerados por IA

As 3 primeiras campanhas agora tentam carregar PNGs em `public/generated-banners/`. Se o arquivo ainda nao existir, o app cai automaticamente para o banner renderizado localmente.

Para gerar os PNGs com OpenAI:

1. Exporte `OPENAI_API_KEY`
2. Opcionalmente ajuste `OPENAI_IMAGE_MODEL` e `OPENAI_IMAGE_QUALITY`
3. Rode `npm run generate:nestle-banners`

O gerador salva um PNG por formato para cada uma das 3 primeiras campanhas e usa `sips` para reenquadrar a imagem no tamanho final de cada slot.
