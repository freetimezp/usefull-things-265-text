import * as THREE from "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.152.0/three.module.js";
import { frag, vert } from "./shaders.js";

const canvas = document.getElementById("webgl");
const canvas2 = document.getElementById("webgl2"); // optional second renderer for shards (we'll use DOM for shards here)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(innerWidth, innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(
    -innerWidth / 2,
    innerWidth / 2,
    innerHeight / 2,
    -innerHeight / 2,
    -1000,
    1000
);
camera.position.z = 1;

// Plane that fills view
const planeGeom = new THREE.PlaneGeometry(innerWidth, innerHeight, 1, 1);

// Simplex / noise function (GLSL) & fragment shader for liquid ripple/distortion

const uniforms = {
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(innerWidth, innerHeight) },
    uMouse: { value: new THREE.Vector2(innerWidth * 0.5, innerHeight * 0.5) },
};

const mat = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    uniforms: uniforms,
    transparent: false,
});

const mesh = new THREE.Mesh(planeGeom, mat);
scene.add(mesh);

// resizing
window.addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight);
    camera.left = -innerWidth / 2;
    camera.right = innerWidth / 2;
    camera.top = innerHeight / 2;
    camera.bottom = -innerHeight / 2;
    camera.updateProjectionMatrix();
    uniforms.uResolution.value.set(innerWidth, innerHeight);
});

// Mouse tracking
const mouse = { x: innerWidth * 0.5, y: innerHeight * 0.5 };
window.addEventListener("pointermove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    uniforms.uMouse.value.set(mouse.x, mouse.y);
    // cursor visual
    const c = document.getElementById("cursor");
    c.style.left = `${mouse.x}px`;
    c.style.top = `${mouse.y}px`;
});

// ======================
// Floating shards (DOM canvases) - creates layered glass shards behind text
// ======================
const shardsContainer = document.getElementById("shards");
const shardCount = 12;
const shards = [];

function createShard(i) {
    const el = document.createElement("canvas");
    el.width = 512;
    el.height = 512;
    el.style.position = "absolute";
    el.style.pointerEvents = "none";
    el.style.opacity = 0.9;
    el.style.filter = "blur(0.6px)";
    el.style.mixBlendMode = "screen";

    // generate gradient glass texture
    const ctx = el.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, el.width, el.height);
    const c1 = `rgba(255,255,255,${0.05 + Math.random() * 0.06})`;
    const c2 = `rgba(155,231,255,${0.04 + Math.random() * 0.05})`;
    g.addColorStop(0, c1);
    g.addColorStop(0.5, c2);
    g.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, el.width, el.height);

    // add some noise streaks
    for (let s = 0; s < 18; s++) {
        ctx.globalAlpha = 0.02 + Math.random() * 0.02;
        ctx.beginPath();
        ctx.moveTo(Math.random() * el.width, Math.random() * el.height);
        ctx.bezierCurveTo(
            Math.random() * el.width,
            Math.random() * el.height,
            Math.random() * el.width,
            Math.random() * el.height,
            Math.random() * el.width,
            Math.random() * el.height
        );
        ctx.lineWidth = 1 + Math.random() * 2;
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.stroke();
    }

    // shape mask: irregular polygon
    const mask = document.createElement("canvas");
    mask.width = 512;
    mask.height = 512;
    const mctx = mask.getContext("2d");
    mctx.fillStyle = "black";
    mctx.beginPath();
    const cx = 256,
        cy = 256;
    const rad = 180 + Math.random() * 40;
    mctx.moveTo(cx + rad, cy);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        mctx.lineTo(
            cx + Math.cos(a + Math.random() * 0.6) * (rad - Math.random() * 80),
            cy + Math.sin(a + Math.random() * 0.6) * (rad - Math.random() * 80)
        );
    }
    mctx.closePath();
    mctx.fill();

    // apply mask
    const tmp = ctx.getImageData(0, 0, el.width, el.height);
    const maskData = mctx.getImageData(0, 0, mask.width, mask.height);
    for (let p = 0; p < tmp.data.length; p += 4) {
        const a = maskData.data[p + 3] / 255; // mask alpha
        tmp.data[p + 3] = tmp.data[p + 3] * a;
    }
    ctx.putImageData(tmp, 0, 0);

    shardsContainer.appendChild(el);

    const shard = {
        el,
        x: (Math.random() - 0.5) * innerWidth * 0.6,
        y: (Math.random() - 0.5) * innerHeight * 0.4,
        rotZ: (Math.random() - 0.5) * 0.8,
        speed: 0.2 + Math.random() * 0.6,
        scale: 0.4 + Math.random() * 0.9,
        baseAlpha: 0.3 + Math.random() * 0.6,
    };
    shards.push(shard);
}

for (let i = 0; i < shardCount; i++) createShard(i);

// ======================
// Animation loop
// ======================
let time = 0;
function tick(t) {
    const dt = 0.001 * (t - time);
    time = t;
    uniforms.uTime.value = t * 0.001;

    // animate shards positions
    shards.forEach((s, idx) => {
        const wob = Math.sin(t * 0.0005 * (1 + idx * 0.1) * s.speed);
        const px = innerWidth / 2 + s.x + wob * 80 + (mouse.x - innerWidth / 2) * 0.08 * ((idx % 3) + 1);
        const py =
            innerHeight / 2 +
            s.y +
            Math.cos(t * 0.0003 * (1 + idx * 0.07)) * 60 * (idx % 2 ? 1 : -1) +
            (mouse.y - innerHeight / 2) * 0.06 * ((idx % 4) + 1);
        s.el.style.left = `${px - (s.el.width * s.scale) / 2}px`;
        s.el.style.top = `${py - (s.el.height * s.scale) / 2}px`;
        s.el.style.width = `${s.el.width * s.scale}px`;
        s.el.style.height = `${s.el.height * s.scale}px`;
        s.el.style.transform = `rotate(${s.rotZ + wob * 0.18}rad)`;
        s.el.style.opacity = `${s.baseAlpha * (0.6 + 0.4 * Math.sin(t * 0.0008 + idx))}`;
    });

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
}

requestAnimationFrame(tick);

// small intro animation for title and glass panel
const title = document.querySelector(".title");
title.style.transform = "translateZ(80px) scale(0.98)";
title.style.transition = "transform 800ms cubic-bezier(.2,.9,.2,1), opacity 600ms";
setTimeout(() => {
    title.style.transform = "translateZ(80px) scale(1)";
}, 200);

// handy: pause animation when tab hidden
document.addEventListener("visibilitychange", () => {
    if (document.hidden) renderer.setAnimationLoop(null);
});
