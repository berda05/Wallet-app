/* charts.js — lagani SVG grafikoni (bez biblioteka) */
(function () {
  const NS = "http://www.w3.org/2000/svg";

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  // Donut chart. data = [{label, value, color}], fmt = function(value)->string
  function donut(slices, opts) {
    opts = opts || {};
    const size = opts.size || 180;
    const stroke = opts.stroke || 26;
    const r = (size - stroke) / 2;
    const cx = size / 2, cy = size / 2;
    const C = 2 * Math.PI * r;
    const total = slices.reduce((s, x) => s + x.value, 0);

    const svg = el("svg", { viewBox: `0 0 ${size} ${size}`, class: "chart-donut", width: size, height: size });
    // track
    svg.appendChild(el("circle", { cx, cy, r, fill: "none", stroke: "var(--track)", "stroke-width": stroke }));

    if (total > 0) {
      let offset = 0;
      slices.forEach(s => {
        if (s.value <= 0) return;
        const frac = s.value / total;
        const len = frac * C;
        const c = el("circle", {
          cx, cy, r, fill: "none",
          stroke: s.color, "stroke-width": stroke,
          "stroke-dasharray": `${len} ${C - len}`,
          "stroke-dashoffset": -offset,
          "stroke-linecap": frac < 0.97 ? "butt" : "round",
          transform: `rotate(-90 ${cx} ${cy})`
        });
        c.style.transition = "stroke-dasharray .6s ease";
        svg.appendChild(c);
        offset += len;
      });
    }

    // center text
    const wrap = document.createElement("div");
    wrap.className = "donut-wrap";
    wrap.appendChild(svg);
    if (opts.centerTop || opts.centerMain) {
      const center = document.createElement("div");
      center.className = "donut-center";
      if (opts.centerTop) center.innerHTML += `<div class="donut-top">${opts.centerTop}</div>`;
      if (opts.centerMain) center.innerHTML += `<div class="donut-main">${opts.centerMain}</div>`;
      if (opts.centerSub) center.innerHTML += `<div class="donut-sub">${opts.centerSub}</div>`;
      wrap.appendChild(center);
    }
    return wrap;
  }

  // Grouped bar chart: groups = [{label, values:[{value,color}]}], fmt
  function bars(groups, opts) {
    opts = opts || {};
    const w = opts.width || 320;
    const h = opts.height || 160;
    const padB = 22, padT = 8;
    const innerH = h - padB - padT;
    let max = 0;
    groups.forEach(g => g.values.forEach(v => { if (v.value > max) max = v.value; }));
    if (max <= 0) max = 1;

    const svg = el("svg", { viewBox: `0 0 ${w} ${h}`, class: "chart-bars", width: "100%", height: h });
    const n = groups.length;
    const groupW = w / n;
    const barsPer = groups[0] ? groups[0].values.length : 1;
    const bw = Math.min(14, (groupW * 0.6) / barsPer);
    const gap = 3;

    groups.forEach((g, gi) => {
      const gx = gi * groupW + groupW / 2;
      const totalW = barsPer * bw + (barsPer - 1) * gap;
      let x = gx - totalW / 2;
      g.values.forEach(v => {
        const bh = Math.max(2, (v.value / max) * innerH);
        const y = padT + innerH - bh;
        const rect = el("rect", {
          x: x.toFixed(1), y: y.toFixed(1), width: bw, height: bh.toFixed(1),
          rx: 4, fill: v.color
        });
        rect.style.transition = "height .5s ease, y .5s ease";
        svg.appendChild(rect);
        x += bw + gap;
      });
      const t = el("text", { x: gx, y: h - 6, "text-anchor": "middle", class: "bar-label" });
      t.textContent = g.label;
      svg.appendChild(t);
    });
    return svg;
  }

  window.Charts = { donut, bars };
})();
