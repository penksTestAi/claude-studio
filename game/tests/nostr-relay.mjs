// A tiny Nostr relay for tests, with no dependencies: just enough of NIP-01 (EVENT, REQ, CLOSE, OK) for
// Trystero's signalling. It forwards events to matching subscriptions and, like public relays, keeps the
// last minute of events so a new subscription also receives what was announced just before it.
// It does not check signatures. Used only on 127.0.0.1 so the real WebRTC path can be tested offline.
import { createServer } from "node:http";
import { createHash } from "node:crypto";

export function startRelay(port = 0) {
  const clients = new Set();
  let recent = []; // { ev, at }
  const server = createServer((req, res) => res.writeHead(426).end("websocket only"));
  server.on("upgrade", (req, socket) => {
    const key = req.headers["sec-websocket-key"];
    if (!key) { socket.destroy(); return; }
    const accept = createHash("sha1").update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const c = { socket, subs: new Map(), buf: Buffer.alloc(0), parts: [] };
    clients.add(c);
    socket.on("data", (d) => { c.buf = Buffer.concat([c.buf, d]); readFrames(c); });
    socket.on("close", () => clients.delete(c));
    socket.on("error", () => clients.delete(c));
  });

  function send(c, text) {
    const data = Buffer.from(text);
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

  function matches(f, ev) {
    if (f.kinds && !f.kinds.includes(ev.kind)) return false;
    if (typeof f.since === "number" && ev.created_at < f.since) return false;
    for (const [k, vals] of Object.entries(f)) {
      if (k[0] !== "#") continue;
      const tag = k.slice(1);
      if (!ev.tags.some(t => t[0] === tag && vals.includes(t[1]))) return false;
    }
    return true;
  }

  function handle(c, text) {
    let m; try { m = JSON.parse(text); } catch { return; }
    if (!Array.isArray(m)) return;
    if (m[0] === "REQ") {
      const filters = m.slice(2);
      c.subs.set(m[1], filters);
      for (const { ev } of recent) if (filters.some(f => matches(f, ev))) send(c, JSON.stringify(["EVENT", m[1], ev]));
      send(c, JSON.stringify(["EOSE", m[1]]));
    }
    else if (m[0] === "CLOSE") c.subs.delete(m[1]);
    else if (m[0] === "EVENT" && m[1] && typeof m[1] === "object") {
      const ev = m[1];
      send(c, JSON.stringify(["OK", ev.id, true, ""]));
      if (!Array.isArray(ev.tags)) return;
      const now = Date.now();
      recent = recent.filter(r => now - r.at < 60000); recent.push({ ev, at: now });
      for (const other of clients) for (const [subId, filters] of other.subs) {
        if (filters.some(f => matches(f, ev))) send(other, JSON.stringify(["EVENT", subId, ev]));
      }
    }
  }

  return new Promise((resolve) => server.listen(port, "127.0.0.1", () => resolve({
    url: `ws://127.0.0.1:${server.address().port}`,
    close: () => { for (const c of clients) c.socket.destroy(); server.close(); },
  })));
}
