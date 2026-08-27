import { defineConfig } from "vite";
// 개발용 — Tauri 가 붙기 전까지 브라우저에서 실제 사용량을 보기 위한 임시 배선.
// Tauri 로 가면 Rust 수집기가 대신하므로 이 import 와 아래 plugins 항목,
// 그리고 src/dev/usageDevServer.ts · src/collector/devServerSource.ts 를 함께 지운다.
import { usageDevServerPlugin } from "./src/dev/usageDevServer";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  // 개발용. apply: "serve" 라서 프로덕션 빌드에는 들어가지 않는다.
  plugins: [usageDevServerPlugin()],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
