const fs = require('fs');
const path = require('path');
const htmlFile = path.join(__dirname, 'index.html');
const cssFile = path.join(__dirname, 'src', 'style.css');
let html = fs.readFileSync(htmlFile, 'utf8');
let css = fs.readFileSync(cssFile, 'utf8');

// 1. Update Home Page Background Animation
html = html.replace(
  /<!-- BACKGROUND BLOBS -->\s*<div class="pointer-events-none absolute inset-0">\s*<div class="absolute -top-40 left-1\/2 h-\[28rem\] w-\[28rem\] -translate-x-1\/2 rounded-full blur-3xl"><\/div>\s*<div class="absolute bottom-\[-10rem\] right-\[-8rem\] h-\[24rem\] w-\[24rem\] rounded-full blur-3xl"><\/div>\s*<div class="absolute inset-0 bg-\[radial-gradient\(circle_at_top,rgba\(255,255,255,0\.05\),transparent_35%\)\]"><\/div>\s*<\/div>/g,
  `<!-- BACKGROUND BLOBS -->
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <!-- Living, breathing animated background orbs matching Gesture OS -->
      <div class="absolute -top-[15%] left-[40%] h-[40rem] w-[40rem] -translate-x-1/2 rounded-full blur-[100px] mix-blend-screen bg-gradient-to-br from-[#A27B5C]/25 to-transparent animate-[heroOrbFloat_12s_ease-in-out_infinite] opacity-60"></div>
      <div class="absolute bottom-[-20%] right-[-10%] h-[35rem] w-[35rem] rounded-full blur-[100px] mix-blend-screen bg-gradient-to-tl from-[#E8BCB9]/20 to-[#3F4F44]/40 animate-[heroOrbDrift_18s_ease-in-out_infinite_reverse] opacity-70"></div>
      <div class="absolute top-[20%] left-[-10%] h-[25rem] w-[25rem] rounded-full blur-[90px] mix-blend-screen bg-gradient-to-r from-[#2C3930]/40 to-[#A27B5C]/15 animate-[heroOrbFloat_15s_ease-in-out_infinite] opacity-50"></div>
      
      <!-- Particle grid overlay -->
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_40%)]"></div>
      <div class="absolute inset-0 intro-scan-grid" style="mask-image: linear-gradient(to bottom, black 10%, transparent 90%);"></div>
    </div>`
);

// 2. Enhance the Master Guide UI explicitly
html = html.replace(
  /<div class="guide-kicker">Master Guide<\/div>/g,
  `<div class="guide-kicker shadow-[0_0_15px_rgba(162,123,92,0.3)] animate-[glowPulse_4s_infinite]">
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
    Runtime Guide
  </div>`
);

html = html.replace(
  /class="guide-hero-visual" aria-hidden="true"/g,
  `class="guide-hero-visual perspective-1000" aria-hidden="true"`
);

html = html.replace(
  /class="guide-visual-frame"/g,
  `class="guide-visual-frame transform-gpu transition-all duration-700 hover:rotate-y-6 hover:rotate-x-[-4deg] hover:scale-[1.02] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"`
);

// Animated the hand nodes in the guide
css = css.replace(
  /\.guide-preview-node \{/g,
  `.guide-preview-node {
  animation: gestureNodeBlink 4s ease-in-out infinite;`
);

// Add stagger to guide flow cards
css += `
.perspective-1000 { perspective: 1000px; }
.rotate-y-6 { transform: rotateY(6deg); }
.rotate-x-\\[-4deg\\] { transform: rotateX(-4deg); }

.guide-flow-card, .guide-gesture-card, .guide-project-card {
  transition: transform 0.4s var(--ease-out), box-shadow 0.4s var(--ease-out), border-color 0.4s var(--ease-out);
}
.guide-flow-card:hover, .guide-gesture-card:hover, .guide-project-card:hover {
  transform: translateY(-6px) scale(1.01);
  box-shadow: 0 20px 40px rgba(0,0,0,0.3), 0 0 20px rgba(162, 123, 92, 0.15);
  border-color: rgba(220, 215, 201, 0.25);
}
.guide-gesture-visual {
  background: radial-gradient(circle at center, rgba(162,123,92,0.1) 0%, transparent 70%);
  animation: gestureRingPulse 6s infinite alternate;
}
.guide-hero-actions button {
  position: relative;
  overflow: hidden;
}
.guide-primary-btn::before, .guide-secondary-btn::before {
  content: '';
  position: absolute;
  top: 0; left: -100%;
  width: 50%; height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  transform: skewX(-20deg);
  transition: 0.5s;
}
.guide-primary-btn:hover::before, .guide-secondary-btn:hover::before {
  left: 150%;
  transition: 0.7s ease-in-out;
}
.guide-preview-hand .guide-preview-node {
  animation: gestureNodeBlink 3s ease-in-out infinite alternate;
}
.guide-preview-hand .guide-preview-bone {
  box-shadow: 0 0 8px rgba(162,123,92,0.4);
}
.guide-orbit {
  box-shadow: inset 0 0 20px rgba(162, 123, 92, 0.1);
  animation: spinReverse 40s linear infinite;
}
`;

fs.writeFileSync(htmlFile, html);
fs.writeFileSync(cssFile, css);

console.log('UI updated successfully!');
