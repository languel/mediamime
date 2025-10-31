#!/usr/bin/env node
/**
 * Simple OSC relay server.
 * Listens for HTTP POST /osc JSON payloads from index.html and forwards them via UDP/OSC.
 *
 * Usage:
 *   node osc-relay.mjs [--host 127.0.0.1] [--port 9000] [--listen 7331]
 */
import dgram from "node:dgram";
import http from "node:http";
import { argv, exit } from "node:process";

const args = new Map();
for (let i = 2; i < argv.length; i += 2) {
  const key = argv[i];
  const value = argv[i + 1];
  if (!key?.startsWith("--") || !value) {
    console.error("Usage: node osc-relay.mjs [--host 127.0.0.1] [--port 9000] [--listen 7331]");
    exit(1);
  }
  args.set(key.slice(2), value);
}

const targetHost = args.get("host") ?? "127.0.0.1";
const targetPort = Number.parseInt(args.get("port") ?? "9000", 10);
const listenPort = Number.parseInt(args.get("listen") ?? "7331", 10);

if (!Number.isInteger(targetPort) || targetPort <= 0 || targetPort > 65535) {
  console.error("Invalid target port");
  exit(1);
}
if (!Number.isInteger(listenPort) || listenPort <= 0 || listenPort > 65535) {
  console.error("Invalid listen port");
  exit(1);
}

const udp = dgram.createSocket("udp4");

const sendOsc = (address, args, host, port) => {
  const payload = JSON.stringify({ address, args });
  udp.send(Buffer.from(payload), port, host, (error) => {
    if (error) {
      console.error("OSC send failed:", { error, address, args, host, port });
    } else {
      console.log("[OSC->UDP]", { address, args, host, port });
    }
  });
};

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS" && req.url === "/osc") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }).end();
    return;
  }
  if (req.method !== "POST" || req.url !== "/osc") {
    res.writeHead(404, { "Access-Control-Allow-Origin": "*" }).end();
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1_000_000) {
      res.writeHead(413, { "Access-Control-Allow-Origin": "*" }).end();
      req.socket.destroy();
    }
  });

  req.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      const address = typeof payload.address === "string" ? payload.address : "";
      if (!address) {
        res.writeHead(400, { "Access-Control-Allow-Origin": "*" }).end("Missing address");
        return;
      }
      const args = Array.isArray(payload.args) ? payload.args : [];
      const host = typeof payload.host === "string" && payload.host.trim()
        ? payload.host.trim()
        : targetHost;
      const port = Number.parseInt(payload.port ?? targetPort, 10);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        res.writeHead(400, { "Access-Control-Allow-Origin": "*" }).end("Invalid port");
        return;
      }
      sendOsc(address, args, host, port);
      res.writeHead(204, { "Access-Control-Allow-Origin": "*" }).end();
    } catch (err) {
      console.error("OSC relay parse error:", err);
      res.writeHead(400, { "Access-Control-Allow-Origin": "*" }).end("Invalid payload");
    }
  });
});

server.listen(listenPort, () => {
  console.log(`OSC relay listening on http://127.0.0.1:${listenPort}/osc`);
  console.log(`Forwarding to udp://${targetHost}:${targetPort}`);
});

process.on("SIGINT", () => {
  console.log("\nShutting down OSC relay.");
  server.close(() => {
    udp.close(() => exit(0));
  });
});
