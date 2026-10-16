// A tiny BitTorrent WebSocket tracker for tests, with no dependencies: just enough of the WebTorrent tracker
// protocol for Trystero's signalling. A peer announces with a list of WebRTC offers; the tracker hands each offer
// to a different other peer in the same swarm (info_hash); that peer's answer is forwarded to the offerer.
// Used only on 127.0.0.1 so the BitTorrent fallback can be tested offline.
import { createServer } from "node:http";
import { createHash } from "node:crypto";

export function startTracker(port = 0) {
  const clients = new Set();
  const swarms = new Map(); // info_hash -> Map(peer_id -> client)
  const server = createServer((req, res) => res.writeHead(426).end("websocket only"));
  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) { socket.destroy(); return; }
    const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const c = { socket, buf: Buffer.alloc(0), parts: [], joined: new Map() };
    clients.add(c);
    socket.on("data", (d) => { c.buf = Buffer.concat([c.buf, d]); readFrames(c); });
    const gone = () => { clients.delete(c); for (const [id, h] of c.joined) swarms.get(h)?.delete(id); };
    socket.on("close", gone); socket.on("error", gone);
  });

  function send(c, obj) {
    const data = Buffer.from(JSON.stringify(obj));
    let head;
    if (data.length < 126) head = Buffer.from([0x81, data.length]);
    else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
    if (!c.socket.destroyed) c.socket.write(Buffer.concat([head, data]));
  }

  function readFrames(c) {
    for (;;) {
      const b = c.buf;
      if (b.length < 2) return;
      const fin = b[0] & 0x80, op = b[0] & 0x0f, masked = b[1] & 0x80;
      let len = b[1] & 0x7f, off = 2;
      if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); off = 10; }
      const maskOff = off; if (masked) off += 4;
      if (b.length < off + len) return;
      const payload = Buffer.from(b.subarray(off, off + len));
      if (masked) for (let i = 0; i < len; i++) payload[i] ^= b[maskOff + (i & 3)];
      c.buf = b.subarray(off + len);
      if (op === 0x8) { c.socket.end(); return; }
      if (op === 0x9) { c.socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (op === 0x1 || op === 0x0) {
        c.parts.push(payload);
        if (fin) { const text = Buffer.concat(c.parts).toString("utf8"); c.parts = []; handle(c, text); }
      }
    }
  }

  function handle(c, text) {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (!m || m.action !== "announce" || typeof m.info_hash !== "string" || typeof m.peer_id !== "string") return;
    let swarm = swarms.get(m.info_hash);
    if (!swarm) swarms.set(m.info_hash, swarm = new Map());
    swarm.set(m.peer_id, c); c.joined.set(m.peer_id, m.info_hash);
    if (m.answer && m.to_peer_id) {
      const to = swarm.get(m.to_peer_id);
      if (to) send(to, { action: "announce", info_hash: m.info_hash, peer_id: m.peer_id, offer_id: m.offer_id, answer: m.answer });
      return;
    }
    if (Array.isArray(m.offers)) {
      const others = [...swarm.entries()].filter(([id]) => id !== m.peer_id);
      m.offers.slice(0, others.length).forEach((o, i) => {
        if (o && o.offer_id && o.offer) send(others[i][1], { action: "announce", info_hash: m.info_hash, peer_id: m.peer_id, offer_id: o.offer_id, offer: o.offer });
      });
    }
    send(c, { action: "announce", info_hash: m.info_hash, interval: 120, complete: swarm.size, incomplete: 0 });
  }

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({
    url: `ws://127.0.0.1:${server.address().port}`,
    swarmSizes: () => [...swarms.values()].map(s => s.size),
    close: () => { for (const c of clients) c.socket.destroy(); server.close(); },
  })));
}
