FROM node:22-alpine
WORKDIR /bridge
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY bridge.mjs ./
RUN mkdir -p /data && chown node:node /data
USER node
CMD ["node", "bridge.mjs"]
