FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# pure node — no npm install required
COPY . .
ENV NODE_ENV=production
ENV PORT=8080
ENV HOST=0.0.0.0
EXPOSE 8080
CMD ["node", "server.mjs"]
