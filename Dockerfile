# Chromium and its Linux dependencies are installed from the locked Playwright version.
FROM node:24-bookworm-slim

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci \
    && npx playwright install --with-deps chromium \
    && apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && npm cache clean --force

COPY . .
RUN npm run build && mkdir -p /data && chown node:node /data

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4173 \
    DATA_DIR=/data
USER node
EXPOSE 4173
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(async r=>{const h=await r.json();if(!r.ok||!h.ffmpeg||!h.chromium)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/index.ts", "--production"]
