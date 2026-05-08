const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById("editor"));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext("2d"));
const tool = /** @type {HTMLSelectElement} */ (document.getElementById("tool"));
const levelName = /** @type {HTMLInputElement} */ (document.getElementById("levelName"));
const objects = [];

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight - 59;
  draw();
}

function drawGrid() {
  ctx.strokeStyle = "rgba(255,255,255,.06)";
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawObject(object) {
  const colors = {
    wall: "#6f7770",
    monster: "#e45b4f",
    chest: "#f0c453",
    ammo: "#5cc7ff",
    medkit: "#7ae0a6",
    car: "#4aa3df",
    parking: "#eef6ee",
  };
  ctx.fillStyle = colors[object.type] || "#fff";
  if (object.type === "wall" || object.type === "parking") ctx.fillRect(object.x - 20, object.y - 20, 40, 40);
  else {
    ctx.beginPath();
    ctx.arc(object.x, object.y, object.type === "car" ? 18 : 12, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#07100d";
  ctx.font = "10px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(object.type, object.x, object.y + 4);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  objects.forEach(drawObject);
}

canvas.addEventListener("click", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.round((event.clientX - rect.left) / 20) * 20;
  const y = Math.round((event.clientY - rect.top) / 20) * 20;
  objects.push({ type: tool.value, x, y, level: 1 });
  draw();
});

document.getElementById("clearBtn")?.addEventListener("click", () => {
  objects.length = 0;
  draw();
});

document.getElementById("exportBtn")?.addEventListener("click", async () => {
  const level = { version: 1, name: levelName.value || "自定义关卡", objects };
  const text = JSON.stringify(level, null, 2);
  await navigator.clipboard?.writeText(text);
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "level.json";
  a.click();
  URL.revokeObjectURL(url);
});

window.addEventListener("resize", resize);
resize();
