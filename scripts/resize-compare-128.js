'use strict';

const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const logic = require('../media/resizePanelLogic.js');

const TARGET = 128;
const SRC = process.argv[2] || path.join(__dirname, '../assets/sawfish-source.png');
const OUT_DIR = path.join(__dirname, '../assets');
const VIEW = 6;
/** Unsharp amount for final 128×128 (tune for cartoon edges). */
const SHARPEN_AMOUNT = 0.55;
const SHARPEN_RADIUS = 1;

function drawToSize(src, w, h) {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, w, h);
    return canvas;
}

function resizeBySteps(source, steps) {
    let current = source;
    for (const step of steps) {
        current = drawToSize(current, step.w, step.h);
    }
    return current;
}

function resizeHalve(source, targetW, targetH) {
    const steps = logic.computeHalveDownscaleSteps(
        source.width, source.height, targetW, targetH
    );
    return resizeBySteps(source, steps);
}

function resizeFactor(source, targetW, targetH, factor) {
    const steps = logic.computeDownscaleSteps(
        source.width, source.height, targetW, targetH, factor
    );
    return resizeBySteps(source, steps);
}

function clampByte(v) {
    return Math.max(0, Math.min(255, Math.round(v)));
}

/** Separable box blur on ImageData (radius in pixels). */
function boxBlurImageData(data, w, h, radius) {
    const src = new Uint8ClampedArray(data.data);
    const out = new Uint8ClampedArray(src.length);
    const size = radius * 2 + 1;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0;
            let g = 0;
            let b = 0;
            for (let k = -radius; k <= radius; k++) {
                const sx = Math.min(w - 1, Math.max(0, x + k));
                const i = (y * w + sx) * 4;
                r += src[i];
                g += src[i + 1];
                b += src[i + 2];
            }
            const o = (y * w + x) * 4;
            out[o] = r / size;
            out[o + 1] = g / size;
            out[o + 2] = b / size;
            out[o + 3] = src[o + 3];
        }
    }

    const tmp = new Uint8ClampedArray(out);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let r = 0;
            let g = 0;
            let b = 0;
            for (let k = -radius; k <= radius; k++) {
                const sy = Math.min(h - 1, Math.max(0, y + k));
                const i = (sy * w + x) * 4;
                r += tmp[i];
                g += tmp[i + 1];
                b += tmp[i + 2];
            }
            const o = (y * w + x) * 4;
            out[o] = r / size;
            out[o + 1] = g / size;
            out[o + 2] = b / size;
        }
    }

    return { data: out, width: w, height: h };
}

/** Unsharp mask sharpen on canvas (final step only). */
function applyUnsharpMask(canvas, amount, radius) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const original = ctx.getImageData(0, 0, w, h);
    const blurred = boxBlurImageData(original, w, h, radius);
    const out = ctx.createImageData(w, h);

    for (let i = 0; i < original.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
            const idx = i + c;
            out.data[idx] = clampByte(
                original.data[idx] + amount * (original.data[idx] - blurred.data[idx])
            );
        }
        out.data[i + 3] = original.data[i + 3];
    }

    ctx.putImageData(out, 0, 0);
    return canvas;
}

function bench(fn) {
    const t0 = process.hrtime.bigint();
    const out = fn();
    const ms = Number(process.hrtime.bigint() - t0) / 1e6;
    return { out, ms };
}

function upscaleForView(canvas, scale) {
    const c = createCanvas(canvas.width * scale, canvas.height * scale);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    return c;
}

function drawLabel(ctx, text, x, y, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.82)';
    ctx.fillRect(x, y, w, 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    const lines = text.split('\n');
    lines.forEach((line, i) => {
        ctx.fillText(line, x + 4, y + 12 + i * 11);
    });
}

async function main() {
    const img = await loadImage(SRC);
    const srcCanvas = createCanvas(img.width, img.height);
    srcCanvas.getContext('2d').drawImage(img, 0, 0);

    const variants = [
        {
            id: 'halve50',
            label: '50% 단계',
            ...bench(() => resizeHalve(srcCanvas, TARGET, TARGET))
        },
        {
            id: 'halve50-sharpen',
            label: '50% + sharpen',
            ...bench(() => {
                const c = resizeHalve(srcCanvas, TARGET, TARGET);
                return applyUnsharpMask(c, SHARPEN_AMOUNT, SHARPEN_RADIUS);
            })
        },
        {
            id: 'step25',
            label: '25% 단계',
            ...bench(() => resizeFactor(srcCanvas, TARGET, TARGET, 0.75))
        },
        {
            id: 'step25-sharpen',
            label: '25% + sharpen',
            ...bench(() => {
                const c = resizeFactor(srcCanvas, TARGET, TARGET, 0.75);
                return applyUnsharpMask(c, SHARPEN_AMOUNT, SHARPEN_RADIUS);
            })
        }
    ];

    for (const v of variants) {
        const p = path.join(OUT_DIR, `resize-compare-128-${v.id}.png`);
        fs.writeFileSync(p, v.out.toBuffer('image/png'));
        v.path = p;
    }

    const pad = 10;
    const labelH = 26;
    const cell = TARGET * VIEW;
    const cols = variants.length;
    const comp = createCanvas(
        cell * cols + pad * (cols + 1),
        cell + labelH + pad * 2
    );
    const ctx = comp.getContext('2d');
    ctx.fillStyle = '#1e1e1e';
    ctx.fillRect(0, 0, comp.width, comp.height);

    variants.forEach((v, i) => {
        const x = pad + i * (cell + pad);
        const y = pad + labelH;
        ctx.drawImage(upscaleForView(v.out, VIEW), x, y);
        drawLabel(ctx, `${v.label}\n${v.ms.toFixed(1)}ms`, x, pad, cell);
    });

    const compPath = path.join(OUT_DIR, 'resize-compare-128-sharpen-4.png');
    fs.writeFileSync(compPath, comp.toBuffer('image/png'));

    console.log(JSON.stringify({
        source: `${img.width}x${img.height}`,
        target: `${TARGET}x${TARGET}`,
        sharpen: { amount: SHARPEN_AMOUNT, radius: SHARPEN_RADIUS },
        variants: variants.map((v) => ({
            id: v.id,
            ms: Math.round(v.ms * 10) / 10,
            path: v.path
        })),
        compPath
    }, null, 2));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
