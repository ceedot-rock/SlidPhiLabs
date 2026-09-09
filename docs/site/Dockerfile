FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
COPY . .
RUN chmod +x /app/bin/pulsar /app/bin/lb || true
ENV LB_BIN=/app/bin/lb
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV PULSAR_BIN=/app/bin/pulsar
EXPOSE 8080
CMD ["node", "server.mjs"]
