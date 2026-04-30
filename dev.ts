/**
 * seedlet 开发服务器启动脚本
 * 同时启动:
 *   - Bun API 服务 (端口 3001)
 *   - Vite 前端开发服务器 (端口 3000)
 *
 * 使用: bun run dev
 */

console.log("🔧 正在启动 seedlet 开发环境...\n");

// 启动 Bun API 服务
const serverProc = Bun.spawn(["bun", "run", "server/index.ts"], {
  stdio: ["inherit", "inherit", "inherit"],
  env: { ...process.env, PORT: "3001" }
});

// 启动 Vite 前端开发服务器
const viteProc = Bun.spawn(["bun", "x", "vite", "--port", "3000"], {
  stdio: ["inherit", "inherit", "inherit"]
});

console.log("🌐 前端页面: http://localhost:3000");
console.log("🔌 API 服务: http://localhost:3001\n");

const cleanup = () => {
  serverProc.kill();
  viteProc.kill();
  process.exit();
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

serverProc.exited.then((code) => {
  console.log(`API 服务已退出，退出码: ${code}`);
  viteProc.kill();
  process.exit(code ?? 1);
});

viteProc.exited.then((code) => {
  console.log(`Vite 开发服务器已退出，退出码: ${code}`);
  serverProc.kill();
  process.exit(code ?? 1);
});
