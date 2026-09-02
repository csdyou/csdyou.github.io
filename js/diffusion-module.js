// 生成式 AI｜Diffusion 概念示範
// 前向過程（加噪）依 DDPM 的公式：x_t = sqrt(a_t)·x_0 + sqrt(1−a_t)·ε，ε 為高斯雜訊。
// 反向過程在這裡是「把同一條路倒著播」，用來說明概念，不是真的模型推論。
(() => {
  const $ = (selector, root = document) => root.querySelector(selector);

  const loadImage = (source) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

  // Box–Muller：產生標準常態分布的隨機數
  function gaussian() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  async function setup() {
    const canvas = $('#diffusion-canvas');
    const slider = $('#diffusion-step');
    const output = $('#diffusion-step-value');
    const status = $('#diffusion-status');
    const playButton = $('#diffusion-play');
    const noiseButton = $('#diffusion-noise');
    const stageLabel = $('#diffusion-stage');
    if (!canvas || !slider || !playButton) return;

    const image = await loadImage('assets/web-macaw.jpg');
    const width = 620;
    const height = Math.round(width * image.height / image.width);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, width, height);

    const clean = context.getImageData(0, 0, width, height);
    const frame = context.createImageData(width, height);
    // 固定一份雜訊，拖曳時畫面才會連續變化而不是每格重抽
    const noise = new Float32Array(clean.data.length);
    for (let i = 0; i < noise.length; i += 4) {
      noise[i] = gaussian();
      noise[i + 1] = gaussian();
      noise[i + 2] = gaussian();
    }

    // 餘弦排程：前段加得慢、後段加得快，和實務上的做法一致
    const alphaBar = (t) => Math.cos((t / 100) * Math.PI / 2) ** 2;

    function render(t) {
      const a = alphaBar(t);
      const keep = Math.sqrt(a);
      const mix = Math.sqrt(1 - a) * 128;
      for (let i = 0; i < clean.data.length; i += 4) {
        frame.data[i] = keep * clean.data[i] + mix * noise[i] + (1 - keep) * 128;
        frame.data[i + 1] = keep * clean.data[i + 1] + mix * noise[i + 1] + (1 - keep) * 128;
        frame.data[i + 2] = keep * clean.data[i + 2] + mix * noise[i + 2] + (1 - keep) * 128;
        frame.data[i + 3] = 255;
      }
      context.putImageData(frame, 0, 0);
      output.textContent = t;
      if (stageLabel) {
        stageLabel.textContent = t <= 5 ? '原圖' : t >= 95 ? '純雜訊' : `第 ${t} 步`;
      }
    }

    let timer = null;
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } playButton.textContent = '▶ 從雜訊生成'; };

    function play() {
      stop();
      let t = 100;
      slider.value = t;
      render(t);
      status.textContent = '從一團純雜訊開始，每一步只做一件事：把它變得稍微乾淨一點。';
      playButton.textContent = '⏸ 停止';
      timer = setInterval(() => {
        t -= 2;
        if (t <= 0) {
          t = 0;
          render(0);
          slider.value = 0;
          status.textContent = '一張圖就這樣長出來了。真正的模型不是倒帶，而是每一步都用學到的規則猜「乾淨一點的樣子」。';
          stop();
          return;
        }
        slider.value = t;
        render(t);
      }, 60);
    }

    slider.addEventListener('input', () => {
      stop();
      const t = Number(slider.value);
      render(t);
      status.textContent = t === 0
        ? '第 0 步：原圖。往右拖，看資訊怎麼一步一步被雜訊蓋掉。'
        : t >= 95
          ? '資訊幾乎全被蓋掉了。反過來走，就是生成。'
          : '每一步只加一點點雜訊——所以反過來，每一步也只要去掉一點點。';
    });

    playButton.addEventListener('click', () => { if (timer) { stop(); } else { play(); } });
    if (noiseButton) {
      noiseButton.addEventListener('click', () => {
        stop();
        slider.value = 100;
        render(100);
        status.textContent = '這就是模型的起點：一張什麼都沒有的雜訊。';
      });
    }

    if (typeof Reveal !== 'undefined' && typeof Reveal.on === 'function') {
      Reveal.on('slidechanged', ({ currentSlide }) => {
        if (!currentSlide?.contains(canvas)) { stop(); slider.value = 0; render(0); }
      });
    }

    render(0);
    status.textContent = '往右拖：照片一步一步溶進雜訊。按「從雜訊生成」看反過來走。';
  }

  window.addEventListener('DOMContentLoaded', () => {
    setup().catch((error) => console.error('Diffusion 示範初始化失敗', error));
  });
})();
