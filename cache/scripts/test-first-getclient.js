/**
 * Regression test for fb#1955: the FIRST getClient() of a process returned null.
 *
 * Run: npm --workspace=@ibetoni/cache test
 *
 * getClient() created the ioredis client and pinged it at once. With
 * enableOfflineQueue:false (fb#160) that ping rejects in ~0 ms ("Stream isn't
 * writeable") while the socket is still connecting, so the first caller got null.
 * ApiTrackingManager cached that null for the process lifetime and ran with no
 * rate limiting. A tiny in-process RESP server stands in for Redis, so the real
 * ioredis client and the real fail-fast config are exercised without a live Redis.
 */
const assert = require("assert");
const net = require("net");
const UniversalCacheManager = require("../src/UniversalCacheManager");

function startFakeRedis() {
  const server = net.createServer((socket) => {
    // ioredis pipelines its handshake (CLIENT SETINFO x2, INFO) — one reply per command.
    socket.on("data", (chunk) => {
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
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)));
}

async function main() {
  console.log("first getClient() tests:");
  const server = await startFakeRedis();
  const { tls, password, ...base } = new UniversalCacheManager().getRedisConfig();
  const redisConfig = { ...base, host: "127.0.0.1", port: server.address().port };
  const mgr = new UniversalCacheManager({ redisConfig });
  let failures = 0;
  try {
    const client = await mgr.getClient();
    assert.ok(client, "first getClient() returned null against a healthy Redis");
    console.log("  ok  first getClient() returns the client once the socket is ready");
  } catch (e) {
    failures++;
    console.error(`  FAIL ${e.message}`);
  } finally {
    mgr.isShuttingDown = true;
    if (mgr.client) mgr.client.disconnect();
    server.close();
  }
  if (failures) process.exit(1);
}

main();
