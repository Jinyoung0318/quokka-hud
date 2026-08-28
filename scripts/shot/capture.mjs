/**
 * README 용 스크린샷을 뽑는다.  npm run shot
 *
 * 창을 띄워 화면을 캡처하지 않는다. Vite 개발 서버로 shot.html 을 띄우고
 * 헤드리스 브라우저로 한 장씩 찍는다. 실제 렌더 코드와 실제 CSS 를 쓰므로
 * 창에서 보이는 것과 같은 것이 나오고, 마우스 위치나 애니메이션 위상이
 * 섞여 들어가지 않는다.
 *
 * 브라우저를 새로 내려받지 않는다. 이미 깔린 Edge · Chrome 을 그대로 쓴다.
 * 이 PC 는 WDAC 정책이 걸려 있어 새 실행 파일이 차단된다.
 */

import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { createServer } from "vite";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT_DIR = join(ROOT, "docs", "screenshots");

/** 창 크기. 논리 85px 의 3배. scripts/shot/scenes.ts 의 SHOT_SCALE 과 맞춘다. */
const SIDE = 85 * 3;

/** 개발용 포트(1420)를 피한다. 개발 중에 돌려도 부딪히지 않게. */
const PORT = 5177;

/*
 * localhost 로 두지 않는다. Node 는 ::1 로, 브라우저는 127.0.0.1 로 붙는 일이
 * 있어서, 서버가 한쪽에만 묶이면 예열은 통과하는데 브라우저는 "연결할 수
 * 없음" 페이지를 찍는다. 그 페이지도 PNG 로는 멀쩡히 저장된다.
 */
const HOST = "127.0.0.1";

const SCENES = ["morning", "noon", "dusk", "night"];

const BROWSERS = [
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

function findBrowser() {
  if (process.env.SHOT_BROWSER) return process.env.SHOT_BROWSER;
  const found = BROWSERS.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      "Edge 나 Chrome 을 찾지 못했습니다. SHOT_BROWSER 에 실행 파일 경로를 넣어 주세요.",
    );
  }
  return found;
}

/** PNG 를 풀어 픽셀을 돌려준다. 확인용이라 인터레이스는 다루지 않는다. */
function decodePng(path) {
  const data = readFileSync(path);
  let pos = 8;
  let idat = Buffer.alloc(0);
  let width = 0;
  let height = 0;
  let channels = 3;
  while (pos < data.length) {
    const len = data.readUInt32BE(pos);
    const type = data.toString("ascii", pos + 4, pos + 8);
    if (type === "IHDR") {
      width = data.readUInt32BE(pos + 8);
      height = data.readUInt32BE(pos + 12);
      channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[data[pos + 17]] ?? 3;
    } else if (type === "IDAT") {
      idat = Buffer.concat([idat, data.subarray(pos + 8, pos + 8 + len)]);
    }
    pos += 12 + len;
  }
  const raw = inflateSync(idat);
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let read = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[read];
    read += 1;
    const line = raw.subarray(read, read + stride);
    read += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride);
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let value = line[x];
      if (filter === 1) value += a;
      else if (filter === 2) value += b;
      else if (filter === 3) value += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = value & 255;
    }
  }
  return { width, height, channels, pixels: out };
}

/**
 * 그림이 실제로 씬인지 본다.
 *
 * 개발 서버가 덜 준비됐거나 브라우저가 페이지를 열지 못하면, 오류 화면이
 * 그대로 PNG 로 저장된다. 파일은 멀쩡히 생기고 크기도 그럴듯해서 확인하지
 * 않으면 어두운 사각형을 README 에 올리게 된다 — 실제로 그럴 뻔했다.
 *
 * 회색이 아닌 색이 몇 가지나 되는지로 가른다. 오류 화면은 거의 무채색에
 * 파란 버튼 하나지만, 씬은 하늘 · 잎 · 흙 · 물이 저마다 다른 색을 낸다.
 */
function looksLikeScene(pngPath) {
  const { width, height, channels, pixels } = decodePng(pngPath);
  const colorful = new Set();
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const o = (y * width + x) * channels;
      const r = pixels[o];
      const g = pixels[o + 1];
      const b = pixels[o + 2];
      const flat = Math.max(r, g, b) - Math.min(r, g, b);
      if (flat > 18) colorful.add((r >> 3) * 1024 + (g >> 3) * 32 + (b >> 3));
    }
  }
  return colorful.size >= 12;
}

