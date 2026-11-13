FROM rust:1-bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends git cmake gcc g++ make pkg-config \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
# Keeper is CuNIverse. The store calls check / bank / ingest / audit / emit,
# which that tree already has. The nine CLI names live in the same keeper.
ARG CUNI_REPO=https://github.com/ceedot-rock/CuNIverse.git
ARG CUNI_REF=chore/dependabot-codeowners
RUN git clone --depth 1 --branch "$CUNI_REF" "$CUNI_REPO" /src/cuni \
    && cd /src/cuni && cargo build --release --bin cuni

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates python3 golang-go nodejs gcc g++ rustc sqlite3 default-jdk-headless \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/cuni/target/release/cuni /usr/local/bin/cuni
WORKDIR /app
COPY .well-known ./.well-known
COPY mcp ./mcp
COPY eval ./eval
COPY receipt.schema.json README.md server.py ./
ENV CUNI_BIN=/usr/local/bin/cuni \
    PCCX_BIN=/usr/local/bin/pccx \
    HOST=0.0.0.0 \
    PORT=8788 \
    PIN_CHECK=v0.1.10 \
    PIN_BANK=cuni-bank-0.1.0 \
    PIN_PCCX=e72528b \
    PIN_CALLS=0.10.0 \
    PYTHONUNBUFFERED=1
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8788/healthz', timeout=3)" || exit 1
CMD ["python3", "server.py"]
