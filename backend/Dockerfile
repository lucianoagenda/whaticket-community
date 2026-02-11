# ----------------------------
# 1) BUILD
# ----------------------------
FROM node:18-bookworm AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build


# ----------------------------
# 2) RUNTIME
# ----------------------------
FROM node:18-bookworm-slim AS runtime

WORKDIR /usr/src/app

# Dependências do sistema + libs necessárias pro Chrome/Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates wget gnupg dumb-init \
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

# Instalar Google Chrome Stable (método atual com keyring)
RUN mkdir -p /etc/apt/keyrings \
  && wget -q -O /etc/apt/keyrings/google-linux-signing-key.gpg https://dl.google.com/linux/linux_signing_key.pub \
  && echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/google-linux-signing-key.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
     > /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update \
  && apt-get install -y --no-install-recommends google-chrome-stable \
  && rm -rf /var/lib/apt/lists/*

# dockerize
ENV DOCKERIZE_VERSION=v0.6.1
RUN wget -q -O /tmp/dockerize.tar.gz \
      https://github.com/jwilder/dockerize/releases/download/${DOCKERIZE_VERSION}/dockerize-linux-amd64-${DOCKERIZE_VERSION}.tar.gz \
  && tar -C /usr/local/bin -xzvf /tmp/dockerize.tar.gz \
  && rm /tmp/dockerize.tar.gz

# Evita o Puppeteer baixar Chromium (vamos usar o Chrome do sistema)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV CHROME_BIN=/usr/bin/google-chrome-stable
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

ENV NODE_ENV=production
ENV PORT=3000

# Copia build + dependências do build stage
COPY --from=build /usr/src/app/package*.json ./
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]

# Mantive seu fluxo: espera o banco, migra e inicia
CMD dockerize -wait tcp://${DB_HOST}:3306 -timeout 60s \
  && npx sequelize db:migrate \
  && node dist/server.js
