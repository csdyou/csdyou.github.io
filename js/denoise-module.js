// 去噪示範：同一張夜景照片加上雜訊後，比較「平均」與「中值」兩種去噪方式。
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);

  const loadImage = (source) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

  function gaussian() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  // 3×3 中值：每格換成鄰居排序後的中間值，邊緣比較不會糊掉
  function medianFilter(src, w, h) {
    const out = new Uint8ClampedArray(src.length);
    const buf = new Uint8Array(9);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          let n = 0;
          for (let dy = -1; dy <= 1; dy++) {
            const yy = Math.min(h - 1, Math.max(0, y + dy));
            for (let dx = -1; dx <= 1; dx++) {
              const xx = Math.min(w - 1, Math.max(0, x + dx));
              buf[n++] = src[(yy * w + xx) * 4 + c];
            }
          }
          const sorted = Array.prototype.slice.call(buf, 0, n).sort((a, b) => a - b);
          out[(y * w + x) * 4 + c] = sorted[n >> 1];
        }
        out[(y * w + x) * 4 + 3] = 255;
      }
    }
    return out;
  }

  async function setup() {
    const noisyCanvas = $('#denoise-noisy');
    const resultCanvas = $('#denoise-result');
    const slider = $('#denoise-level');
    const output = $('#denoise-level-value');
    const errorBox = $('#denoise-error');
    if (!noisyCanvas || !resultCanvas || !slider) return;

    const image = await loadImage('assets/lowlight-japan-town.jpg');
    const width = 470;
    const height = Math.round(width * image.height / image.width);
    [noisyCanvas, resultCanvas].forEach((c) => { c.width = width; c.height = height; });
    const noisyCtx = noisyCanvas.getContext('2d', { willReadFrequently: true });
    const resultCtx = resultCanvas.getContext('2d');
    noisyCtx.drawImage(image, 0, 0, width, height);

    const clean = noisyCtx.getImageData(0, 0, width, height);
    // 先把夜景拉亮（等同第 11 頁的低光增強）——暗部一被抬起來，雜訊也跟著被放大，
    // 這才是手機夜拍真正要處理的畫面。
    const gammaLUT = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) gammaLUT[v] = 255 * Math.pow(v / 255, 0.45);
    for (let i = 0; i < clean.data.length; i += 4) {
      clean.data[i] = gammaLUT[clean.data[i]];
      clean.data[i + 1] = gammaLUT[clean.data[i + 1]];
      clean.data[i + 2] = gammaLUT[clean.data[i + 2]];
    }
    const noiseField = new Float32Array(clean.data.length);
    for (let i = 0; i < noiseField.length; i += 4) {
      noiseField[i] = gaussian();
      noiseField[i + 1] = gaussian();
      noiseField[i + 2] = gaussian();
    }
    // 真實感光元件除了細碎的雜訊，還會出現整格壞掉的亮點／暗點。
    // 每個像素先抽好「排隊順序」與「壞掉時的值」，拖滑桿時才不會整張重抽。
    const impulseRank = new Float32Array(width * height);
    const impulseValue = new Uint8Array(width * height);
    for (let k = 0; k < impulseRank.length; k++) {
      impulseRank[k] = Math.random();
      impulseValue[k] = Math.random() < 0.5 ? 0 : 255;
    }

    const noisyImage = noisyCtx.createImageData(width, height);
    const resultImage = resultCtx.createImageData(width, height);

    const meanError = (data) => {
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += Math.abs(data[i] - clean.data[i])
             + Math.abs(data[i + 1] - clean.data[i + 1])
             + Math.abs(data[i + 2] - clean.data[i + 2]);
      }
      return sum / (data.length / 4 * 3);
    };

    function update() {
      const level = Number(slider.value);
      const sigma = level * 0.45;
      const impulseRate = (level / 60) * 0.05;
      for (let k = 0; k < impulseRank.length; k++) {
        const i = k * 4;
        if (impulseRank[k] < impulseRate) {
          const v = impulseValue[k];
          noisyImage.data[i] = noisyImage.data[i + 1] = noisyImage.data[i + 2] = v;
        } else {
          noisyImage.data[i] = clamp(clean.data[i] + noiseField[i] * sigma);
          noisyImage.data[i + 1] = clamp(clean.data[i + 1] + noiseField[i + 1] * sigma);
          noisyImage.data[i + 2] = clamp(clean.data[i + 2] + noiseField[i + 2] * sigma);
        }
        noisyImage.data[i + 3] = 255;
      }
      noisyCtx.putImageData(noisyImage, 0, 0);

      const out = medianFilter(noisyImage.data, width, height);
      resultImage.data.set(out);
      resultCtx.putImageData(resultImage, 0, 0);

      output.textContent = level;
      if (errorBox) {
        const before = meanError(noisyImage.data);
        const after = meanError(out);
        errorBox.innerHTML = `跟原圖的平均差距　<b class="pink">處理前 ${before.toFixed(1)}</b>　→　<b class="cyan">處理後 ${after.toFixed(1)}</b>`;
      }
    }

    slider.addEventListener('input', update);
    update();
  }

  window.addEventListener('DOMContentLoaded', () => {
    setup().catch((error) => console.error('去噪示範初始化失敗', error));
  });
})();
