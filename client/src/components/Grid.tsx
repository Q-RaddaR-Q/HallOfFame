import { useEffect, useRef, useState } from "react";

const COLORS = ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff", "#000000", "#ffffff"];

const WIDTH = 1920;
const HEIGHT = 1080;

//1920x920 full screen of boxes

export default function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [pendingPixel, setPendingPixel] = useState<{ x: number, y: number } | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [mouseGridPos, setMouseGridPos] = useState<{ x: number; y: number } | null>(null);
  
  const camera = useRef({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  const coloredPixels = useRef<Map<string, string>>(new Map());

  const getOrCreateBrowserId = () => {
    const key = "pixelCanvasBrowserId";
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  };
  
  const browserId = getOrCreateBrowserId();
  
  // Load from localStorage
  const getPixelCount = () => {
    const count = localStorage.getItem(`pixelCount-${browserId}`);
    return count ? parseInt(count) : 0;
  };
  
  const [placedCount, setPlacedCount] = useState(getPixelCount());
  // Fake a couple colored pixels to test performance
  useEffect(() => {
    for (let i = 0; i < 1000; i++) {
      coloredPixels.current.set(`${Math.floor(Math.random() * WIDTH)},${Math.floor(Math.random() * HEIGHT)}`, "#ff0000");
    }
  }, []);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const { offsetX, offsetY, scale } = camera.current;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clamp offset
    const maxOffsetX = 0;
    const maxOffsetY = 0;
    const minOffsetX = canvas.width - WIDTH * scale;
    const minOffsetY = canvas.height - HEIGHT * scale;

    camera.current.offsetX = Math.min(maxOffsetX, Math.max(minOffsetX, offsetX));
    camera.current.offsetY = Math.min(maxOffsetY, Math.max(minOffsetY, offsetY));

    ctx.translate(camera.current.offsetX, camera.current.offsetY);
    ctx.scale(scale, scale);

    // Only draw visible colored pixels
    const viewLeft = Math.floor(-camera.current.offsetX / scale);
    const viewTop = Math.floor(-camera.current.offsetY / scale);
    const viewRight = Math.ceil((canvas.width - camera.current.offsetX) / scale);
    const viewBottom = Math.ceil((canvas.height - camera.current.offsetY) / scale);

    for (const [key, color] of coloredPixels.current) {
      const [x, y] = key.split(",").map(Number);
      if (x >= viewLeft && x <= viewRight && y >= viewTop && y <= viewBottom) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // Optional: draw grid only when zoomed in
    if (scale >= 8) {
      ctx.strokeStyle = "#ccc";
      ctx.lineWidth = 0.05;

      for (let x = viewLeft; x <= viewRight; x++) {
        ctx.beginPath();
        ctx.moveTo(x, viewTop);
        ctx.lineTo(x, viewBottom);
        ctx.stroke();
      }

      for (let y = viewTop; y <= viewBottom; y++) {
        ctx.beginPath();
        ctx.moveTo(viewLeft, y);
        ctx.lineTo(viewRight, y);
        ctx.stroke();
      }
    }

    ctx.restore();
  };

  // Redraw when state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
    camera.current.scale = scale;
    camera.current.offsetX = (canvas.width - WIDTH * scale) / 2;
    camera.current.offsetY = (canvas.height - HEIGHT * scale) / 2;

    draw();
  }, []);


  const triggerDraw = () => requestAnimationFrame(draw);

  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      camera.current.offsetX += dx;
      camera.current.offsetY += dy;
      setLastMouse({ x: e.clientX, y: e.clientY });
      triggerDraw();
    }
  
    const canvas = canvasRef.current;
    if (!canvas) return;
  
    const rect = canvas.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - camera.current.offsetX) / camera.current.scale;
    const worldY = (e.clientY - rect.top - camera.current.offsetY) / camera.current.scale;
  
    const gridX = Math.floor(worldX);
    const gridY = Math.floor(worldY);
  
    if (gridX >= 0 && gridX < WIDTH && gridY >= 0 && gridY < HEIGHT) {
      setMouseGridPos({ x: gridX, y: gridY });
    } else {
      setMouseGridPos(null);
    }
  };
  

  const onMouseUp = () => setIsDragging(false);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const { offsetX, offsetY, scale } = camera.current;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // Get world position under the mouse
    const worldX = (mouseX - offsetX) / scale;
    const worldY = (mouseY - offsetY) / scale;

    const zoomFactor = 1.1;
    const direction = e.deltaY < 0 ? 1 : -1;
    let newScale = scale * (direction > 0 ? zoomFactor : 1 / zoomFactor);

    // Clamp zoom to between min (just fits whole grid) and max (very close)
    const minScaleX = canvas.width / WIDTH;
    const minScaleY = canvas.height / HEIGHT;
    const minScale = Math.min(minScaleX, minScaleY);
    const maxScale = 50; // You can zoom in a LOT, but not out too far

    newScale = Math.max(minScale, Math.min(newScale, maxScale));

    // Adjust offset so zoom centers around the cursor
    camera.current.scale = newScale;
    camera.current.offsetX = mouseX - worldX * newScale;
    camera.current.offsetY = mouseY - worldY * newScale;

    triggerDraw();
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    if (mode !== "edit") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - camera.current.offsetX) / camera.current.scale;
    const y = (e.clientY - rect.top - camera.current.offsetY) / camera.current.scale;

    const gridX = Math.floor(x);
    const gridY = Math.floor(y);

    if (gridX >= 0 && gridX < WIDTH && gridY >= 0 && gridY < HEIGHT) {
      setPendingPixel({ x: gridX, y: gridY });
    }
  };

  const confirmColor = () => {
    if (!pendingPixel) return;
  
    if (placedCount >= 3) {
      alert("You've already placed 3 pixels.");
      setPendingPixel(null);
      return;
    }
  
    coloredPixels.current.set(`${pendingPixel.x},${pendingPixel.y}`, selectedColor);
    
    const newCount = placedCount + 1;
    setPlacedCount(newCount);
    localStorage.setItem(`pixelCount-${browserId}`, newCount.toString());
  
    setPendingPixel(null);
    triggerDraw();
  };
  


  const cancelColor = () => {
    setPendingPixel(null);
  };

  return (
    <div>
{mode === "edit" && placedCount < 3 && (
        <div style={{ position: "absolute", top: 10, left: 10, zIndex: 10, display: "flex", gap: 8 }}>
          {COLORS.map((color) => (
            <div
              key={color}
              onClick={() => setSelectedColor(color)}
              style={{
                width: 30,
                height: 30,
                backgroundColor: color,
                border: color === selectedColor ? "2px solid black" : "1px solid #999",
                cursor: "pointer",
              }}
            />
          ))}
        </div>
      )}
      <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}>
        <button
          onClick={() => setMode(mode === "view" ? "edit" : "view")}
          style={{
            padding: "10px 15px",
            fontSize: "14px",
            cursor: "pointer",
            backgroundColor: mode === "edit" ? "#eee" : "#ddd",
            border: "1px solid #aaa",
            borderRadius: "4px"
          }}
        >
          Switch to {mode === "edit" ? "View" : "Edit"} Mode
        </button>
      </div>


      {pendingPixel && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "white",
            padding: "20px 30px",
            borderRadius: "8px",
            boxShadow: "0 0 20px rgba(0,0,0,0.3)",
            zIndex: 20,
          }}
        >
          <p style={{ marginBottom: 12 }}>
            Are you sure you want to color pixel at ({pendingPixel.x}, {pendingPixel.y})?
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={confirmColor} style={{ padding: "8px 12px" }}>Yes</button>
            <button onClick={cancelColor} style={{ padding: "8px 12px" }}>No</button>
          </div>
        </div>
      )}

      {mode === "edit" && placedCount >= 3 && (
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            padding: "8px 12px",
            backgroundColor: "#fff0f0",
            border: "1px solid #cc0000",
            borderRadius: "5px",
            zIndex: 10,
          }}
        >
          🎉 You’ve placed your 3 colors!
        </div>
      )}

      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onClick={onCanvasClick}
        style={{
          display: "block",
          width: "100vw",
          height: "100vh",
          cursor: isDragging ? "grabbing" : mode === "edit" ? "crosshair" : "grab",
          imageRendering: "pixelated",
        }}

      />

{mouseGridPos && (
  <div
    style={{
      position: "absolute",
      bottom: 10,
      left: 10,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      padding: "6px 10px",
      borderRadius: "4px",
      fontSize: "14px",
      zIndex: 10,
      border: "1px solid #ccc",
    }}
  >
    🖱️ Mouse at: ({mouseGridPos.x}, {mouseGridPos.y})
  </div>
)}

    </div>
  );
}
