(() => {
  const clamp = (v, min = 0, max = 255) => Math.max(min, Math.min(max, v));
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function setupInteractionSafety() {
    $$('button').forEach((button) => {
      button.type = 'button';
    });
    $$('button, input[type="range"], .upload-label').forEach((control) => {
      control.addEventListener('pointerdown', (event) => event.stopPropagation());
      control.addEventListener('click', (event) => event.stopPropagation());
    });
  }

  function showLocalFileWarning() {
    if (location.protocol !== 'file:') return;
    const warning = document.createElement('div');
    warning.className = 'local-file-warning';
    warning.innerHTML = '<b>互動功能尚未啟用</b><span>請關閉此頁，雙擊資料夾內的「開啟簡報.command」。直接開啟 index.html 會被瀏覽器禁止讀取圖片像素。</span>';
    document.body.appendChild(warning);
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function fitSize(image, maxWidth, maxHeight) {
    const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
    return { width: Math.round(image.width * scale), height: Math.round(image.height * scale) };
  }

  function drawContained(ctx, image, width, height) {
    const scale = Math.min(width / image.width, height / image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  }

  async function setupPixelMicroscope() {
    const canvas = $('#pixel-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const image = await loadImage('assets/web-macaw.jpg');
    canvas.width = 20;
    canvas.height = 12;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const original = ctx.getImageData(0, 0, canvas.width, canvas.height);

    function inspect(event) {
      const rect = canvas.getBoundingClientRect();
      const x = clamp(Math.floor((event.clientX - rect.left) / rect.width * canvas.width), 0, canvas.width - 1);
      const y = clamp(Math.floor((event.clientY - rect.top) / rect.height * canvas.height), 0, canvas.height - 1);
      ctx.putImageData(original, 0, 0);
      const p = ctx.getImageData(x, y, 1, 1).data;
      ctx.strokeStyle = '#ff5da2';
      ctx.lineWidth = 0.12;
      ctx.strokeRect(x + 0.08, y + 0.08, .84, .84);
      $('#pixel-position').textContent = `位置 (${x}, ${y})`;
      $('#pixel-value').textContent = `[ ${p[0]}, ${p[1]}, ${p[2]} ]`;
    }
    canvas.addEventListener('pointermove', inspect);
  }

  function setupGrayComparison() {
    const portrait = $('#gray-portrait');
    const handle = $('#gray-split-handle');
    if (!portrait || !handle) return;
    let split = 50;
    let dragging = false;

    const setSplit = (value) => {
      split = clamp(value, 5, 95);
      portrait.style.setProperty('--gray-split', `${split}%`);
      handle.setAttribute('aria-valuenow', String(Math.round(split)));
    };

    const updateFromPointer = (event) => {
      const rect = portrait.getBoundingClientRect();
      setSplit((event.clientX - rect.left) / rect.width * 100);
    };

    portrait.addEventListener('pointerdown', (event) => {
      dragging = true;
      portrait.setPointerCapture(event.pointerId);
      updateFromPointer(event);
      event.preventDefault();
      event.stopPropagation();
    });
    portrait.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      updateFromPointer(event);
      event.preventDefault();
      event.stopPropagation();
    });
    const stopDragging = (event) => {
      dragging = false;
      if (portrait.hasPointerCapture(event.pointerId)) portrait.releasePointerCapture(event.pointerId);
      event.stopPropagation();
    };
    portrait.addEventListener('pointerup', stopDragging);
    portrait.addEventListener('pointercancel', stopDragging);
    handle.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      if (event.key === 'ArrowLeft') setSplit(split - 5);
      if (event.key === 'ArrowRight') setSplit(split + 5);
      if (event.key === 'Home') setSplit(5);
      if (event.key === 'End') setSplit(95);
      event.preventDefault();
      event.stopPropagation();
    });
    setSplit(50);
  }

  function setupRgbMixer() {
    const sliders = $$('.rgb-slider');
    if (!sliders.length) return;
    const update = () => {
      const values = sliders.map((slider) => Number(slider.value));
      const [r, g, b] = values;
      $('#rgb-swatch').style.background = `rgb(${r}, ${g}, ${b})`;
      $('#rgb-vector').textContent = `[ ${r}, ${g}, ${b} ]`;
      $('#rgb-result').textContent = `[ ${Math.round(.299*r + .587*g + .114*b)} ]`;
      $('#rgb-hex').textContent = '#' + values.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      sliders.forEach((slider, i) => $(`#${slider.id}-value`).textContent = values[i]);
    };
    sliders.forEach((slider) => slider.addEventListener('input', update));
    update();
  }

  async function setupAffineDemo() {
    const canvas = $('#affine-canvas');
    if (!canvas) return;
    const image = await loadImage('assets/reference.jpg');
    const size = fitSize(image, 720, 440);
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size.width, size.height);
    const original = ctx.getImageData(0, 0, size.width, size.height);
    const brightness = $('#brightness');
    const contrast = $('#contrast');
    const output = ctx.createImageData(original.width, original.height);

    const update = () => {
      output.data.set(original.data);
      const b = Number(brightness.value);
      const c = Number(contrast.value) / 100;
      for (let i = 0; i < output.data.length; i += 4) {
        output.data[i] = clamp(c * (original.data[i] - 128) + 128 + b);
        output.data[i + 1] = clamp(c * (original.data[i + 1] - 128) + 128 + b);
        output.data[i + 2] = clamp(c * (original.data[i + 2] - 128) + 128 + b);
      }
      ctx.putImageData(output, 0, 0);
      $('#brightness-value').textContent = b >= 0 ? `+${b}` : b;
      $('#contrast-value').textContent = c.toFixed(2);
    };
    [brightness, contrast].forEach((control) => {
      control.addEventListener('input', update);
      control.addEventListener('change', update);
      control.addEventListener('pointerdown', (event) => event.stopPropagation());
    });
    update();
  }

  async function setupLowLightDemo() {
    const beforeCanvas = $('#lowlight-before');
    const afterCanvas = $('#lowlight-after');
    const curveCanvas = $('#lowlight-curve');
    const status = $('#lowlight-status');
    if (!beforeCanvas || !afterCanvas || !curveCanvas || !status) return;

    const image = await loadImage('assets/lowlight-japan-town.jpg');
    const size = fitSize(image, 470, 320);
    beforeCanvas.width = afterCanvas.width = size.width;
    beforeCanvas.height = afterCanvas.height = size.height;
    curveCanvas.width = 470;
    curveCanvas.height = 320;
    const beforeContext = beforeCanvas.getContext('2d', { willReadFrequently: true });
    const afterContext = afterCanvas.getContext('2d');
    const curveContext = curveCanvas.getContext('2d');
    beforeContext.drawImage(image, 0, 0, size.width, size.height);
    const source = beforeContext.getImageData(0, 0, size.width, size.height);

    const sigmoidExponent = (value) => 1 / (1 + Math.exp(-value));
    const astfValue = (value) => Math.pow(value, sigmoidExponent(value));

    const applyAstf = (input) => {
      const width = input.width;
      const height = input.height;
      const output = beforeContext.createImageData(width, height);
      const brightness = new Float32Array(width * height);
      const mapped = new Float32Array(width * height);
      for (let pixel = 0, i = 0; pixel < brightness.length; pixel++, i += 4) {
        const value = Math.max(input.data[i], input.data[i + 1], input.data[i + 2]) / 255;
        brightness[pixel] = value;
        mapped[pixel] = astfValue(value);
      }
      const sample = (x, y) => brightness[clamp(y, 0, height - 1) * width + clamp(x, 0, width - 1)];
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = y * width + x;
          const i = pixel * 4;
          const value = brightness[pixel];
          const detail = (4 * value - sample(x - 1, y) - sample(x + 1, y) - sample(x, y - 1) - sample(x, y + 1)) / 4;
          const enhanced = clamp(mapped[pixel] + detail, 0, 1);
          const scale = value > 0 ? enhanced / value : 0;
          output.data[i] = clamp(Math.round(input.data[i] * scale));
          output.data[i + 1] = clamp(Math.round(input.data[i + 1] * scale));
          output.data[i + 2] = clamp(Math.round(input.data[i + 2] * scale));
          output.data[i + 3] = input.data[i + 3];
        }
      }
      return output;
    };

    const enhanced = applyAstf(source);

    const drawToneCurve = () => {
      const width = curveCanvas.width;
      const height = curveCanvas.height;
      const left = 46;
      const right = width - 22;
      const top = 22;
      const bottom = height - 42;
      curveContext.fillStyle = '#050712';
      curveContext.fillRect(0, 0, width, height);
      curveContext.strokeStyle = 'rgba(255,255,255,.10)';
      curveContext.lineWidth = 1;
      for (let line = 0; line <= 4; line++) {
        const x = left + (right - left) * line / 4;
        const y = top + (bottom - top) * line / 4;
        curveContext.beginPath();
        curveContext.moveTo(x, top);
        curveContext.lineTo(x, bottom);
        curveContext.moveTo(left, y);
        curveContext.lineTo(right, y);
        curveContext.stroke();
      }
      curveContext.setLineDash([7, 7]);
      curveContext.strokeStyle = 'rgba(255,255,255,.34)';
      curveContext.beginPath();
      curveContext.moveTo(left, bottom);
      curveContext.lineTo(right, top);
      curveContext.stroke();
      curveContext.setLineDash([]);
      const gradient = curveContext.createLinearGradient(left, bottom, right, top);
      gradient.addColorStop(0, '#55e6d5');
      gradient.addColorStop(1, '#ff5da2');
      curveContext.strokeStyle = gradient;
      curveContext.lineWidth = 5;
      curveContext.beginPath();
      for (let value = 0; value <= 255; value++) {
        const mapped = astfValue(value / 255);
        const x = left + (right - left) * value / 255;
        const y = bottom - (bottom - top) * mapped;
        if (value === 0) curveContext.moveTo(x, y);
        else curveContext.lineTo(x, y);
      }
      curveContext.stroke();
      curveContext.fillStyle = '#a8adc2';
      curveContext.font = '700 14px ui-monospace, monospace';
      curveContext.fillText('輸入 V', right - 50, height - 12);
      curveContext.save();
      curveContext.translate(16, top + 64);
      curveContext.rotate(-Math.PI / 2);
      curveContext.fillText('輸出 s', 0, 0);
      curveContext.restore();
    };

    afterContext.putImageData(enhanced, 0, 0);
    drawToneCurve();
  }

  const kernels = {
    blur: { name: '平均模糊', values: [1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9,1/9] },
    sharpen: { name: '銳化', values: [0,-1,0,-1,5,-1,0,-1,0] },
    edge: { name: '邊緣偵測', values: [-1,-1,-1,-1,8,-1,-1,-1,-1] }
  };

  function convolve(imageData, kernel, edgeMode = false) {
    const { width, height, data } = imageData;
    const output = new ImageData(width, height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const outIndex = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const sx = clamp(x + kx, 0, width - 1);
              const sy = clamp(y + ky, 0, height - 1);
              sum += data[(sy * width + sx) * 4 + channel] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          output.data[outIndex + channel] = edgeMode ? clamp(Math.abs(sum)) : clamp(sum);
        }
        output.data[outIndex + 3] = 255;
      }
    }
    return output;
  }

  async function setupConvolutionDemo() {
    const canvas = $('#kernel-canvas');
    if (!canvas) return;
    const image = await loadImage('assets/web-architecture.jpg');
    const size = fitSize(image, 680, 410);
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0, size.width, size.height);
    const original = ctx.getImageData(0, 0, size.width, size.height);
    const grid = $('#kernel-values');
    const frame = $('#kernel-scan-frame');
    const scanner = $('#kernel-scanner');
    const scanPosition = $('#kernel-scan-position');
    const scanToggle = $('#kernel-scan-toggle');
    let scanFrame = null;
    let scanStart = 0;
    let scanElapsed = 0;
    let scanRunning = false;
    const scanDuration = 9000;

    const formatWeight = (value) => {
      if (value === 1 / 9) return '⅑';
      return Number.isInteger(value) ? String(value) : value.toFixed(2);
    };

    const renderScanner = (values) => {
      scanner.innerHTML = values.map((value) => `<span>${formatWeight(value)}</span>`).join('');
    };

    const animateScanner = (timestamp) => {
      if (!scanRunning) return;
      if (!scanStart) scanStart = timestamp - scanElapsed;
      scanElapsed = timestamp - scanStart;
      const laneCount = 8;
      const progress = Math.min(scanElapsed / scanDuration, 1);
      const laneProgress = progress * laneCount;
      const lane = Math.min(laneCount - 1, Math.floor(laneProgress));
      const withinLane = laneProgress - lane;
      const horizontal = lane % 2 === 0 ? withinLane : 1 - withinLane;
      const scannerSize = scanner.offsetWidth || 112;
      const padding = 12;
      const maxX = Math.max(0, frame.clientWidth - scannerSize - padding * 2);
      const maxY = Math.max(0, frame.clientHeight - scannerSize - padding * 2);
      const x = padding + horizontal * maxX;
      const y = padding + lane / (laneCount - 1) * maxY;
      scanner.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      const pixelX = Math.round(horizontal * Math.max(0, original.width - 3));
      const pixelY = Math.round(lane / (laneCount - 1) * Math.max(0, original.height - 3));
      scanPosition.textContent = `3 × 3 掃描位置 (${pixelX}, ${pixelY})`;
      if (progress >= 1) {
        scanRunning = false;
        scanFrame = null;
        scanToggle.textContent = '↻ 再掃一次';
        return;
      }
      scanFrame = requestAnimationFrame(animateScanner);
    };

    const startScanner = (reset = false) => {
      if (reset) {
        scanElapsed = 0;
        scanStart = 0;
      }
      if (scanRunning) return;
      scanRunning = true;
      scanToggle.textContent = '❚❚ 暫停掃描';
      scanFrame = requestAnimationFrame(animateScanner);
    };

    const stopScanner = () => {
      scanRunning = false;
      if (scanFrame) cancelAnimationFrame(scanFrame);
      scanFrame = null;
      scanStart = 0;
      scanToggle.textContent = '▶ 繼續掃描';
    };

    const resetScanner = () => {
      stopScanner();
      scanElapsed = 0;
      scanner.style.transform = 'translate3d(12px, 12px, 0)';
      scanPosition.textContent = '3 × 3 掃描位置 (0, 0)';
      scanToggle.textContent = '▶ 開始掃描';
    };

    function select(key) {
      const config = kernels[key];
      renderScanner(config.values);
      const result = convolve(original, config.values, key === 'edge');
      ctx.putImageData(result, 0, 0);
      grid.innerHTML = config.values.map((value) => `<span>${Number.isInteger(value) ? value : '⅑'}</span>`).join('');
      $('#kernel-name').textContent = config.name;
      $$('.kernel-btn').forEach(button => button.classList.toggle('active', button.dataset.kernel === key));
    }

    $$('.kernel-btn').forEach((button) => button.addEventListener('click', () => select(button.dataset.kernel)));
    scanToggle.addEventListener('click', () => {
      if (scanRunning) stopScanner();
      else startScanner(scanElapsed >= scanDuration);
    });

    if (typeof Reveal !== 'undefined' && typeof Reveal.on === 'function') {
      Reveal.on('slidechanged', ({ currentSlide }) => {
        if (currentSlide?.contains(canvas)) resetScanner();
        else stopScanner();
      });
      if (Reveal.getCurrentSlide()?.contains(canvas)) resetScanner();
    } else {
      resetScanner();
    }
    select('blur');
  }

  function applyPointFilter(original, mode) {
    const output = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
    for (let i = 0; i < output.data.length; i += 4) {
      const r = original.data[i];
      const g = original.data[i + 1];
      const b = original.data[i + 2];
      if (mode === 'gray') {
        const y = .299*r + .587*g + .114*b;
        output.data[i] = output.data[i+1] = output.data[i+2] = y;
      } else if (mode === 'sepia') {
        output.data[i] = clamp(.393*r + .769*g + .189*b);
        output.data[i+1] = clamp(.349*r + .686*g + .168*b);
        output.data[i+2] = clamp(.272*r + .534*g + .131*b);
      } else if (mode === 'invert') {
        output.data[i] = 255-r;
        output.data[i+1] = 255-g;
        output.data[i+2] = 255-b;
      }
    }
    return output;
  }

  function applyBeautyFilter(original) {
    const gaussian = [1/16, 2/16, 1/16, 2/16, 4/16, 2/16, 1/16, 2/16, 1/16];
    const softenedOnce = convolve(original, gaussian);
    const softened = convolve(softenedOnce, gaussian);
    const output = new ImageData(new Uint8ClampedArray(original.data), original.width, original.height);
    const warmth = [14, 9, 4];
    for (let i = 0; i < output.data.length; i += 4) {
      for (let channel = 0; channel < 3; channel++) {
        const smooth = original.data[i + channel] * .32 + softened.data[i + channel] * .68;
        output.data[i + channel] = clamp((smooth - 128) * 1.01 + 128 + warmth[channel]);
      }
    }
    return output;
  }

  async function setupFilterLab() {
    const before = $('#filter-before');
    const after = $('#filter-after');
    if (!before || !after) return;
    const beforeCtx = before.getContext('2d', { willReadFrequently: true });
    const afterCtx = after.getContext('2d', { willReadFrequently: true });
    let original;
    let activeMode = 'beauty';

    async function setImage(src) {
      const image = typeof src === 'string' ? await loadImage(src) : src;
      const size = fitSize(image, 620, 390);
      before.width = after.width = size.width;
      before.height = after.height = size.height;
      beforeCtx.drawImage(image, 0, 0, size.width, size.height);
      afterCtx.drawImage(image, 0, 0, size.width, size.height);
      original = beforeCtx.getImageData(0, 0, size.width, size.height);
      filter(activeMode);
    }

    async function filter(mode) {
      if (!original) return;
      let result;
      if (mode === 'original') result = original;
      else if (mode === 'beauty') result = applyBeautyFilter(original);
      else if (mode === 'sharpen') result = convolve(original, kernels.sharpen.values);
      else if (mode === 'edge') result = convolve(original, kernels.edge.values, true);
      else result = applyPointFilter(original, mode);
      afterCtx.putImageData(result, 0, 0);
      activeMode = mode;
      $$('.filter-btn').forEach(button => button.classList.toggle('active', button.dataset.filter === mode));
      const explanations = {
        original: '原圖：什麼都沒動',
        gray: '灰階：三個顏色各乘一個權重再相加',
        beauty: '美膚：平滑兩次 ＋ 提亮 ＋ 加一點暖色',
        sepia: '懷舊：用一個矩陣把每個顏色換掉',
        invert: '負片：新的值 = 255 − 原來的值',
        sharpen: '銳化：把中心和鄰居的差距放大',
        edge: '邊緣：找相鄰像素之間的變化'
      };
      $('#filter-explanation').textContent = explanations[mode] || '';
    }

    $$('.filter-btn').forEach((button) => button.addEventListener('click', () => filter(button.dataset.filter)));
    $('#filter-upload').addEventListener('change', (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const image = new Image();
      image.onload = () => setImage(image);
      image.src = URL.createObjectURL(file);
    });
    await setImage('assets/selfie-outdoor-woman.jpg');
  }

  async function setupContrastFocusDemo() {
    const imageCanvas = $('#focus-image');
    const chartCanvas = $('#focus-chart');
    const slider = $('#focus-position');
    const sliderValue = $('#focus-position-value');
    const status = $('#focus-status');
    const fitResult = $('#focus-fit-result');
    const autoButton = $('#focus-auto');
    const resetButton = $('#focus-reset');
    if (!imageCanvas || !chartCanvas || !slider || !sliderValue || !status || !fitResult || !autoButton || !resetButton) return;

    const image = await loadImage('assets/web-architecture.jpg');
    const size = fitSize(image, 760, 470);
    imageCanvas.width = size.width;
    imageCanvas.height = size.height;
    chartCanvas.width = 470;
    chartCanvas.height = 166;
    const imageContext = imageCanvas.getContext('2d');
    const chartContext = chartCanvas.getContext('2d');
    const bestPosition = 62;
    const curveWidth = 16;
    const blurRadius = (position) => Math.abs(position - bestPosition) * .11;
    const contrastScore = (position) => 10 + 90 * Math.exp(-.5 * ((position - bestPosition) / curveWidth) ** 2);

    const drawBlurred = (context, width, height, radius) => {
      context.clearRect(0, 0, width, height);
      context.save();
      context.filter = radius > .01 ? `blur(${radius.toFixed(2)}px)` : 'none';
      context.drawImage(image, 0, 0, width, height);
      context.restore();
    };

    const samples = Array.from({ length: 51 }, (_, index) => ({
      position: index * 2,
      raw: contrastScore(index * 2),
      score: contrastScore(index * 2)
    }));
    const scoreAt = (position) => contrastScore(position);
    const rawAt = scoreAt;
    let observed = [];
    let fittedPosition = null;
    let runToken = 0;

    const rememberSample = (position) => {
      const point = { position, score: scoreAt(position), raw: rawAt(position) };
      const existing = observed.findIndex(sample => Math.abs(sample.position - position) < .05);
      if (existing >= 0) observed[existing] = point;
      else observed.push(point);
      return point;
    };

    const drawChart = (position) => {
      const width = chartCanvas.width;
      const height = chartCanvas.height;
      const left = 38;
      const right = width - 18;
      const top = 18;
      const bottom = height - 34;
      chartContext.fillStyle = '#050712';
      chartContext.fillRect(0, 0, width, height);
      chartContext.strokeStyle = 'rgba(255,255,255,.10)';
      chartContext.lineWidth = 1;
      for (let line = 0; line <= 4; line++) {
        const y = top + (bottom - top) * line / 4;
        chartContext.beginPath();
        chartContext.moveTo(left, y);
        chartContext.lineTo(right, y);
        chartContext.stroke();
      }

      const gradient = chartContext.createLinearGradient(left, 0, right, 0);
      gradient.addColorStop(0, '#55e6d5');
      gradient.addColorStop(1, '#ff5da2');
      chartContext.strokeStyle = gradient;
      chartContext.lineWidth = 4;
      chartContext.beginPath();
      samples.forEach((sample, index) => {
        const x = left + (right - left) * sample.position / 100;
        const y = bottom - (bottom - top) * sample.score / 100;
        if (index === 0) chartContext.moveTo(x, y);
        else chartContext.lineTo(x, y);
      });
      chartContext.stroke();

      const peakX = left + (right - left) * bestPosition / 100;
      const peakY = bottom - (bottom - top) * contrastScore(bestPosition) / 100;
      chartContext.setLineDash([5, 5]);
      chartContext.strokeStyle = 'rgba(255,209,102,.65)';
      chartContext.lineWidth = 2;
      chartContext.beginPath();
      chartContext.moveTo(peakX, top);
      chartContext.lineTo(peakX, bottom);
      chartContext.stroke();
      chartContext.setLineDash([]);
      chartContext.fillStyle = '#ffd166';
      chartContext.beginPath();
      chartContext.arc(peakX, peakY, 6, 0, Math.PI * 2);
      chartContext.fill();
      chartContext.font = '800 13px ui-monospace, monospace';
      chartContext.fillText('極大值 x*=62', peakX - 45, top + 14);
      chartContext.fillStyle = '#55e6d5';
      chartContext.fillText("f′(x) > 0", left + 92, top + 48);
      chartContext.fillStyle = '#ff5da2';
      chartContext.fillText("f′(x) < 0", right - 100, top + 48);

      observed.forEach((sample) => {
        const x = left + (right - left) * sample.position / 100;
        const y = bottom - (bottom - top) * sample.score / 100;
        chartContext.fillStyle = '#ffd166';
        chartContext.beginPath();
        chartContext.arc(x, y, 4, 0, Math.PI * 2);
        chartContext.fill();
      });

      if (fittedPosition !== null) {
        const fittedX = left + (right - left) * fittedPosition / 100;
        chartContext.setLineDash([6, 6]);
        chartContext.strokeStyle = 'rgba(255,93,162,.8)';
        chartContext.beginPath();
        chartContext.moveTo(fittedX, top);
        chartContext.lineTo(fittedX, bottom);
        chartContext.stroke();
        chartContext.setLineDash([]);
        chartContext.fillStyle = '#ff5da2';
        chartContext.font = '700 13px ui-monospace, monospace';
        chartContext.fillText('擬合 x*', fittedX - 24, top + 12);
      }

      const score = scoreAt(position);
      const dotX = left + (right - left) * position / 100;
      const dotY = bottom - (bottom - top) * score / 100;
      chartContext.fillStyle = '#ffffff';
      chartContext.beginPath();
      chartContext.arc(dotX, dotY, 7, 0, Math.PI * 2);
      chartContext.fill();
      chartContext.strokeStyle = '#ff5da2';
      chartContext.lineWidth = 3;
      chartContext.stroke();

      chartContext.fillStyle = '#a8adc2';
      chartContext.font = '700 13px ui-monospace, monospace';
      chartContext.fillText('0', left - 3, height - 11);
      chartContext.fillText('鏡頭位置', right - 58, height - 11);
      return score;
    };

    const formatPosition = (position) => Number.isInteger(position) ? String(position) : position.toFixed(1);

    const renderPosition = (position, message = '') => {
      position = clamp(position, 0, 100);
      slider.value = position.toFixed(1);
      const radius = blurRadius(position);
      drawBlurred(imageContext, imageCanvas.width, imageCanvas.height, radius);
      const score = drawChart(position);
      sliderValue.textContent = formatPosition(position);
      status.textContent = message || (Math.abs(position - bestPosition) <= 2
        ? `✓ 極大值附近｜x ≈ ${formatPosition(position)}，f(x) = ${Math.round(score)}`
        : `尚未合焦｜f(x) = ${Math.round(score)}｜往分數上升的方向搜尋`);
      status.style.color = status.textContent.startsWith('✓') ? '#55e6d5' : '#a8adc2';
      return { position, score, raw: rawAt(position) };
    };

    const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

    const samplePosition = async (position, label, token) => {
      if (token !== runToken) return null;
      position = clamp(position, 0, 100);
      const sample = rememberSample(position);
      renderPosition(position, `${label}｜f(${formatPosition(position)}) = ${Math.round(sample.score)}`);
      await wait(260);
      return token === runToken ? sample : null;
    };

    const fitParabolaVertex = (first, middle, last) => {
      const x1 = first.position;
      const x2 = middle.position;
      const x3 = last.position;
      const y1 = first.raw;
      const y2 = middle.raw;
      const y3 = last.raw;
      const numerator = (x2 - x1) ** 2 * (y2 - y3) - (x2 - x3) ** 2 * (y2 - y1);
      const denominator = 2 * ((x2 - x1) * (y2 - y3) - (x2 - x3) * (y2 - y1));
      if (Math.abs(denominator) < 1e-9) return x2;
      return clamp(x2 - numerator / denominator, Math.min(x1, x3), Math.max(x1, x3));
    };

    const stopAutomaticRun = () => {
      runToken++;
      slider.disabled = false;
      autoButton.disabled = false;
      autoButton.textContent = '▶ 自動對焦';
    };

    const reset = () => {
      stopAutomaticRun();
      observed = [];
      fittedPosition = null;
      fitResult.textContent = '還沒開始找最高點';
      renderPosition(20, '失焦起點｜請手動嘗試，或按「自動對焦」');
    };

    const runAutoFocus = async () => {
      const token = ++runToken;
      slider.disabled = true;
      autoButton.disabled = true;
      autoButton.textContent = '搜尋中…';
      observed = [];
      fittedPosition = null;
      fitResult.textContent = '往分數變高的方向走一步，再看一次';
      const step = 8;
      let current = await samplePosition(Number(slider.value), '起點取樣', token);
      if (!current) return;
      const right = await samplePosition(clamp(current.position + step, 0, 100), '向右試探', token);
      if (!right) return;
      const left = await samplePosition(clamp(current.position - step, 0, 100), '向左試探', token);
      if (!left) return;

      let direction;
      if (right.raw > current.raw || left.raw > current.raw) {
        const better = right.raw >= left.raw ? right : left;
        direction = better.position > current.position ? 1 : -1;
        current = better;
      } else {
        direction = right.raw >= left.raw ? 1 : -1;
      }
      renderPosition(current.position, `選擇上坡方向｜Δf > 0，往${direction > 0 ? '右' : '左'}前進`);
      await wait(260);

      while (token === runToken) {
        const nextPosition = clamp(current.position + direction * step, 0, 100);
        if (Math.abs(nextPosition - current.position) < .01) break;
        const next = await samplePosition(nextPosition, '爬山取樣', token);
        if (!next) return;
        const delta = next.raw - current.raw;
        if (delta > 0) {
          current = next;
          renderPosition(current.position, `Δf = +${delta.toFixed(1)}｜分數上升，繼續同方向`);
          await wait(220);
        } else {
          renderPosition(next.position, `Δf = ${delta.toFixed(1)}｜分數下降，已越過峰值`);
          await wait(360);
          break;
        }
      }
      if (token !== runToken) return;

      fitResult.textContent = '在最高點附近取三個點，配一條拋物線';
      const fitStep = 4;
      const first = await samplePosition(clamp(current.position - fitStep, 0, 100), '擬合點 x₁', token);
      const middle = await samplePosition(current.position, '擬合點 x₂', token);
      const last = await samplePosition(clamp(current.position + fitStep, 0, 100), '擬合點 x₃', token);
      if (!first || !middle || !last || token !== runToken) return;
      fittedPosition = fitParabolaVertex(first, middle, last);
      rememberSample(fittedPosition);
      const fitted = renderPosition(fittedPosition, `✓ 自動合焦完成｜x* ≈ ${fittedPosition.toFixed(1)}`);
      fitResult.textContent = `估出最清楚的位置：${fittedPosition.toFixed(1)}，分數約 ${Math.round(fitted.score)}`;
      slider.disabled = false;
      autoButton.disabled = false;
      autoButton.textContent = '▶ 再次自動對焦';
    };

    slider.addEventListener('input', () => {
      stopAutomaticRun();
      observed = [rememberSample(Number(slider.value))];
      fittedPosition = null;
      fitResult.textContent = '手動模式｜還沒開始找最高點';
      renderPosition(Number(slider.value));
    });
    autoButton.addEventListener('click', runAutoFocus);
    resetButton.addEventListener('click', reset);
    if (typeof Reveal !== 'undefined' && typeof Reveal.on === 'function') {
      Reveal.on('slidechanged', ({ currentSlide }) => {
        if (!currentSlide?.contains(imageCanvas)) stopAutomaticRun();
      });
    }
    reset();
  }

  function channelStats(data) {
    const count = data.length / 4;
    const mean = [0, 0, 0];
    const std = [0, 0, 0];
    for (let i = 0; i < data.length; i += 4) {
      mean[0] += data[i]; mean[1] += data[i+1]; mean[2] += data[i+2];
    }
    mean.forEach((_, c) => mean[c] /= count);
    for (let i = 0; i < data.length; i += 4) {
      std[0] += (data[i] - mean[0]) ** 2;
      std[1] += (data[i+1] - mean[1]) ** 2;
      std[2] += (data[i+2] - mean[2]) ** 2;
    }
    std.forEach((_, c) => std[c] = Math.sqrt(std[c] / count) || 1);
    return { mean, std };
  }

  async function setupColorTransfer() {
    const sourceCanvas = $('#transfer-source');
    const resultCanvas = $('#transfer-result');
    if (!sourceCanvas || !resultCanvas) return;
    const sourceImage = await loadImage('assets/source.bmp');
    const referenceImage = await loadImage('assets/reference.jpg');
    const size = fitSize(sourceImage, 590, 380);
    sourceCanvas.width = resultCanvas.width = size.width;
    sourceCanvas.height = resultCanvas.height = size.height;
    const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    const rctx = resultCanvas.getContext('2d', { willReadFrequently: true });
    sctx.drawImage(sourceImage, 0, 0, size.width, size.height);
    const source = sctx.getImageData(0, 0, size.width, size.height);

    const off = document.createElement('canvas');
    const refSize = fitSize(referenceImage, 590, 380);
    off.width = refSize.width;
    off.height = refSize.height;
    const octx = off.getContext('2d', { willReadFrequently: true });
    octx.drawImage(referenceImage, 0, 0, refSize.width, refSize.height);
    const ref = octx.getImageData(0, 0, refSize.width, refSize.height);
    const sourceStats = channelStats(source.data);
    const referenceStats = channelStats(ref.data);
    const transferred = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);

    for (let i = 0; i < transferred.data.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        transferred.data[i+c] = clamp(
          (source.data[i+c] - sourceStats.mean[c]) / sourceStats.std[c] * referenceStats.std[c] + referenceStats.mean[c]
        );
      }
    }

    const mix = $('#transfer-mix');
    const update = () => {
      const t = Number(mix.value) / 100;
      const output = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height);
      for (let i = 0; i < output.data.length; i += 4) {
        output.data[i] = source.data[i] * (1-t) + transferred.data[i] * t;
        output.data[i+1] = source.data[i+1] * (1-t) + transferred.data[i+1] * t;
        output.data[i+2] = source.data[i+2] * (1-t) + transferred.data[i+2] * t;
      }
      rctx.putImageData(output, 0, 0);
      $('#transfer-value').textContent = `${mix.value}%`;
    };
    mix.addEventListener('input', update);
    update();

    $('#source-mean').textContent = sourceStats.mean.map(v => Math.round(v)).join(' · ');
    $('#reference-mean').textContent = referenceStats.mean.map(v => Math.round(v)).join(' · ');
  }

  async function setupThresholdDemo() {
    const beforeCanvas = $('#threshold-before');
    const afterCanvas = $('#threshold-after');
    const slider = $('#threshold-value');
    const output = $('#threshold-output');
    const status = $('#threshold-status');
    const autoButton = $('#threshold-auto');
    const presetButtons = $$('[data-threshold]');
    if (!beforeCanvas || !afterCanvas || !slider || !output || !status || !autoButton) return;

    const image = await loadImage('assets/threshold-ct-brain.jpg');
    const size = fitSize(image, 500, 420);
    beforeCanvas.width = afterCanvas.width = size.width;
    beforeCanvas.height = afterCanvas.height = size.height;
    const beforeContext = beforeCanvas.getContext('2d', { willReadFrequently: true });
    const afterContext = afterCanvas.getContext('2d');
    beforeContext.drawImage(image, 0, 0, size.width, size.height);
    const source = beforeContext.getImageData(0, 0, size.width, size.height);
    const grayscale = beforeContext.createImageData(size.width, size.height);
    const histogram = new Uint32Array(256);

    for (let i = 0; i < source.data.length; i += 4) {
      const value = Math.max(source.data[i], source.data[i + 1], source.data[i + 2]);
      grayscale.data[i] = grayscale.data[i + 1] = grayscale.data[i + 2] = value;
      grayscale.data[i + 3] = 255;
      histogram[value]++;
    }
    const otsuThreshold = () => {
      const total = size.width * size.height;
      let weightedTotal = 0;
      for (let value = 0; value < 256; value++) weightedTotal += value * histogram[value];
      let backgroundWeight = 0;
      let backgroundSum = 0;
      let bestVariance = -1;
      let bestThreshold = 0;
      for (let threshold = 0; threshold < 256; threshold++) {
        backgroundWeight += histogram[threshold];
        if (!backgroundWeight) continue;
        const foregroundWeight = total - backgroundWeight;
        if (!foregroundWeight) break;
        backgroundSum += threshold * histogram[threshold];
        const backgroundMean = backgroundSum / backgroundWeight;
        const foregroundMean = (weightedTotal - backgroundSum) / foregroundWeight;
        const variance = backgroundWeight * foregroundWeight * Math.pow(backgroundMean - foregroundMean, 2);
        if (variance > bestVariance) {
          bestVariance = variance;
          bestThreshold = threshold;
        }
      }
      return bestThreshold;
    };

    const update = (automatic = false) => {
      const threshold = Number(slider.value);
      const mask = afterContext.createImageData(size.width, size.height);
      let selected = 0;
      for (let i = 0; i < grayscale.data.length; i += 4) {
        const foreground = grayscale.data[i] >= threshold;
        if (foreground) selected++;
        mask.data[i] = foreground ? 85 : 6;
        mask.data[i + 1] = foreground ? 230 : 8;
        mask.data[i + 2] = foreground ? 213 : 18;
        mask.data[i + 3] = 255;
      }
      afterContext.putImageData(mask, 0, 0);
      output.textContent = threshold;
      const percentage = selected / (size.width * size.height) * 100;
      status.textContent = `${automatic ? 'Otsu 自動找出的門檻' : `T = ${threshold}`}｜選中了 ${percentage.toFixed(1)}%`;
      presetButtons.forEach((button) => button.classList.toggle('active', Number(button.dataset.threshold) === threshold && !automatic));
      autoButton.classList.toggle('active', automatic);
    };

    slider.addEventListener('input', () => update(false));
    presetButtons.forEach((button) => button.addEventListener('click', () => {
      slider.value = button.dataset.threshold;
      update(false);
    }));
    autoButton.addEventListener('click', () => {
      slider.value = otsuThreshold();
      update(true);
    });
    update(false);
  }

  function createCtPhantom(size) {
    const data = new Float32Array(size * size);
    const addEllipse = (cx, cy, rx, ry, value, rotation = 0) => {
      const cos = Math.cos(rotation);
      const sin = Math.sin(rotation);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const nx = (x / (size - 1)) * 2 - 1 - cx;
          const ny = (y / (size - 1)) * 2 - 1 - cy;
          const ex = nx * cos + ny * sin;
          const ey = -nx * sin + ny * cos;
          if ((ex * ex) / (rx * rx) + (ey * ey) / (ry * ry) <= 1) {
            const index = y * size + x;
            data[index] = clamp(data[index] + value, 0, 1);
          }
        }
      }
    };

    addEllipse(0, 0, .76, .90, .16);
    addEllipse(0, -.02, .62, .78, .44);
    addEllipse(-.25, -.18, .14, .20, .33, -.2);
    addEllipse(.24, -.20, .11, .17, -.22, .25);
    addEllipse(0, .27, .30, .12, -.18);
    addEllipse(.04, .03, .08, .32, .24, .12);
    addEllipse(-.38, .34, .09, .13, .30, -.35);
    addEllipse(.35, .31, .10, .10, -.20);
    return data;
  }

  function drawCtMatrix(canvas, matrix, width, height, palette = 'gray') {
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    let min = Infinity;
    let max = -Infinity;
    if (palette === 'recon') {
      const sorted = [...matrix].sort((a, b) => a - b);
      min = sorted[Math.floor(sorted.length * .03)];
      max = sorted[Math.floor(sorted.length * .985)];
    } else {
      for (let i = 0; i < matrix.length; i++) {
        min = Math.min(min, matrix[i]);
        max = Math.max(max, matrix[i]);
      }
    }
    const range = max - min || 1;
    for (let i = 0; i < matrix.length; i++) {
      const t = clamp((matrix[i] - min) / range, 0, 1);
      if (palette === 'scan') {
        image.data[i * 4] = 25 + 230 * t;
        image.data[i * 4 + 1] = 25 + 205 * Math.pow(t, .85);
        image.data[i * 4 + 2] = 48 + 170 * Math.pow(t, .65);
      } else {
        const value = Math.round(255 * Math.pow(t, .78));
        image.data[i * 4] = value;
        image.data[i * 4 + 1] = value;
        image.data[i * 4 + 2] = value;
      }
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  function computeCtProjections(phantom, size, views) {
    const projections = new Float32Array(views * size);
    for (let a = 0; a < views; a++) {
      const theta = Math.PI * a / views;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const value = phantom[y * size + x];
          if (value <= 0) continue;
          const nx = (x / (size - 1)) * 2 - 1;
          const ny = (y / (size - 1)) * 2 - 1;
          const detector = Math.round(((nx * cos + ny * sin) / Math.SQRT2 + 1) * .5 * (size - 1));
          if (detector >= 0 && detector < size) projections[a * size + detector] += value;
        }
      }
    }
    return projections;
  }

  function rampFilterCt(projections, size, views) {
    const filtered = new Float32Array(projections.length);
    const radius = 23;
    for (let a = 0; a < views; a++) {
      const offset = a * size;
      for (let i = 0; i < size; i++) {
        let value = .25 * projections[offset + i];
        for (let k = 1; k <= radius; k += 2) {
          const coefficient = -1 / (Math.PI * Math.PI * k * k);
          if (i - k >= 0) value += coefficient * projections[offset + i - k];
          if (i + k < size) value += coefficient * projections[offset + i + k];
        }
        filtered[offset + i] = value;
      }
    }
    return filtered;
  }

  function backProjectCt(filtered, size, views) {
    const reconstruction = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const nx = (x / (size - 1)) * 2 - 1;
        const ny = (y / (size - 1)) * 2 - 1;
        if (nx * nx + ny * ny > 1.12) continue;
        let value = 0;
        for (let a = 0; a < views; a++) {
          const theta = Math.PI * a / views;
          const detectorFloat = ((nx * Math.cos(theta) + ny * Math.sin(theta)) / Math.SQRT2 + 1) * .5 * (size - 1);
          const left = Math.floor(detectorFloat);
          const right = Math.min(size - 1, left + 1);
          const mix = detectorFloat - left;
          if (left >= 0 && right < size) {
            const offset = a * size;
            value += filtered[offset + left] * (1 - mix) + filtered[offset + right] * mix;
          }
        }
        reconstruction[y * size + x] = Math.max(0, value / views);
      }
    }
    return reconstruction;
  }

  function smoothCt(matrix, size, passes) {
    let current = matrix;
    for (let pass = 0; pass < passes; pass++) {
      const next = new Float32Array(current.length);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          let sum = 0;
          let weight = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const sx = clamp(x + kx, 0, size - 1);
              const sy = clamp(y + ky, 0, size - 1);
              const w = (kx === 0 ? 2 : 1) * (ky === 0 ? 2 : 1);
              sum += current[sy * size + sx] * w;
              weight += w;
            }
          }
          next[y * size + x] = sum / weight;
        }
      }
      current = next;
    }
    return current;
  }

  function setupCtDemo() {
    const phantomCanvas = $('#ct-phantom');
    const sinogramCanvas = $('#ct-sinogram');
    const reconstructionCanvas = $('#ct-reconstruction');
    const slider = $('#ct-views');
    if (!phantomCanvas || !sinogramCanvas || !reconstructionCanvas || !slider) return;

    const size = 96;
    const phantom = createCtPhantom(size);
    const sourceDot = $('#ct-source-dot');
    const quality = $('#ct-quality');
    const output = $('#ct-views-value');
    let animation = null;

    drawCtMatrix(phantomCanvas, phantom, size, size);

    const update = (views) => {
      const projections = computeCtProjections(phantom, size, views);
      const filtered = rampFilterCt(projections, size, views);
      const reconstruction = smoothCt(backProjectCt(filtered, size, views), size, views >= 48 ? 3 : views >= 24 ? 2 : 1);
      const sinogram = new Float32Array(projections.length);
      for (let angle = 0; angle < views; angle++) {
        for (let detector = 0; detector < size; detector++) {
          sinogram[detector * views + angle] = projections[angle * size + detector];
        }
      }
      drawCtMatrix(sinogramCanvas, sinogram, views, size, 'scan');
      drawCtMatrix(reconstructionCanvas, reconstruction, size, size, 'recon');
      output.textContent = views;
      sourceDot.style.setProperty('--scan-angle', `${360 * (views - 1) / views}deg`);
      quality.textContent = views <= 8
        ? '線索太少：放射狀的紋路比東西本身還搶眼。'
        : views <= 24
          ? '輪廓出來了，但還看得到一條一條的紋路。'
          : views <= 48
            ? '大致的形狀穩住了，細節也開始分得出來。'
            : '角度越多，能用的線索就越多，重建也越接近原本的切面。';
      $$('[data-ct-views]').forEach(button => button.classList.toggle('active', Number(button.dataset.ctViews) === views));
    };

    slider.addEventListener('input', () => {
      if (animation) clearInterval(animation);
      animation = null;
      update(Number(slider.value));
    });

    $$('[data-ct-views]').forEach(button => {
      button.addEventListener('click', () => {
        if (animation) clearInterval(animation);
        animation = null;
        slider.value = button.dataset.ctViews;
        update(Number(slider.value));
      });
    });

    $('#ct-auto-scan').addEventListener('click', () => {
      if (animation) clearInterval(animation);
      let views = 4;
      slider.value = views;
      update(views);
      $('#ct-auto-scan').textContent = '掃描中…';
      animation = setInterval(() => {
        views += 4;
        slider.value = views;
        update(views);
        if (views >= 144) {
          clearInterval(animation);
          animation = null;
          $('#ct-auto-scan').textContent = '↻ 再掃一次';
        }
      }, 120);
    });

    update(Number(slider.value));
  }

  function setupInversePuzzle() {
    const grid = $('#inverse-grid');
    const rowContainer = $('#inverse-row-sums');
    const colContainer = $('#inverse-col-sums');
    if (!grid || !rowContainer || !colContainer) return;

    const size = 6;
    const solution = [
      0,1,0,0,1,0,
      0,1,0,0,1,0,
      0,0,0,0,0,0,
      1,0,0,0,0,1,
      0,1,0,0,1,0,
      0,0,1,1,0,0
    ];
    const alternative = solution.slice();
    alternative[1] = 0;
    alternative[2] = 1;
    alternative[31] = 1;
    alternative[32] = 0;
    const state = new Array(size * size).fill(0);
    const rowTargets = Array.from({ length: size }, (_, row) => solution.slice(row * size, row * size + size).reduce((a, b) => a + b, 0));
    const colTargets = Array.from({ length: size }, (_, col) => solution.reduce((sum, value, index) => sum + (index % size === col ? value : 0), 0));
    const rowLabels = rowTargets.map(value => Object.assign(document.createElement('span'), { textContent: value }));
    const colLabels = colTargets.map(value => Object.assign(document.createElement('span'), { textContent: value }));
    rowLabels.forEach(label => rowContainer.appendChild(label));
    colLabels.forEach(label => colContainer.appendChild(label));

    const buttons = state.map((_, index) => {
      const button = document.createElement('button');
      const row = Math.floor(index / size) + 1;
      const col = index % size + 1;
      button.type = 'button';
      button.setAttribute('aria-label', `第 ${row} 列，第 ${col} 欄`);
      button.addEventListener('click', () => {
        state[index] = state[index] ? 0 : 1;
        render();
      });
      grid.appendChild(button);
      return button;
    });

    const render = (message = '') => {
      buttons.forEach((button, index) => button.classList.toggle('on', Boolean(state[index])));
      const rowSums = Array.from({ length: size }, (_, row) => state.slice(row * size, row * size + size).reduce((a, b) => a + b, 0));
      const colSums = Array.from({ length: size }, (_, col) => state.reduce((sum, value, index) => sum + (index % size === col ? value : 0), 0));
      rowLabels.forEach((label, index) => label.classList.toggle('match', rowSums[index] === rowTargets[index]));
      colLabels.forEach((label, index) => label.classList.toggle('match', colSums[index] === colTargets[index]));
      const allMatched = rowSums.every((value, index) => value === rowTargets[index]) && colSums.every((value, index) => value === colTargets[index]);
      const lit = state.reduce((a, b) => a + b, 0);
      $('#inverse-status').textContent = message || (allMatched
        ? '✓ 所有影子都吻合！但按「換一個同樣的解」看看驚喜。'
        : `目前點亮 ${lit} 格；綠色數字代表那一排已經吻合。`);
      $('#inverse-status').style.color = allMatched ? '#55e6d5' : '#ffd166';
      $('#inverse-status').style.borderColor = allMatched ? '#55e6d5' : '#ffd166';
    };

    const setPattern = (pattern, message) => {
      pattern.forEach((value, index) => state[index] = value);
      render(message);
    };

    $('#inverse-hint').addEventListener('click', () => {
      const next = solution.findIndex((value, index) => value === 1 && state[index] === 0);
      if (next >= 0) {
        state[next] = 1;
        buttons[next].classList.add('hint');
        setTimeout(() => buttons[next].classList.remove('hint'), 1600);
      }
      render('提示已點亮一格；繼續讓列和、行和變成綠色。');
    });
    $('#inverse-solution').addEventListener('click', () => setPattern(solution, '這是一個笑臉解。所有影子都吻合。'));
    $('#inverse-alternative').addEventListener('click', () => setPattern(alternative, '另一個圖案，卻有完全相同的影子：解不一定唯一！'));
    $('#inverse-reset').addEventListener('click', () => {
      state.fill(0);
      state[1] = 1;
      state[4] = 1;
      render('已保留兩隻眼睛。接著讓每排數字吻合。');
    });

    state[1] = 1;
    state[4] = 1;
    render('兩隻眼睛已給你。接著讓每排數字吻合。');
  }

  function setupQuiz() {
    $$('.quiz button').forEach((button) => {
      button.addEventListener('click', () => {
        const box = button.closest('.question');
        const correct = button.dataset.correct === 'true';
        $('.quiz-feedback', box).textContent = correct ? '✓ 正確：看權重如何組合鄰居。' : '再想一下：先看中心與周圍的正負號。';
        $('.quiz-feedback', box).style.color = correct ? '#55e6d5' : '#ffd166';
      });
    });
  }

  async function init() {
    setupInteractionSafety();
    showLocalFileWarning();
    setupGrayComparison();
    setupRgbMixer();
    setupQuiz();
    setupCtDemo();
    setupInversePuzzle();
    const results = await Promise.allSettled([
      setupPixelMicroscope(),
      setupAffineDemo(),
      setupLowLightDemo(),
      setupConvolutionDemo(),
      setupFilterLab(),
      setupContrastFocusDemo(),
      setupColorTransfer(),
      setupThresholdDemo()
    ]);
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = ['像素顯微鏡', '亮度與對比', '低光增強', '卷積', '濾鏡實驗室', '反差對焦', '色彩轉移', '門檻分割'];
        console.error(`${names[index]}初始化失敗`, result.reason);
      }
    });
  }

  window.addEventListener('DOMContentLoaded', init);
})();
