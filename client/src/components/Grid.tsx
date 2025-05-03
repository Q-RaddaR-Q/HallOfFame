import { useEffect, useRef, useState, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { pixelService, Pixel } from "../services/pixelService";
import { configService } from "../services/configService";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY || '');

const COLORS = [
  "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff", 
  "#000000", "#ffffff", "#ffa500", "#800080", "#008000", "#ffc0cb"
];

const WIDTH = 1920;
const HEIGHT = 1080;

// Payment Form Component
function PaymentForm({ 
  amount, 
  onSuccess, 
  onCancel, 
  isProcessing, 
  setIsProcessing,
  pendingPixel,
  selectedColor,
  bidAmount,
  ownerId,
  ownerName,
  minPrice
}: { 
  amount: number; 
  onSuccess: () => void; 
  onCancel: () => void; 
  isProcessing: boolean;
  setIsProcessing: (processing: boolean) => void;
  pendingPixel: { x: number; y: number } | null;
  selectedColor: string;
  bidAmount: number;
  ownerId: string;
  ownerName: string;
  minPrice: number;
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) {
      console.error('Stripe or Elements not initialized:', { stripe, elements });
      return;
    }

    // Validate bid amount
    const minBid = pendingPixel ? bidAmount : minPrice;
    if (bidAmount < minBid) {
      alert(`Your bid must be at least $${minBid.toFixed(2)} to ${pendingPixel ? 'take over this pixel' : 'place a new pixel'}`);
      return;
    }

    setIsProcessing(true);
    try {
      // First, create the payment intent
      const { clientSecret } = await pixelService.createPaymentIntent(
        pendingPixel!.x,
        pendingPixel!.y,
        selectedColor,
        bidAmount,
        ownerId,
        ownerName
      );

      console.log('Payment intent created with client secret:', clientSecret);

      // Confirm the payment
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement)!,
            billing_details: {
              name: ownerName,
            },
          },
        }
      );

      if (confirmError) {
        console.error('Payment confirmation error:', confirmError);
        throw new Error(confirmError.message);
      }

      console.log('Payment intent status:', paymentIntent?.status);
      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        throw new Error('Payment was not successful');
      }
    } catch (error) {
      console.error('Error processing payment:', error);
      alert(error instanceof Error ? error.message : 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '8px' }}>
          Card Details
        </label>
        <div style={{
          padding: '12px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          backgroundColor: 'white',
        }}>
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: '16px',
                  color: '#424770',
                  '::placeholder': {
                    color: '#aab7c4',
                  },
                },
                invalid: {
                  color: '#9e2146',
                },
              },
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f0f0f0",
            border: "1px solid #ccc",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          disabled={isProcessing}
        >
          Cancel
        </button>
        <button
          type="submit"
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <>
              <span className="spinner" style={{
                width: "16px",
                height: "16px",
                border: "2px solid #ffffff",
                borderTop: "2px solid transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }} />
              Processing Payment...
            </>
          ) : (
            <>
              <span>Pay ${amount.toFixed(2)}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function PixelCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [pendingPixel, setPendingPixel] = useState<{ x: number, y: number } | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [mouseGridPos, setMouseGridPos] = useState<{ x: number; y: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedPixel, setSelectedPixel] = useState<Pixel | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [isPlacingFreePixel, setIsPlacingFreePixel] = useState(false); // New state for free pixel loading
  const [stripe, setStripe] = useState<any>(null);
  const [elements, setElements] = useState<any>(null);
  const [ownerName, setOwnerName] = useState('');
  const [showPixelInfo, setShowPixelInfo] = useState(false);
  const [selectedPixelInfo, setSelectedPixelInfo] = useState<Pixel | null>(null);
  const [nameValidationAttempted, setNameValidationAttempted] = useState(false);
  const [minPrice, setMinPrice] = useState<number>(0);
  const [maxPixels, setMaxPixels] = useState<number>(0);
  const [processingFee, setProcessingFee] = useState<number>(0);
  const [configError, setConfigError] = useState<string | null>(null);
  const [isConfigLoaded, setIsConfigLoaded] = useState<boolean>(false);

  const camera = useRef({
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  const coloredPixels = useRef<Map<string, string>>(new Map());

  const stripeElements = useRef<any>(null);

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

  // Load pixels from the server
  useEffect(() => {
    const loadPixels = async () => {
      try {
        const pixels = await pixelService.getAllPixels();
        pixels.forEach((pixel: Pixel) => {
          coloredPixels.current.set(`${pixel.x},${pixel.y}`, pixel.color);
        });
        triggerDraw();
      } catch (error) {
        console.error('Error loading pixels:', error);
      }
    };

    loadPixels();
  }, []);

  // Load configuration on component mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const [minPrice, maxPixels, processingFee] = await Promise.all([
          configService.getMinPrice(),
          configService.getMaxPixels(),
          configService.getProcessingFee()
        ]);
        setMinPrice(minPrice);
        setMaxPixels(maxPixels);
        setProcessingFee(processingFee);
        setBidAmount(minPrice);
        setConfigError(null);
        setIsConfigLoaded(true);
      } catch (error) {
        console.error('Error loading configuration:', error);
        setConfigError('Failed to load configuration from server. Viewing only mode enabled.');
        setIsConfigLoaded(false);
        // Force view mode when config fails to load
        setMode("view");
      }
    };

    loadConfig();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const { offsetX, offsetY, scale } = camera.current;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f0f0f0";
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

    // Draw grid
    ctx.strokeStyle = "#e0e0e0";
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

    // Draw colored pixels
    for (const [key, color] of coloredPixels.current) {
      const [x, y] = key.split(",").map(Number);
      if (x >= viewLeft && x <= viewRight && y >= viewTop && y <= viewBottom) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.restore();
  }, []);

  const triggerDraw = useCallback(() => requestAnimationFrame(draw), [draw]);

  // Redraw when state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
    camera.current.scale = scale;
    camera.current.offsetX = (canvas.width - WIDTH * scale) / 2;
    camera.current.offsetY = (canvas.height - HEIGHT * scale) / 2;

    draw();
  }, [draw, triggerDraw]);

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
    const maxScale = 50;

    newScale = Math.max(minScale, Math.min(newScale, maxScale));
    setZoomLevel(newScale);

    // Adjust offset so zoom centers around the cursor
    camera.current.scale = newScale;
    camera.current.offsetX = mouseX - worldX * newScale;
    camera.current.offsetY = mouseY - worldY * newScale;

    triggerDraw();
  };

  const onCanvasClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - camera.current.offsetX) / camera.current.scale;
    const y = (e.clientY - rect.top - camera.current.offsetY) / camera.current.scale;

    const gridX = Math.floor(x);
    const gridY = Math.floor(y);

    if (gridX >= 0 && gridX < WIDTH && gridY >= 0 && gridY < HEIGHT) {
      if (mode === "edit") {
        // Check if pixel exists and get its price
        pixelService.getPixel(gridX, gridY)
          .then(pixel => {
            setSelectedPixel(pixel);
            setBidAmount(pixel.price + minPrice);
          })
          .catch(() => {
            setSelectedPixel(null);
            setBidAmount(minPrice);
          });
        setPendingPixel({ x: gridX, y: gridY });
        setShowChoiceModal(true);
      } else {
        // In view mode, show pixel info
        pixelService.getPixel(gridX, gridY)
          .then(pixel => {
            setSelectedPixelInfo(pixel);
            setShowPixelInfo(true);
          })
          .catch(() => {
            setSelectedPixelInfo(null);
            setShowPixelInfo(false);
          });
      }
    }
  };

  const handleFreePixelPlacement = async () => {
    if (!pendingPixel || !ownerName) return;

    setIsPlacingFreePixel(true);
    try {
      const ownerId = getOrCreateBrowserId();
      const result = await pixelService.updatePixel(
        pendingPixel.x,
        pendingPixel.y,
        selectedColor,
        minPrice,
        ownerId,
        undefined,
        ownerName
      );

      let updatedPixel: Pixel;
      if ('pixel' in result && result.pixel) {
        updatedPixel = result.pixel;
      } else if ('x' in result && 'y' in result && 'color' in result) {
        updatedPixel = result as Pixel;
      } else {
        throw new Error('Unexpected response format from server');
      }

      coloredPixels.current.set(`${updatedPixel.x},${updatedPixel.y}`, updatedPixel.color);
      const newCount = placedCount + 1;
      setPlacedCount(newCount);
      localStorage.setItem(`pixelCount-${browserId}`, newCount.toString());

      setPendingPixel(null);
      setSelectedPixel(null);
      setShowChoiceModal(false);
      triggerDraw();
    } catch (error) {
      console.error('Error placing free pixel:', error);
      const message = error instanceof Error 
        ? (error.message.includes('400') 
            ? 'Invalid request. Free pixel placement may not be supported or pixel is already owned.'
            : error.message)
        : 'Failed to place pixel. Please try again.';
      alert(message);
    } finally {
      setIsPlacingFreePixel(false);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      // Wait for a short delay to allow the webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch the updated pixel
      const updatedPixel = await pixelService.getPixel(pendingPixel!.x, pendingPixel!.y);
      
      if (updatedPixel) {
        // Verify the price matches what we paid
        if (Math.abs(updatedPixel.price - bidAmount) > 0.01) {
          throw new Error(`Payment processed with incorrect price. Expected $${bidAmount}, got $${updatedPixel.price}`);
        }

        coloredPixels.current.set(`${updatedPixel.x},${updatedPixel.y}`, updatedPixel.color);

        if (!selectedPixel) {
          const newCount = placedCount + 1;
          setPlacedCount(newCount);
          localStorage.setItem(`pixelCount-${browserId}`, newCount.toString());
        }

        setPendingPixel(null);
        setSelectedPixel(null);
        setShowPaymentForm(false);
        setShowChoiceModal(false);
        triggerDraw();
      } else {
        throw new Error('Failed to update pixel after payment');
      }
    } catch (error) {
      console.error('Error updating pixel after payment:', error);
      alert(error instanceof Error ? error.message : 'Failed to update pixel after payment. Please try again.');
    }
  };

  const cancelColor = () => {
    setPendingPixel(null);
    setShowChoiceModal(false);
    setShowPaymentForm(false);
  };

  useEffect(() => {
    const initializeStripe = async () => {
      try {
        const stripeInstance = await stripePromise;
        if (stripeInstance) {
          setStripe(stripeInstance);
        }
      } catch (error) {
        console.error('Error initializing Stripe:', error);
      }
    };

    initializeStripe();
  }, []);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {configError && (
        <div style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#ff4444",
          color: "white",
          padding: "10px 20px",
          borderRadius: "6px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
          zIndex: 1000,
        }}>
          {configError}
        </div>
      )}

      {/* Modern UI Controls */}
      <div style={{
        position: "absolute",
        top: 20,
        left: 20,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        padding: "15px",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
      }}>
        <button
          onClick={() => isConfigLoaded && setMode(mode === "view" ? "edit" : "view")}
          style={{
            padding: "10px 15px",
            fontSize: "14px",
            cursor: isConfigLoaded ? "pointer" : "not-allowed",
            backgroundColor: mode === "edit" ? "#4CAF50" : "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "6px",
            transition: "all 0.3s ease",
            opacity: isConfigLoaded ? 1 : 0.5,
          }}
          disabled={!isConfigLoaded}
        >
          {mode === "edit" ? "Switch to View Mode" : "Switch to Edit Mode"}
        </button>

        {mode === "edit" && isConfigLoaded && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", maxWidth: "200px" }}>
              {COLORS.map((color) => (
                <div
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  style={{
                    width: 25,
                    height: 25,
                    backgroundColor: color,
                    border: color === selectedColor ? "2px solid #000" : "1px solid #ccc",
                    borderRadius: "4px",
                    cursor: "pointer",
                    transition: "transform 0.2s ease",
                    transform: color === selectedColor ? "scale(1.1)" : "scale(1)",
                  }}
                />
              ))}
            </div>
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              style={{
                padding: "8px 12px",
                backgroundColor: "#f0f0f0",
                border: "1px solid #ccc",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Custom Color
            </button>
            {showColorPicker && (
              <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "10px" }}>
                <HexColorPicker color={selectedColor} onChange={setSelectedColor} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zoom Level Indicator */}
      <div style={{
        position: "absolute",
        bottom: 20,
        right: 20,
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        padding: "8px 12px",
        borderRadius: "6px",
        fontSize: "14px",
        boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
      }}>
        Zoom: {Math.round(zoomLevel * 100)}%
      </div>

      {/* Mouse Position Indicator */}
      {mouseGridPos && (
        <div style={{
          position: "absolute",
          bottom: 20,
          left: 20,
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          padding: "8px 12px",
          borderRadius: "6px",
          fontSize: "14px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
        }}>
          Position: ({mouseGridPos.x}, {mouseGridPos.y})
        </div>
      )}

      {/* Payment/Choice Modal */}
      {pendingPixel && showChoiceModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            maxWidth: "400px",
            width: "90%",
          }}>
            <h3 style={{ marginBottom: "15px", fontSize: "18px" }}>
              {selectedPixel ? "Purchase Pixel" : "Place Pixel"}
            </h3>
            <p style={{ marginBottom: "20px", color: "#666" }}>
              {selectedPixel 
                ? `Current pixel price: $${selectedPixel.price.toFixed(2)}`
                : `You are about to place a pixel at (${pendingPixel.x}, ${pendingPixel.y}).`}
            </p>

            {/* Name Input Section */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px" }}>
                Your Name:
              </label>
              <div style={{ width: "100%", boxSizing: "border-box" }}>
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => {
                    setOwnerName(e.target.value);
                    setNameValidationAttempted(false);
                  }}
                  placeholder="Enter your name"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: `1px solid ${nameValidationAttempted && !ownerName.trim() ? "#ff0000" : "#ccc"}`,
                    boxSizing: "border-box",
                    backgroundColor: nameValidationAttempted && !ownerName.trim() ? "#fff5f5" : "white"
                  }}
                />
                {nameValidationAttempted && !ownerName.trim() && (
                  <p style={{ 
                    color: "#ff0000", 
                    fontSize: "12px", 
                    marginTop: "4px",
                    marginBottom: 0
                  }}>
                    Please enter your name to claim ownership of this pixel
                  </p>
                )}
              </div>
            </div>

            {showPaymentForm ? (
              <>
                {/* Price Input Section */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px" }}>
                    Set your price (minimum ${selectedPixel ? (selectedPixel.price + minPrice).toFixed(2) : minPrice.toFixed(2)}):
                  </label>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <input
                      type="number"
                      min={selectedPixel ? selectedPixel.price + minPrice : minPrice}
                      step={0.1}
                      value={bidAmount}
                      onChange={(e) => {
                        const newBid = parseFloat(e.target.value);
                        if (!isNaN(newBid)) {
                          setBidAmount(newBid);
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: "4px",
                        border: `1px solid ${bidAmount < (selectedPixel ? selectedPixel.price + minPrice : minPrice) ? "#ff0000" : "#ccc"}`,
                        backgroundColor: bidAmount < (selectedPixel ? selectedPixel.price + minPrice : minPrice) ? "#fff5f5" : "white"
                      }}
                    />
                    <button
                      onClick={() => setBidAmount(selectedPixel ? selectedPixel.price + minPrice : minPrice)}
                      style={{
                        padding: "8px 12px",
                        backgroundColor: "#f0f0f0",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      Min
                    </button>
                  </div>
                  {bidAmount < (selectedPixel ? selectedPixel.price + minPrice : minPrice) && (
                    <p style={{ 
                      color: "#ff0000", 
                      fontSize: "12px", 
                      marginTop: "4px",
                      marginBottom: 0
                    }}>
                      {selectedPixel 
                        ? `Your bid must be at least $${(selectedPixel.price + minPrice).toFixed(2)} to take over this pixel`
                        : `Your bid must be at least $${minPrice.toFixed(2)} to place a new pixel`}
                    </p>
                  )}
                  <p style={{ marginTop: "8px", fontSize: "14px", color: "#666" }}>
                    The higher your price, the more protection you have from others taking over your pixel.
                  </p>
                </div>

                {/* Payment Summary */}
                <div style={{ 
                  padding: "15px", 
                  backgroundColor: "#f8f9fa", 
                  borderRadius: "8px",
                  border: "1px solid #e9ecef",
                  marginBottom: "20px"
                }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: "16px" }}>Payment Summary</h4>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span>Pixel Price:</span>
                    <span>${bidAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                    <span>Processing Fee:</span>
                    <span>${processingFee.toFixed(2)}</span>
                  </div>
                  <div style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid #e9ecef",
                    fontWeight: "bold"
                  }}>
                    <span>Total:</span>
                    <span>${(bidAmount + processingFee).toFixed(2)}</span>
                  </div>
                </div>

                {/* Payment Form */}
                <Elements stripe={stripe}>
                  <PaymentForm
                    amount={bidAmount + processingFee}
                    onSuccess={handlePaymentSuccess}
                    onCancel={() => setShowPaymentForm(false)}
                    isProcessing={isProcessingPayment}
                    setIsProcessing={setIsProcessingPayment}
                    pendingPixel={pendingPixel}
                    selectedColor={selectedColor}
                    bidAmount={bidAmount}
                    ownerId={getOrCreateBrowserId()}
                    ownerName={ownerName}
                    minPrice={minPrice}
                  />
                </Elements>
              </>
            ) : (
              <>
                {selectedPixel || placedCount >= maxPixels ? (
                  <>
                    <p style={{ marginBottom: "20px", color: "#666" }}>
                      {selectedPixel 
                        ? "This pixel is already owned. You must purchase it."
                        : "You have used all your free pixels. You must purchase this pixel."}
                    </p>
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button
                        onClick={cancelColor}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#f0f0f0",
                          border: "1px solid #ccc",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setNameValidationAttempted(true);
                          if (!ownerName.trim()) {
                            return;
                          }
                          setShowPaymentForm(true);
                        }}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Continue to Payment
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ marginBottom: "20px", fontWeight: "bold" }}>
                      You have {maxPixels - placedCount} free pixel(s) remaining.
                    </p>
                    <p style={{ marginBottom: "20px" }}>
                      Would you like to use a free pixel or pay to place this pixel?
                    </p>
                    <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                      <button
                        onClick={cancelColor}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#f0f0f0",
                          border: "1px solid #ccc",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        disabled={isPlacingFreePixel}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => {
                          setNameValidationAttempted(true);
                          if (!ownerName.trim()) {
                            return;
                          }
                          handleFreePixelPlacement();
                        }}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#2196F3",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: isPlacingFreePixel ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                        }}
                        disabled={isPlacingFreePixel}
                      >
                        {isPlacingFreePixel ? (
                          <>
                            <span className="spinner" style={{
                              width: "16px",
                              height: "16px",
                              border: "2px solid #ffffff",
                              borderTop: "2px solid transparent",
                              borderRadius: "50%",
                              animation: "spin 1s linear infinite",
                            }} />
                            Placing...
                          </>
                        ) : (
                          "Use Free Pixel"
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setNameValidationAttempted(true);
                          if (!ownerName.trim()) {
                            return;
                          }
                          setShowPaymentForm(true);
                        }}
                        style={{
                          padding: "8px 16px",
                          backgroundColor: "#4CAF50",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                        disabled={isPlacingFreePixel}
                      >
                        Pay for Pixel
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Pixel Limit Message */}
      {mode === "edit" && placedCount >= maxPixels && (
        <div style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "#4CAF50",
          color: "white",
          padding: "10px 20px",
          borderRadius: "6px",
          boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
          zIndex: 10,
        }}>
          🎉 You've placed your {maxPixels} pixels! You can purchase more pixels or switch to view mode.
        </div>
      )}

      {/* Pixel Info Modal */}
      {showPixelInfo && selectedPixelInfo && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}>
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "12px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            maxWidth: "400px",
            width: "90%",
          }}>
            <h3 style={{ marginBottom: "15px", fontSize: "18px" }}>
              Pixel Information
            </h3>
            <div style={{ marginBottom: "20px" }}>
              <p><strong>Position:</strong> ({selectedPixelInfo.x}, {selectedPixelInfo.y})</p>
              <p><strong>Color:</strong> 
                <span style={{
                  display: "inline-block",
                  width: "20px",
                  height: "20px",
                  backgroundColor: selectedPixelInfo.color,
                  marginLeft: "10px",
                  verticalAlign: "middle",
                  border: "1px solid #ccc",
                }} />
              </p>
              <p><strong>Owner:</strong> {selectedPixelInfo.ownerName || "Unknown"}</p>
              <p><strong>Price:</strong> ${selectedPixelInfo.price.toFixed(2)}</p>
              <p><strong>Last Updated:</strong> {new Date(selectedPixelInfo.lastUpdated).toLocaleString()}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowPixelInfo(false);
                  setSelectedPixelInfo(null);
                }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: "#f0f0f0",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add this style to your existing styles */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onClick={(e) => {
          if (mode === "edit" && !isConfigLoaded) {
            return;
          }
          onCanvasClick(e);
        }}
        style={{
          display: "block",
          width: "100vw",
          height: "100vh",
          cursor: isDragging ? "grabbing" : mode === "edit" && isConfigLoaded ? "crosshair" : "grab",
          imageRendering: "pixelated",
        }}
      />
    </div>
  );
}