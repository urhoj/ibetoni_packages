/**
 * Regression test for the 2026-09-28 production slowdown (Sentry NODE-EXPRESS-7X).
 *
 * Run: npm --workspace=@ibetoni/cache test
 *
 * After a swap the production process held a Redis socket that stayed "ready" but
 * never answered again. commandTimeout (fb#160) rejected every command after 2 s,
 * but a command timeout does NOT make ioredis drop the socket, so every request
 * paid 2 s per Redis call (token blacklist, cache reads) until a manual restart,
 * while /health read the ready flag and stayed green. socketTimeout makes ioredis
 * destroy a socket that stops answering and reconnect through retryStrategy.
 *
 * A tiny in-process RESP server stands in for Redis: the FIRST connection goes
 * silent on demand, later connections answer normally.
 */
const assert = require("assert");
const net = require("net");
const UniversalCacheManager = require("../src/UniversalCacheManager");

function startFakeRedis() {
  let connections = 0;
  let wedgeFirst = false;
  const server = net.createServer((socket) => {
    const isFirst = ++connections === 1;
    // ioredis pipelines its handshake (CLIENT SETINFO x2, INFO) — one reply per command.
    socket.on("data", (chunk) => {
      if (isFirst && wedgeFirst) return; // connected, writable, never answers
      const commands = chunk.toString().toUpperCase().split(/\*\d+\r\n/).filter(Boolean);
      for (const cmd of commands) {
        if (cmd.startsWith("$4\r\nINFO\r\n")) {
          const body = "loading:0\r\n";
          socket.write(`$${body.length}\r\n${body}\r\n`);
        } else if (cmd.includes("PING")) {
          socket.write("+PONG\r\n");
        } else {
          socket.write("+OK\r\n");
        }
      }
    });
    socket.on("error", () => {});
  });
  server.wedgeFirst = () => (wedgeFirst = true);
  server.connections = () => connections;
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  console.log("wedged socket tests:");
  const server = await startFakeRedis();
  const { tls, password, ...base } = new UniversalCacheManager().getRedisConfig();
  const redisConfig = { ...base, host: "127.0.0.1", port: server.address().port };
  const mgr = new UniversalCacheManager({ redisConfig });
  const { error: origError, warn: origWarn } = console;
  let failures = 0;
  try {
    const client = await mgr.getClient();
    assert.ok(client, "getClient() returned null against a healthy Redis");

    server.wedgeFirst();
    console.error = console.warn = () => {};
    const closed = new Promise((resolve) => client.once("close", resolve));
    await client.get("k").catch(() => {}); // times out after commandTimeout
    const limitMs = (base.socketTimeout ?? 0) + 2000;
    const dropped = await Promise.race([
      closed.then(() => true),
      new Promise((r) => setTimeout(() => r(false), Math.max(limitMs, 6000))),
    ]);
    assert.ok(dropped, "a socket that stopped answering was never dropped (no socketTimeout)");
    console.log("  ok  a silent socket is destroyed instead of stalling every command");

    await new Promise((resolve) => client.once("ready", resolve));
    assert.ok(server.connections() >= 2, "client did not open a fresh connection");
    assert.strictEqual(await client.get("k"), "OK", "command failed after reconnect");
    console.log("  ok  the client reconnects and serves commands again");
  } catch (e) {
    failures++;
    console.error = origError;
    console.error(`  FAIL ${e.message}`);
  } finally {
    Object.assign(console, { error: origError, warn: origWarn });
    mgr.isShuttingDown = true;
    if (mgr.client) mgr.client.disconnect();
    server.close();
  }
  if (failures) process.exit(1);
}

main();
