# -----------------------
# BUILD STAGE
# -----------------------
FROM node:18-bookworm AS build

WORKDIR /usr/src/app

# Copia manifestos
COPY package*.json ./

# IMPORTANTE: sem package-lock, não dá pra usar npm ci
RUN npm install

# Copia o resto e builda
COPY . .
RUN npm run build


# -----------------------
# RUNTIME STAGE
# -----------------------
FROM node:18-bookworm-slim AS runtime

WORKDIR /usr/src/app

# Dependências necessárias pro Chromium rodar (Puppeteer/whatsapp-web.js)
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    ca-certificates \
    wget \
    gnupg \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpangocairo-1.0-0 \
    libpango-1.0-0 \
    libcairo2 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libxrender1 \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

# Instala Chromium do Debian (mais simples e estável em container)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
  && rm -rf /var/lib/apt/lists/*

# Variáveis recomendadas pro Puppeteer
ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium

# Copia node_modules e build do estágio de build
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./

# Porta: ajuste para a que seu app usa (você mostrou 8080 no log)
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dumb-init", "--"]

# Se você usa DB_HOST/porta, mantenha o seu fluxo aqui.
# Se não tiver dockerize no projeto, REMOVA a linha do dockerize.
CMD ["node", "dist/server.js"]