function shoot(browser, scene, profileDir) {
  const out = join(OUT_DIR, `${scene}.png`);

  /*
   * 먼저 지운다. 남겨두면 브라우저가 아무것도 못 써도 지난번 파일이 남아
   * existsSync 가 참이 되고, 실패가 성공으로 보고된다. 실제로 그 바람에
   * 오류 화면이 찍힌 그림을 며칠 들고 있을 뻔했다.
   */
  if (existsSync(out)) unlinkSync(out);
  const args = [
    "--headless",
    "--disable-gpu",
    // 없으면 헤드리스가 조용히 아무것도 안 찍고 0 으로 끝난다.
    // 실패 메시지도 남기지 않아서, 빠뜨리면 원인을 찾기 어렵다.
    "--no-sandbox",
    "--hide-scrollbars",
    // 창 바깥은 투명하게. .hud 의 둥근 모서리가 살아난다.
    "--default-background-color=00000000",
    "--force-device-scale-factor=1",
    `--window-size=${SIDE},${SIDE}`,
    // 스프라이트 로딩과 그리기가 끝날 때까지 기다린다. 가상 시간이라
    // 실제로 5초를 쓰지는 않는다.
    "--virtual-time-budget=5000",
    `--user-data-dir=${join(profileDir, scene)}`,
    `--screenshot=${out}`,
    `http://${HOST}:${PORT}/scripts/shot/shot.html?scene=${scene}`,
  ];

  return new Promise((done, fail) => {
    const child = spawn(browser, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", fail);
    /*
     * exit 이 아니라 close 를 기다린다.
     *
     * Windows 에서 msedge.exe 는 실제 브라우저를 띄우고 런처가 먼저 빠진다.
     * exit 에서 판단하면 PNG 가 아직 써지기 전이라 늘 "안 생겼다" 가 된다.
     * close 는 자식이 물려받은 파이프까지 모두 닫혀야 오므로 그때는 끝나 있다.
     */
    child.on("close", (code) => {
      // 종료 코드를 보지 않는다. 헤드리스는 찍고도 0 이 아닌 값을 주는 일이
      // 있어서, 파일이 생겼는지로 판단하는 편이 정확하다.
      if (existsSync(out)) {
        done(out);
        return;
      }
      const detail = stderr.trim().slice(-240);
      fail(new Error(`${scene}: PNG 가 생기지 않았습니다 (코드 ${code}) ${detail}`));
    });
  });
}

async function main() {
  const browser = findBrowser();
  console.log(`브라우저: ${browser}`);

  mkdirSync(OUT_DIR, { recursive: true });
  const profileDir = join(tmpdir(), `quokka-shot-${process.pid}`);

  const server = await createServer({
    root: ROOT,
    configFile: join(ROOT, "vite.config.ts"),
    logLevel: "warn",
    server: { host: HOST, port: PORT, strictPort: true },
  });
  await server.listen();
  console.log(`개발 서버: http://${HOST}:${PORT}`);

  /*
   * 첫 요청에서 Vite 가 의존성을 사전 번들한다. 서버를 띄우자마자 브라우저를
   * 붙이면 그 와중에 페이지가 열려 오류 화면이 찍힌다. 한 번 미리 불러
   * 준비를 끝내 놓는다.
   */
  const warmup = `http://${HOST}:${PORT}/scripts/shot/shot.html?scene=${SCENES[0]}`;
  const ok = await fetch(warmup);
  if (!ok.ok) throw new Error(`개발 서버가 ${ok.status} 를 돌려줍니다`);
  await ok.text();
  await fetch(`http://${HOST}:${PORT}/scripts/shot/shot.ts`).then((res) => res.text());
  await new Promise((wait) => setTimeout(wait, 1500));

  try {
    for (const scene of SCENES) {
      const out = await shoot(browser, scene, profileDir);
      if (!looksLikeScene(out)) {
        throw new Error(
          `${scene}: 씬이 아니라 오류 화면으로 보입니다. 개발 서버 준비가 덜 됐을 수 있습니다.`,
        );
      }
      console.log(`  ${scene.padEnd(8)} -> ${out.replace(ROOT + "\\", "").replace(ROOT + "/", "")}`);
    }
  } finally {
    await server.close();
    // 브라우저가 프로필 파일을 아직 붙들고 있을 수 있다. 임시 폴더가
    // 남는 것뿐이라 지우지 못해도 그림은 이미 나왔다.
    try {
      rmSync(profileDir, { recursive: true, force: true, maxRetries: 3 });
    } catch {
      /* 남겨둔다 */
    }
  }

  console.log(`\n${SCENES.length} 장 완료 (${SIDE}x${SIDE})`);
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});
