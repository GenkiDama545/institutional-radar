FROM node:24-alpine
WORKDIR /app
COPY server ./server
ENV PORT=8080 RADAR_STATE_FILE=/data/radar-state.json
EXPOSE 8080
CMD ["node", "server/index.mjs"]
