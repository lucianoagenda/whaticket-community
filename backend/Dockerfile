# -----------------------
# BUILD STAGE
# -----------------------
FROM node:18-bookworm AS build
WORKDIR /usr/src/app

# No build precisa ter devDependencies (typescript + @types)
ENV NODE_ENV=development

COPY package*.json ./
RUN npm install --include=dev

COPY . .
RUN npm run build


# -----------------------
# RUNTIME STAGE
# -----------------------
FROM node:18-bookworm-slim AS runtime
WORKDIR /usr/src/app

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

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_BIN=/usr/bin/chromium

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/package*.json ./

ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]

# cria usuário não-root
RUN groupadd -r pptr && useradd -r -g pptr -G audio,video pptr \
  && mkdir -p /home/pptr/Downloads \
  && chown -R pptr:pptr /home/pptr /usr/src/app

USER pptr
