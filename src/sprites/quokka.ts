/**
 * 쿼카 스프라이트. 앉아 있는 정면 자세.
 *
 * 머리와 몸통을 따로 만들지 않는다. 위가 둥글고 아래로 벌어지는
 * 종 모양 덩어리 하나이고, 바닥이 가장 넓어 앉은 느낌을 낸다.
 *
 * 형태는 색 배치가 만든다. 진한 갈색 외곽선이 배경에서 실루엣을 떼어내고,
 * 주둥이·배·앞발의 밝은 베이지 블록이 그 안에서 덩어리를 나눈다.
 * 팔은 따로 그리지 않고 배 블록 양옆에 외곽선을 세워 갈라냈다.
 *
 * 문자 하나가 픽셀 하나다. 문자의 뜻은 QUOKKA_PALETTE 를 따른다.
 *
 *   o 외곽선   d 머리 윗면·몸 가장자리   b 몸통   l 주둥이·배·앞발
 *   k 귀 안쪽  e 눈   w 눈 하이라이트   n 코   s 입   . 투명
 *
 * 캐릭터를 갈아끼울 때는 이 폴더의 파일과 팔레트를 함께 교체한다.
 * 엔진은 이 파일의 내용을 모른다.
 */

import { QUOKKA_PALETTE } from "../render/palette";
import { createImageSprite, createPixelSprite, type Sprite } from "../render/sprite";
import quokkaIdleImage from "../assets/quokka_idle.png";

export const QUOKKA_SIZE = 24;

/**
 * idle 2프레임.
 *
 * 두 번째 프레임은 머리가 1픽셀 내려가고 몸통에서 한 줄이 빠진다.
 * 앞발과 바닥은 제자리여서 8fps 로 번갈아 보면 숨을 쉬는 것처럼 보인다.
 */
const IDLE_FRAMES: readonly (readonly string[])[] = [
  [
    "................................",
    ".......ooo............ooo.......",
    "......okkko..........okkko......",
    "......oddddddddddddddddddo......",
    ".....oddddddddddddddddddddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddwebbbbbbbbbbbbewddo.....",
    ".....oddeebbbbbbbbbbbbeeddo.....",
    ".....oddeebbbbbbbbbbbbeeddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddbbbllllllllllbbbddo.....",
    ".....oddbbbllllnnllllbbbddo.....",
    ".....oddbbbllslsslsllbbbddo.....",
    ".....oddbbbllllllllllbbbddo.....",
    ".....oddbbbbllllllllbbbbddo.....",
    "....oddbbllllllllllllllbbddo....",
    "....oddbbllllllllllllllbbddo....",
    "....oddbollllllllllllllobddo....",
    "....oddbollllllllllllllobddo....",
    "...oddbbollllllllllllllobbddo...",
    "...oddbbollllllllllllllobbddo...",
    "...oddbbollllllllllllllobbddo...",
    "...oddbbollllllllllllllobbddo...",
    "..oddbbbbllllllllllllllbbbbddo..",
    "..oddbbbbllllllllllllllbbbbddo..",
    "..oddbbbbllllllllllllllbbbbddo..",
    "..oddbbbllolllloollllollbbbddo..",
    "..oddbbbllolllloollllollbbbddo..",
    "..oddbbbllolllloollllollbbbddo..",
    "..oooooooooooooooooooooooooooo..",
  ],
  [
    "................................",
    "................................",
    ".......ooo............ooo.......",
    "......okkko..........okkko......",
    "......oddddddddddddddddddo......",
    ".....oddddddddddddddddddddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddwebbbbbbbbbbbbewddo.....",
    ".....oddeebbbbbbbbbbbbeeddo.....",
    ".....oddeebbbbbbbbbbbbeeddo.....",
    ".....oddbbbbbbbbbbbbbbbbddo.....",
    ".....oddbbbllllllllllbbbddo.....",
    ".....oddbbbllllnnllllbbbddo.....",
    ".....oddbbbllslsslsllbbbddo.....",
    ".....oddbbbllllllllllbbbddo.....",
    ".....oddbbbbllllllllbbbbddo.....",
    "....oddbbllllllllllllllbbddo....",
    "....oddbollllllllllllllobddo....",
    "....oddbollllllllllllllobddo....",
    "...oddbbollllllllllllllobbddo...",
    "...oddbbollllllllllllllobbddo...",
    "...oddbbollllllllllllllobbddo...",
    "...oddbbollllllllllllllobbddo...",
    "..oddbbbbllllllllllllllbbbbddo..",
    "..oddbbbbllllllllllllllbbbbddo..",
    "..oddbbbbllllllllllllllbbbbddo..",
    "..oddbbbllolllloollllollbbbddo..",
    "..oddbbbllolllloollllollbbbddo..",
    "..oddbbbllolllloollllollbbbddo..",
    "..oooooooooooooooooooooooooooo..",
  ],
];

export const quokkaIdlePixel: Sprite = createPixelSprite({
  frames: IDLE_FRAMES,
  palette: QUOKKA_PALETTE,
});

export const quokkaIdle: Sprite = createImageSprite({
  src: quokkaIdleImage,
  width: QUOKKA_SIZE,
  height: QUOKKA_SIZE,
  yOffsets: [0, 1],
});
