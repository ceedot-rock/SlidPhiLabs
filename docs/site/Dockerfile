# lb is built on Debian 13 (glibc 2.39+). bookworm (2.36) cannot run it.
FROM node:20-trixie-slim
WORKDIR /app
# Engines ship via release URLs (docs/site/bin/ stays out of git); a 404 fails the build.
COPY package.json ./
COPY . .
ADD https://github.com/ceedot-rock/pulsar-best/releases/download/v2.5.0/pulsar-2.5.0-x86_64-linux /app/bin/pulsar
ADD https://github.com/ceedot-rock/lbr1/releases/download/v1.0.1/lb-1.0.1-x86_64-linux /app/bin/lb
RUN chmod +x /app/bin/pulsar /app/bin/lb \
 && echo "smoke" | tee /tmp/t | /app/bin/pulsar encode /dev/stdin -o /tmp/t.pulsar && /app/bin/pulsar decode /tmp/t.pulsar -o /tmp/t.out && cmp /tmp/t /tmp/t.out \
 && /app/bin/lb encode /tmp/t /tmp/t.lb && /app/bin/lb decode /tmp/t.lb /tmp/t.lb.out && cmp /tmp/t /tmp/t.lb.out
ENV LB_BIN=/app/bin/lb
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
ENV PULSAR_BIN=/app/bin/pulsar
EXPOSE 8080
CMD ["node", "server.mjs"]
