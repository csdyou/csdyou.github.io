(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const clamp = (value, min = 0, max = 255) => Math.max(min, Math.min(max, value));

  // 30 分鐘改版：投影片順序已直接寫在 index.html 中，
  // 不再於執行期搬動 .selfie-demo 區塊。

  const loadImage = (source) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

  function drawCover(context, image, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    context.clearRect(0, 0, width, height);
    context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  }

  function sourceFrom(image, width = 800, height = 500) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    drawCover(context, image, width, height);
    return { canvas, pixels: context.getImageData(0, 0, width, height) };
  }

  function attachRange(control, update) {
    if (!control) return;
    control.addEventListener('input', update);
    update();
  }

  function setupBrightness(source) {
    const canvas = $('#selfie-brightness-canvas');
    const slider = $('#selfie-brightness-value');
    const output = $('#selfie-brightness-output');
    if (!canvas || !slider || !output) return;
    canvas.width = source.canvas.width;
    canvas.height = source.canvas.height;
    const context = canvas.getContext('2d');
    attachRange(slider, () => {
      const bias = Number(slider.value);
      const result = new ImageData(new Uint8ClampedArray(source.pixels.data), source.pixels.width, source.pixels.height);
      for (let i = 0; i < result.data.length; i += 4) {
        result.data[i] = clamp(source.pixels.data[i] + bias);
        result.data[i + 1] = clamp(source.pixels.data[i + 1] + bias);
        result.data[i + 2] = clamp(source.pixels.data[i + 2] + bias);
      }
      context.putImageData(result, 0, 0);
      output.textContent = bias > 0 ? `+${bias}` : String(bias);
    });
  }

  function setupGrayscale(source) {
    const canvas = $('#selfie-grayscale-canvas');
    const slider = $('#selfie-grayscale-value');
    const output = $('#selfie-grayscale-output');
    if (!canvas || !slider || !output) return;
    canvas.width = source.canvas.width;
    canvas.height = source.canvas.height;
    const context = canvas.getContext('2d');
    attachRange(slider, () => {
      const mix = Number(slider.value) / 100;
      const result = new ImageData(new Uint8ClampedArray(source.pixels.data), source.pixels.width, source.pixels.height);
      for (let i = 0; i < result.data.length; i += 4) {
        const r = source.pixels.data[i];
        const g = source.pixels.data[i + 1];
        const b = source.pixels.data[i + 2];
        const gray = .299 * r + .587 * g + .114 * b;
        result.data[i] = r * (1 - mix) + gray * mix;
        result.data[i + 1] = g * (1 - mix) + gray * mix;
        result.data[i + 2] = b * (1 - mix) + gray * mix;
      }
      context.putImageData(result, 0, 0);
      output.textContent = `${slider.value}%`;
    });
  }

  function setupRotation(image) {
    const canvas = $('#selfie-rotation-canvas');
    const slider = $('#selfie-rotation-value');
    const output = $('#selfie-rotation-output');
    if (!canvas || !slider || !output) return;
    canvas.width = 800;
    canvas.height = 500;
    const context = canvas.getContext('2d');
    attachRange(slider, () => {
      const angle = Number(slider.value);
      context.fillStyle = '#03040a';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.save();
      context.translate(canvas.width / 2, canvas.height / 2);
      context.rotate(angle * Math.PI / 180);
      const scale = Math.min(canvas.width / image.width, canvas.height / image.height) * .84;
      context.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
      context.restore();
      output.textContent = `${angle}°`;
    });
  }

  function setupBlur(image) {
    const canvas = $('#selfie-blur-canvas');
    const slider = $('#selfie-blur-value');
    const output = $('#selfie-blur-output');
    if (!canvas || !slider || !output) return;
    canvas.width = 800;
    canvas.height = 500;
    const context = canvas.getContext('2d');
    attachRange(slider, () => {
      const radius = Number(slider.value);
      context.save();
      context.filter = radius ? `blur(${radius}px)` : 'none';
      drawCover(context, image, canvas.width, canvas.height);
      context.restore();
      output.textContent = `${radius}px`;
    });
  }

  function setupEdges(source) {
    const canvas = $('#selfie-edge-canvas');
    const slider = $('#selfie-edge-value');
    const output = $('#selfie-edge-output');
    if (!canvas || !slider || !output) return;
    const { width, height } = source.pixels;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    const gray = new Float32Array(width * height);
    const magnitude = new Float32Array(width * height);
    for (let p = 0, i = 0; p < gray.length; p++, i += 4) gray[p] = .299 * source.pixels.data[i] + .587 * source.pixels.data[i + 1] + .114 * source.pixels.data[i + 2];
    const at = (x, y) => gray[clamp(y, 0, height - 1) * width + clamp(x, 0, width - 1)];
    for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
      const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      magnitude[y * width + x] = Math.hypot(gx, gy);
    }
    attachRange(slider, () => {
      const threshold = Number(slider.value);
      const result = context.createImageData(width, height);
      for (let p = 0, i = 0; p < magnitude.length; p++, i += 4) {
        const value = clamp((magnitude[p] - threshold) * 2.2);
        result.data[i] = value * .35;
        result.data[i + 1] = value;
        result.data[i + 2] = value * .9;
        result.data[i + 3] = 255;
      }
      context.putImageData(result, 0, 0);
      output.textContent = threshold;
    });
  }

  function setupFace(image) {
    const canvas = $('#selfie-face-canvas');
    const runButton = $('#selfie-face-run');
    const resetButton = $('#selfie-face-reset');
    const steps = $$('.selfie-face-step');
    if (!canvas || !runButton || !resetButton || !steps.length) return;
    canvas.width = 800;
    canvas.height = 500;
    const context = canvas.getContext('2d');
    const outputs = steps.map(step => $('output', step));
    const box = { x: 250, y: 95, width: 270, height: 290 };
    let token = 0;
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

    function draw(stage, scan = 0) {
      drawCover(context, image, canvas.width, canvas.height);
      if (stage >= 1) {
        context.strokeStyle = '#55e6d5';
        context.lineWidth = 5;
        context.strokeRect(box.x, box.y, box.width, box.height);
      }
      if (stage === 1) {
        const y = box.y + box.height * scan;
        context.strokeStyle = '#ff5da2';
        context.lineWidth = 3;
        context.beginPath(); context.moveTo(box.x, y); context.lineTo(box.x + box.width, y); context.stroke();
      }
      if (stage >= 2) {
        const points = [[.38,.46],[.70,.46],[.52,.60],[.42,.76],[.62,.76]];
        context.fillStyle = '#ffd166';
        points.forEach(([x, y]) => { context.beginPath(); context.arc(box.x + box.width * x, box.y + box.height * y, 6, 0, Math.PI * 2); context.fill(); });
      }
      if (stage >= 3) {
        context.fillStyle = 'rgba(9,11,24,.9)';
        context.fillRect(box.x, box.y + box.height - 48, box.width, 48);
        context.fillStyle = '#55e6d5';
        context.font = '800 21px ui-monospace, monospace';
        context.fillText('MATCH 94.2%', box.x + 12, box.y + box.height - 16);
      }
    }

    function setStep(active, completed, values) {
      steps.forEach((step, index) => {
        step.classList.toggle('active', index === active);
        step.classList.toggle('done', index < completed);
        outputs[index].textContent = values[index];
      });
    }

    function reset() {
      token++;
      runButton.disabled = false;
      runButton.textContent = '▶ 開始辨識';
      setStep(-1, 0, ['等待', '—', '—', '—']);
      draw(0);
    }

    async function run() {
      const current = ++token;
      runButton.disabled = true;
      setStep(0, 0, ['掃描', '—', '—', '—']);
      for (let frame = 0; frame <= 18; frame++) {
        if (current !== token) return;
        draw(1, frame / 18);
        await wait(28);
      }
      setStep(1, 1, ['完成', '[ .18, −.42, … ]', '—', '—']); draw(2); await wait(500);
      if (current !== token) return;
      setStep(2, 2, ['完成', '[ .18, −.42, … ]', '94.2%', '—']); draw(3); await wait(500);
      if (current !== token) return;
      setStep(3, 4, ['完成', '[ .18, −.42, … ]', '94.2%', 'L = 0.058']);
      runButton.disabled = false;
      runButton.textContent = '▶ 再辨識一次';
    }

    runButton.addEventListener('click', run);
    resetButton.addEventListener('click', reset);
    if (typeof Reveal !== 'undefined' && typeof Reveal.on === 'function') Reveal.on('slidechanged', ({ currentSlide }) => { if (!currentSlide?.contains(canvas)) reset(); });
    reset();
  }

  async function init() {
    try {
      const image = await loadImage('assets/selfie-outdoor-woman.jpg');
      const source = sourceFrom(image);
      setupBrightness(source);
      setupGrayscale(source);
      setupRotation(image);
      setupBlur(image);
      setupEdges(source);
      setupFace(image);
    } catch (error) {
      console.error('自拍照整合單元初始化失敗', error);
    }
  }

  window.addEventListener('DOMContentLoaded', init);
})();
