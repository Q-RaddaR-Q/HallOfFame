import { useEffect, useRef, useState, useCallback } from "react";
import { HexColorPicker } from "react-colorful";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { pixelService, Pixel, PixelHistory } from "../services/pixelService";
import { configService } from "../services/configService";
import SelectedPixelsPanel from './SelectedPixelsPanel';
import TimelineSlider from './TimelineSlider';
import TopMenu from './TopMenu';
import websocketService from '../services/websocketService';

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
  minPrice,
  isProtectedPixel
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
  isProtectedPixel: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [link, setLink] = useState('');
  const [withSecurity, setWithSecurity] = useState(isProtectedPixel);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !pendingPixel) return;

    setIsProcessing(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment intent first
      const { clientSecret } = await pixelService.createPaymentIntent(
        pendingPixel.x,
        pendingPixel.y,
        selectedColor,
        bidAmount,
        ownerId,
        ownerName
      );

      const { error: paymentError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: ownerName,
            },
          },
        }
      );

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Create or update the pixel with the link and security
        await pixelService.updatePixel(
          pendingPixel.x,
          pendingPixel.y,
          selectedColor,
          bidAmount,
          ownerId,
          paymentIntent.id,
          ownerName,
          link,
          withSecurity
        );
        onSuccess();
      } else {
        throw new Error('Payment was not successful');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%' }}>
      {/* Only show link input if bid amount is over $50 */}
      {bidAmount >= 50 && (
        <div style={{ marginBottom: "20px" }}>
          <label style={{ display: "block", marginBottom: "8px" }}>
            Link (optional):
          </label>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://example.com"
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
            }}
          />
        </div>
      )}

      {/* Add Pixel Security Option - only show if not a protected pixel */}
      {!isProtectedPixel && (
        <div style={{ marginBottom: "20px" }}>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center',
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={withSecurity}
              onChange={(e) => setWithSecurity(e.target.checked)}
              style={{ marginRight: '10px' }}
            />
            Add Pixel Security (4x additional cost)
          </label>
          {withSecurity && (
            <div style={{ 
              marginTop: '10px',
              padding: '10px',
              backgroundColor: '#f8f9fa',
              borderRadius: '4px'
            }}>
              <p style={{ margin: '0 0 5px 0' }}>Total cost: ${(bidAmount * 5).toFixed(2)}</p>
              <p style={{ margin: '0', color: '#666' }}>Your pixel will be secured for 7 days</p>
            </div>
          )}
        </div>
      )}

      {/* Show security info for protected pixels */}
      {isProtectedPixel && (
        <div style={{ 
          marginBottom: "20px",
          padding: "10px",
          backgroundColor: "#f8f9fa",
          borderRadius: "4px",
          border: "1px solid #e9ecef"
        }}>
          <p style={{ margin: '0 0 5px 0', color: '#4CAF50', fontWeight: '500' }}>
            This pixel will be protected for 7 days after purchase
          </p>
          <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
            The protection is included in the purchase price
          </p>
        </div>
      )}

      <div style={{ marginBottom: "20px" }}>
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
      <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
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
          type="submit"
          disabled={!stripe || isProcessing}
          style={{
            padding: "8px 16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            opacity: !stripe || isProcessing ? 0.7 : 1,
          }}
        >
          {isProcessing ? "Processing..." : `Pay $${amount.toFixed(2)}`}
        </button>
      </div>
    </form>
  );
}

// Add a new PaymentForm component for bulk payments
const BulkPaymentForm = ({ 
  selectedPixels, 
  minPrice, 
  ownerName, 
  onSuccess, 
  onCancel,
  browserId,
  processingFee
}: { 
  selectedPixels: Array<{ x: number; y: number; color: string }>;
  minPrice: number;
  ownerName: string;
  onSuccess: () => void;
  onCancel: () => void;
  browserId: string;
  processingFee: number;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [existingPixels, setExistingPixels] = useState<Array<{ x: number; y: number; price: number }>>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [pixelPrices, setPixelPrices] = useState<Map<string, number>>(new Map());
  const [withSecurity, setWithSecurity] = useState(false);

  // Calculate the base total amount (without security multiplier)
  const calculateBaseTotal = useCallback(() => {
    return Array.from(pixelPrices.values()).reduce((sum, price) => sum + price, 0);
  }, [pixelPrices]);

  // Calculate the final total amount including security if enabled
  const calculateFinalTotal = useCallback(() => {
    const baseTotal = calculateBaseTotal();
    return withSecurity ? baseTotal * 4 : baseTotal;
  }, [calculateBaseTotal, withSecurity]);

  // Load existing pixel prices
  useEffect(() => {
    const loadExistingPixels = async () => {
      try {
        const pixels = await Promise.all(
          selectedPixels.map(async (pixel) => {
            try {
              const existingPixel = await pixelService.getPixel(pixel.x, pixel.y);
              return existingPixel ? { x: pixel.x, y: pixel.y, price: existingPixel.price } : null;
            } catch (error) {
              console.error(`Error fetching pixel (${pixel.x}, ${pixel.y}):`, error);
              return null;
            }
          })
        );
        const validPixels = pixels.filter((p): p is { x: number; y: number; price: number } => p !== null);
        setExistingPixels(validPixels);
        
        // Calculate total amount and set pixel prices
        const prices = new Map<string, number>();
        let total = 0;
        
        for (const pixel of validPixels) {
          const price = pixel.price + minPrice; // Add minPrice to existing pixel price
          prices.set(`${pixel.x},${pixel.y}`, price);
          total += price;
        }
        
        for (const pixel of selectedPixels) {
          if (!prices.has(`${pixel.x},${pixel.y}`)) {
            prices.set(`${pixel.x},${pixel.y}`, minPrice);
            total += minPrice;
          }
        }
        
        setPixelPrices(prices);
        setTotalAmount(total);
      } catch (error) {
        console.error('Error loading existing pixels:', error);
        // If we can't load existing pixels, use the minimum price for all
        const prices = new Map<string, number>();
        selectedPixels.forEach(pixel => {
          prices.set(`${pixel.x},${pixel.y}`, minPrice);
        });
        setPixelPrices(prices);
        setTotalAmount(selectedPixels.length * minPrice);
      }
    };

    loadExistingPixels();
  }, [selectedPixels, minPrice]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);
    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      const baseTotal = calculateBaseTotal();

      const { clientSecret } = await pixelService.createBulkPaymentIntent(
        selectedPixels.map(pixel => ({
          x: pixel.x,
          y: pixel.y,
          color: pixel.color,
          price: pixelPrices.get(`${pixel.x},${pixel.y}`) || minPrice,
          withSecurity: withSecurity
        })),
        finalTotal, // Use finalTotal instead of baseTotal to include security multiplier
        browserId,
        ownerName
      );

      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: ownerName,
            },
          },
        }
      );

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        onSuccess();
      } else {
        throw new Error('Payment was not successful');
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const baseTotal = calculateBaseTotal();
  const finalTotal = calculateFinalTotal();

  return (
    <form onSubmit={handleSubmit}>
      {/* Add Security Option */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ 
          display: 'flex', 
          alignItems: 'center',
          cursor: 'pointer'
        }}>
          <input
            type="checkbox"
            checked={withSecurity}
            onChange={(e) => setWithSecurity(e.target.checked)}
            style={{ marginRight: '10px' }}
          />
          Add Pixel Security (3x additional cost)
        </label>
        {withSecurity && (
          <div style={{ 
            marginTop: '10px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px'
          }}>
            <p style={{ margin: '0 0 5px 0' }}>Total cost: ${finalTotal.toFixed(2)}</p>
            <p style={{ margin: '0', color: '#666' }}>All selected pixels will be secured for 7 days</p>
          </div>
        )}
      </div>

      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", marginBottom: "8px" }}>
          Card Details
        </label>
        <div style={{
          padding: "12px",
          border: "1px solid #ccc",
          borderRadius: "4px",
          backgroundColor: "white",
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

      <div style={{ display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "8px 16px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
          disabled={isProcessing}
        >
          Select More Pixels
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
              <span>Pay ${(finalTotal + processingFee).toFixed(2)}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};

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
  const [isPlacingFreePixel, setIsPlacingFreePixel] = useState(false);
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
  const [selectedPixels, setSelectedPixels] = useState<Array<{ x: number; y: number; color: string }>>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [bulkPaymentIntent, setBulkPaymentIntent] = useState<{ clientSecret: string } | null>(null);
  const [selectedPixelForColor, setSelectedPixelForColor] = useState<{ x: number; y: number } | null>(null);
  const [showColorPickerForSelected, setShowColorPickerForSelected] = useState(false);
  const [showBulkPaymentForm, setShowBulkPaymentForm] = useState(false);
  const [pixelPrices, setPixelPrices] = useState<Map<string, number>>(new Map());
  const [existingPixels, setExistingPixels] = useState<Array<{ x: number; y: number; price: number }>>([]);
  const [bulkLink, setBulkLink] = useState('');
  const [hoveredPixel, setHoveredPixel] = useState<Pixel | null>(null);
  const [hoverPosition, setHoverPosition] = useState<{ x: number; y: number } | null>(null);
  const [allPixels, setAllPixels] = useState<Pixel[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [withSecurity, setWithSecurity] = useState(false);
  const [userId] = useState(() => localStorage.getItem('userId') || generateUniqueId());
  const [showSecuredPixelWarning, setShowSecuredPixelWarning] = useState(false);
  const [securedPixelInfo, setSecuredPixelInfo] = useState<{
    x: number;
    y: number;
    ownerName: string;
    expiresAt: Date;
    price: number;
  } | null>(null);
  const [pixelHistory, setPixelHistory] = useState<PixelHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  // Change slider to vertical orientation
  const [historySliderIndex, setHistorySliderIndex] = useState(0);

  // Add ref for selected pixels
  const selectedPixelsRef = useRef<Array<{ x: number; y: number; color: string }>>([]);

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
        setAllPixels(pixels);
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

  // Update visible pixels based on selected date
  useEffect(() => {
    if (selectedDate) {
      coloredPixels.current.clear();
      allPixels.forEach((pixel: Pixel) => {
        const pixelDate = new Date(pixel.lastUpdated);
        if (pixelDate <= selectedDate) {
          coloredPixels.current.set(`${pixel.x},${pixel.y}`, pixel.color);
        }
      });
      triggerDraw();
    }
  }, [selectedDate, allPixels]);

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

    // Draw grid first (behind everything)
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

    // Draw selected pixels with a highlight color
    for (const pixel of selectedPixelsRef.current) {
      const { x, y, color } = pixel;
      if (x >= viewLeft && x <= viewRight && y >= viewTop && y <= viewBottom) {
        // Draw the selected color
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }

    ctx.restore();
  }, [camera.current.scale]);

  const triggerDraw = useCallback(() => requestAnimationFrame(draw), [draw]);

  // Add resize handler and camera initialization
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const currentWidth = canvas.width;
      const currentHeight = canvas.height;
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;
      
      if (currentWidth !== newWidth || currentHeight !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        // Initialize camera
        const scale = Math.min(canvas.width / WIDTH, canvas.height / HEIGHT);
        camera.current.scale = scale;
        camera.current.offsetX = (canvas.width - WIDTH * scale) / 2;
        camera.current.offsetY = (canvas.height - HEIGHT * scale) / 2;
        
        triggerDraw();
      }
    };

    window.addEventListener('resize', handleResize);
    // Initial setup
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [triggerDraw]);

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
      // Check if pixel has a link
      pixelService.getPixel(gridX, gridY)
        .then(pixel => {
          if (pixel.link) {
            setHoveredPixel(pixel);
            setHoverPosition({ x: e.clientX, y: e.clientY });
          } else {
            setHoveredPixel(null);
            setHoverPosition(null);
          }
        })
        .catch(() => {
          setHoveredPixel(null);
          setHoverPosition(null);
        });
    } else {
      setMouseGridPos(null);
      setHoveredPixel(null);
      setHoverPosition(null);
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

    // Force immediate redraw
    requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Clear and redraw everything
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      draw();
    });
  };

  const onCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - camera.current.offsetX) / camera.current.scale;
    const y = (e.clientY - rect.top - camera.current.offsetY) / camera.current.scale;

    const gridX = Math.floor(x);
    const gridY = Math.floor(y);

    if (gridX >= 0 && gridX < WIDTH && gridY >= 0 && gridY < HEIGHT) {
      if (mode === "edit") {
        if (isMultiSelectMode) {
          // Check if pixel is already selected
          const existingIndex = selectedPixelsRef.current.findIndex(p => p.x === gridX && p.y === gridY);
          if (existingIndex >= 0) {
            // Remove pixel from selection
            selectedPixelsRef.current = selectedPixelsRef.current.filter((_, i) => i !== existingIndex);
            setSelectedPixels(selectedPixelsRef.current);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              draw();
            }
          } else {
            // Add pixel to selection (no protection check here, no fetch at all)
            selectedPixelsRef.current = [...selectedPixelsRef.current, { x: gridX, y: gridY, color: selectedColor }];
            setSelectedPixels(selectedPixelsRef.current);
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
              draw();
            }
          }
        } else {
          // Single pixel selection mode
          try {
            const pixel = await pixelService.getPixel(gridX, gridY);
            // Check if pixel is secured and not expired
            if (pixel.isSecured && pixel.securityExpiresAt && new Date(pixel.securityExpiresAt) > new Date()) {
              // For protected pixels, show warning first
              setSecuredPixelInfo({
                x: pixel.x,
                y: pixel.y,
                ownerName: pixel.ownerName || 'Unknown',
                expiresAt: new Date(pixel.securityExpiresAt),
                price: pixel.price
              });
              setShowSecuredPixelWarning(true);
              return;
            }
            setSelectedPixel(pixel);
            setBidAmount(pixel.price + minPrice);
            setPendingPixel({ x: gridX, y: gridY });
            setShowChoiceModal(true);
          } catch (error) {
            setSelectedPixel(null);
            setBidAmount(minPrice);
            setPendingPixel({ x: gridX, y: gridY });
            setShowChoiceModal(true);
          }
        }
      } else if (mode === "view") {
        // In view mode, show pixel info
        try {
          const pixel = await pixelService.getPixel(gridX, gridY);
          setSelectedPixelInfo(pixel);
          setShowPixelInfo(true);
          // Always fetch history regardless of protection status
          fetchPixelHistory(gridX, gridY);
        } catch (error) {
          setSelectedPixelInfo(null);
          setShowPixelInfo(false);
        }
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

  const handleBulkPayment = async () => {
    if (selectedPixelsRef.current.length === 0 || !ownerName) return;

    setNameValidationAttempted(true);
    if (!ownerName.trim()) {
      return;
    }

    // Check for protected pixels before proceeding
    try {
      const pixelChecks = await Promise.all(selectedPixelsRef.current.map(async (pixel) => {
        try {
          const data = await pixelService.getPixel(pixel.x, pixel.y);
          return {
            ...pixel,
            isSecured: data.isSecured,
            securityExpiresAt: data.securityExpiresAt,
            exists: true
          };
        } catch (err: any) {
          // If pixel does not exist (404), treat as not protected
          if (err && err.response && err.response.status === 404) {
            return { ...pixel, isSecured: false, securityExpiresAt: null, exists: false };
          }
          // For other errors, rethrow
          throw err;
        }
      }));
      const protectedPixels = pixelChecks.filter(p => p.exists && p.isSecured && p.securityExpiresAt && new Date(p.securityExpiresAt) > new Date());
      if (protectedPixels.length > 0) {
        const coords = protectedPixels.map(p => `(${p.x},${p.y})`).join(', ');
        setNotification({
          message: `Pixel(s) at ${coords} are protected and cannot be bought in bulk mode. Please use single pixel mode.`,
          type: 'error'
        });
        return;
      }
    } catch (error) {
      setNotification({ message: 'Failed to check pixel protection status. Please try again.', type: 'error' });
      return;
    }

    // Calculate total amount based on individual pixel prices
    const totalAmount = Array.from(pixelPrices.values()).reduce((sum, price) => {
      return sum + price; // Use the price directly as it already includes minPrice
    }, 0);

    setShowBulkPaymentForm(true);
  };

  const handleBulkPaymentSubmit = async () => {
    if (!stripe || !elements) return;

    setIsProcessingPayment(true);
    try {
      // Calculate base total from pixel prices
      const baseTotal = Array.from(pixelPrices.values()).reduce((sum, price) => sum + price, 0);
      // Calculate final total with security if enabled
      const finalTotal = withSecurity ? baseTotal * 4 : baseTotal;

      console.log('Bulk Payment Details:', {
        baseTotal,
        finalTotal,
        withSecurity,
        processingFee,
        totalWithFee: finalTotal + processingFee,
        selectedPixels: selectedPixelsRef.current.map(pixel => ({
          x: pixel.x,
          y: pixel.y,
          color: pixel.color,
          price: pixelPrices.get(`${pixel.x},${pixel.y}`) || minPrice
        }))
      });

      const { clientSecret } = await pixelService.createBulkPaymentIntent(
        selectedPixelsRef.current.map(pixel => ({
          x: pixel.x,
          y: pixel.y,
          color: pixel.color,
          price: pixelPrices.get(`${pixel.x},${pixel.y}`) || minPrice,
          withSecurity: withSecurity
        })),
        finalTotal + processingFee, // Send the final total including security and processing fee
        getOrCreateBrowserId(),
        ownerName
      );

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

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        console.log('Payment successful:', {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          status: paymentIntent.status
        });

        for (const pixel of selectedPixelsRef.current) {
          const updatedPixel = await pixelService.getPixel(pixel.x, pixel.y);
          if (updatedPixel) {
            coloredPixels.current.set(`${updatedPixel.x},${updatedPixel.y}`, updatedPixel.color);
          }
        }

        setSelectedPixels([]);
        setShowBulkPaymentForm(false);
        setBulkPaymentIntent(null);
        triggerDraw();
      } else {
        throw new Error('Payment was not successful');
      }
    } catch (error) {
      console.error('Bulk payment error:', error);
      alert(error instanceof Error ? error.message : 'Failed to process payment. Please try again.');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleBulkPaymentSuccess = async () => {
    try {
      // Wait for a short delay to allow the webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Update all selected pixels with the link if provided
      if (bulkLink) {
        for (const pixel of selectedPixelsRef.current) {
          await pixelService.updatePixelLink(pixel.x, pixel.y, bulkLink);
        }
      }

      // Update all selected pixels
      for (const pixel of selectedPixelsRef.current) {
        const updatedPixel = await pixelService.getPixel(pixel.x, pixel.y);
        if (updatedPixel) {
          coloredPixels.current.set(`${updatedPixel.x},${updatedPixel.y}`, updatedPixel.color);
        }
      }

      // Clear the selection and link
      selectedPixelsRef.current = [];
      setSelectedPixels([]);
      setBulkLink('');
      setShowBulkPaymentForm(false);
      setBulkPaymentIntent(null);
      triggerDraw();
    } catch (error) {
      console.error('Error updating pixels after payment:', error);
      alert('Payment was successful but there was an error updating the display. Please refresh the page to see your changes.');
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      // Wait for a short delay to allow the webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Fetch the updated pixel
      const updatedPixel = await pixelService.getPixel(pendingPixel!.x, pendingPixel!.y);
      
      if (updatedPixel) {
        // Verify the price matches what we paid with epsilon for floating-point comparison
        const epsilon = 0.001;
        if (Math.abs(updatedPixel.price - bidAmount) > epsilon) {
          throw new Error(`Payment processed with incorrect price. Expected $${bidAmount}, got $${updatedPixel.price}`);
        }

        // Update the colored pixels map
        coloredPixels.current.set(`${updatedPixel.x},${updatedPixel.y}`, updatedPixel.color);

        // Update the allPixels array
        setAllPixels(prevPixels => {
          const index = prevPixels.findIndex(p => p.x === updatedPixel.x && p.y === updatedPixel.y);
          if (index !== -1) {
            const newPixels = [...prevPixels];
            newPixels[index] = updatedPixel;
            return newPixels;
          }
          return [...prevPixels, updatedPixel];
        });

        if (!selectedPixel) {
          const newCount = placedCount + 1;
          setPlacedCount(newCount);
          localStorage.setItem(`pixelCount-${browserId}`, newCount.toString());
        }

        setPendingPixel(null);
        setSelectedPixel(null);
        setShowPaymentForm(false);
        setShowChoiceModal(false);
        
        // Force immediate redraw
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            draw();
          }
        }
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

  // Add this useEffect to load pixel prices when selection changes
  useEffect(() => {
    let isMounted = true;

    const loadPixelPrices = async () => {
      const newPrices = new Map<string, number>();
      for (const pixel of selectedPixelsRef.current) {
        try {
          const existingPixel = await pixelService.getPixel(pixel.x, pixel.y);
          if (existingPixel && isMounted) {
            newPrices.set(`${pixel.x},${pixel.y}`, existingPixel.price);
          } else if (isMounted) {
            newPrices.set(`${pixel.x},${pixel.y}`, minPrice);
          }
        } catch (error) {
          console.error(`Error fetching pixel (${pixel.x}, ${pixel.y}):`, error);
          if (isMounted) {
            newPrices.set(`${pixel.x},${pixel.y}`, minPrice);
          }
        }
      }
      if (isMounted) {
        setPixelPrices(newPrices);
      }
    };

    loadPixelPrices();

    return () => {
      isMounted = false;
    };
  }, [selectedPixelsRef.current, minPrice]);

  // Add this useEffect to load existing pixels when selection changes
  useEffect(() => {
    const loadExistingPixels = async () => {
      const pixels = await Promise.all(
        selectedPixelsRef.current.map(async (pixel) => {
          try {
            const existingPixel = await pixelService.getPixel(pixel.x, pixel.y);
            return existingPixel ? { x: pixel.x, y: pixel.y, price: existingPixel.price } : null;
          } catch (error) {
            console.error(`Error fetching pixel (${pixel.x}, ${pixel.y}):`, error);
            return null;
          }
        })
      );
      setExistingPixels(pixels.filter((p): p is { x: number; y: number; price: number } => p !== null));
    };

    if (selectedPixelsRef.current.length > 0) {
      loadExistingPixels();
    } else {
      setExistingPixels([]);
    }
  }, [selectedPixelsRef.current]);

  // Add a function to calculate total price
  const calculateTotalPrice = () => {
    return existingPixels.reduce((sum: number, pixel) => sum + (pixel.price + minPrice), 0) + 
      (selectedPixelsRef.current.length - existingPixels.length) * minPrice;
  };

  const onMouseLeave = () => {
    setHoveredPixel(null);
    setHoverPosition(null);
  };

  // Add WebSocket subscription
  useEffect(() => {
    const unsubscribe = websocketService.subscribe((pixel) => {
      // Update the coloredPixels map with the new pixel
      coloredPixels.current.set(`${pixel.x},${pixel.y}`, pixel.color);
      // Trigger a redraw
      triggerDraw();
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe();
    };
  }, []);

  // Update the handlePaymentSubmit function
  const handlePaymentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !selectedPixel) return;

    setIsProcessingPayment(true);
    const totalAmount = withSecurity ? bidAmount * 5 : bidAmount; // 4x extra for security + original price

    try {
      const { error: paymentMethodError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement('card'),
      });

      if (paymentMethodError) {
        console.error('Payment method error:', paymentMethodError);
        setIsProcessingPayment(false);
        return;
      }

      // Create payment intent
      const response = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalAmount,
          paymentMethodId: paymentMethod.id,
        }),
      });

      const { clientSecret } = await response.json();

      const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);

      if (confirmError) {
        console.error('Confirm payment error:', confirmError);
        setIsProcessingPayment(false);
        return;
      }

      // Update pixel with payment confirmation
      await pixelService.updatePixel(
        selectedPixel.x,
        selectedPixel.y,
        selectedColor,
        totalAmount,
        userId,
        clientSecret,
        ownerName,
        undefined,
        withSecurity
      );

      setShowPaymentForm(false);
      setIsProcessingPayment(false);
      refreshPixels();

    } catch (error) {
      console.error('Payment error:', error);
      setIsProcessingPayment(false);
    }
  };

  // Function to refresh pixels
  const refreshPixels = useCallback(async () => {
    try {
      const pixels = await pixelService.getAllPixels();
      setAllPixels(pixels);
      // Update the colored pixels map
      const newColoredPixels = new Map();
      pixels.forEach(pixel => {
        newColoredPixels.set(`${pixel.x},${pixel.y}`, pixel.color);
      });
      coloredPixels.current = newColoredPixels;
    } catch (error) {
      console.error('Error refreshing pixels:', error);
    }
  }, []);

  // Generate a unique ID for new users
  function generateUniqueId() {
    const id = Math.random().toString(36).substring(2) + Date.now().toString(36);
    localStorage.setItem('userId', id);
    return id;
  }

  // Add effect to clear selected pixels when mode changes
  useEffect(() => {
    selectedPixelsRef.current = [];
    setSelectedPixels([]);
    triggerDraw();
  }, [mode]);

  // Add effect to clear selected pixels when multi-select mode changes
  useEffect(() => {
    selectedPixelsRef.current = [];
    setSelectedPixels([]);
    triggerDraw();
  }, [isMultiSelectMode]);

  // Add function to fetch history
  const fetchPixelHistory = async (x: number, y: number) => {
    try {
      const history = await pixelService.getPixelHistory(x, y);
      setPixelHistory(history);
    } catch (error) {
      console.error('Error fetching pixel history:', error);
    }
  };

  const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' | null }>({ message: '', type: null });

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* Fancy Notification Bar */}
      {notification.message && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: notification.type === 'error' ? '#ff4444' : '#2196F3',
            color: 'white',
            padding: '14px 32px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            zIndex: 2000,
            fontSize: '16px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            minWidth: '320px',
            maxWidth: '90vw',
            animation: 'popupFadeIn 0.3s',
          }}
        >
          <span style={{ flex: 1 }}>{notification.message}</span>
          <button
            onClick={() => setNotification({ message: '', type: null })}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              marginLeft: '12px',
              fontWeight: 700,
              lineHeight: 1,
            }}
            aria-label="Dismiss notification"
          >
            ×
          </button>
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

        {mode === "edit" && isConfigLoaded && !selectedPixelInfo && (
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
            <div 
              style={{ 
                position: "absolute", 
                top: "100%", 
                left: 0, 
                marginTop: "10px",
                opacity: showColorPicker && !selectedPixelInfo ? 1 : 0,
                transition: "opacity 0.3s ease-out",
                pointerEvents: showColorPicker && !selectedPixelInfo ? "auto" : "none",
              }}
            >
              <HexColorPicker color={selectedColor} onChange={setSelectedColor} />
            </div>
          </div>
        )}
      </div>

      {/* Multi-select mode toggle and Selected Pixels Panel */}
      {mode === "edit" && (
        <div style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 10,
        }}>
          <button
            onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
            className={`mode-toggle-button ${isConfigLoaded ? '' : 'disabled'}`}
            disabled={!isConfigLoaded}
            data-active={isMultiSelectMode}
          >
            {isMultiSelectMode ? "Multi-Pixel Mode" : "Single Pixel Mode"}
          </button>

          {/* Selected Pixels Panel */}
          {isMultiSelectMode && (
            <div style={{
              backgroundColor: "rgba(255, 255, 255, 0.9)",
              padding: "15px",
              borderRadius: "12px",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
              maxWidth: "300px",
              position: "relative",
              maxHeight: "calc(100vh - 100px)", // Limit height to viewport height minus some space
              display: "flex",
              flexDirection: "column",
            }}>
              <h3 style={{ marginBottom: "15px", fontSize: "18px" }}>
                Selected Pixels ({selectedPixelsRef.current.length})
              </h3>

              {/* Scrollable content area */}
              <div style={{
                flex: 1,
                overflowY: "auto",
                marginBottom: "15px",
                paddingRight: "5px", // Add some padding for the scrollbar
              }}>
                {/* Name Input Field */}
                <div style={{ marginBottom: "15px" }}>
                  <label style={{ display: "block", marginBottom: "8px" }}>
                    Your Name:
                  </label>
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
                      Please enter your name to claim ownership of these pixels
                    </p>
                  )}
                </div>

                {/* Add link input for bulk selection only if total price >= $50 */}
                {selectedPixelsRef.current.length > 0 && calculateTotalPrice() >= 50 && (
                  <div style={{ marginBottom: "20px" }}>
                    <label style={{ display: "block", marginBottom: "8px" }}>
                      Link (optional):
                    </label>
                    <input
                      type="url"
                      value={bulkLink}
                      onChange={(e) => setBulkLink(e.target.value)}
                      placeholder="https://example.com"
                      style={{
                        width: "100%",
                        padding: "8px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                      }}
                    />
                    <p style={{ 
                      fontSize: "12px", 
                      color: "#666",
                      marginTop: "4px",
                      marginBottom: 0
                    }}>
                      Link will be added to all selected pixels
                    </p>
                  </div>
                )}

                <div style={{ 
                  maxHeight: "200px", 
                  overflowY: "auto",
                  marginBottom: "20px",
                  border: "1px solid #e0e0e0",
                  borderRadius: "8px",
                  padding: "10px"
                }}>
                  {selectedPixelsRef.current.map((pixel, index) => {
                    const price = pixelPrices.get(`${pixel.x},${pixel.y}`) || minPrice;
                    return (
                      <div key={`${pixel.x}-${pixel.y}`} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px",
                        backgroundColor: index % 2 === 0 ? "#f8f9fa" : "white",
                        borderRadius: "4px",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div 
                            onClick={async () => {
                              try {
                                const pixelData = await pixelService.getPixel(pixel.x, pixel.y);
                                setSelectedPixelInfo(pixelData);
                                setShowColorPickerForSelected(true);
                                setShowColorPicker(false);
                              } catch (error) {
                                console.error('Error fetching pixel data:', error);
                              }
                            }}
                            style={{
                              width: "20px",
                              height: "20px",
                              backgroundColor: pixel.color,
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                              cursor: "pointer",
                              transition: "transform 0.2s ease",
                            }}
                            title="Click to change color"
                          />
                          <div>
                            <div>Position: ({pixel.x}, {pixel.y})</div>
                            <div style={{ fontSize: "12px", color: "#666" }}>
                              Price: ${price.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const index = selectedPixelsRef.current.findIndex(p => p.x === pixel.x && p.y === pixel.y);
                            if (index !== -1) {
                              selectedPixelsRef.current = selectedPixelsRef.current.filter((_, i) => i !== index);
                              setSelectedPixels(selectedPixelsRef.current);
                              triggerDraw();
                            }
                          }}
                          style={{
                            padding: "4px 8px",
                            backgroundColor: "#ff4444",
                            color: "white",
                            border: "none",
                            borderRadius: "4px",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })}
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
                  <div style={{ maxHeight: "200px", overflowY: "auto", marginBottom: "10px" }}>
                    {selectedPixelsRef.current.map((pixel, index) => {
                      const existingPixel = existingPixels.find(p => p.x === pixel.x && p.y === pixel.y);
                      const price = existingPixel ? existingPixel.price + minPrice : minPrice;
                      return (
                        <div key={`${pixel.x}-${pixel.y}`} style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 100px",
                          gap: "10px",
                          padding: "8px",
                          backgroundColor: index % 2 === 0 ? "#f8f9fa" : "white",
                          borderRadius: "4px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{
                              width: "20px",
                              height: "20px",
                              backgroundColor: pixel.color,
                              border: "1px solid #ccc",
                              borderRadius: "4px",
                            }} />
                            <span>Pixel ({pixel.x}, {pixel.y})</span>
                          </div>
                          <span style={{ textAlign: "right" }}>${price.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{
                    display: "grid", 
                    gridTemplateColumns: "1fr 100px",
                    gap: "10px",
                    marginBottom: "5px" 
                  }}>
                    <span>Processing Fee:</span>
                    <span style={{ textAlign: "right" }}>${processingFee.toFixed(2)}</span>
                  </div>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "1fr 100px",
                    gap: "10px",
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid #e9ecef",
                    fontWeight: "bold"
                  }}>
                    <span>Total:</span>
                    <span style={{ textAlign: "right" }}>
                      ${(existingPixels.reduce((sum: number, pixel) => sum + (pixel.price + minPrice), 0) + 
                        (selectedPixelsRef.current.length - existingPixels.length) * minPrice + 
                        processingFee).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fixed bottom buttons */}
              <div style={{ 
                display: "flex", 
                gap: "10px", 
                justifyContent: "flex-end",
                paddingTop: "15px",
                borderTop: "1px solid #e0e0e0",
                backgroundColor: "rgba(255, 255, 255, 0.9)",
              }}>
                <button
                  onClick={() => {
                    selectedPixelsRef.current = [];
                    setSelectedPixels([]);
                    triggerDraw();
                  }}
                  style={{
                    padding: "8px 16px",
                    backgroundColor: "#f0f0f0",
                    border: "1px solid #ccc",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  Clear Selection
                </button>
                <button
                  onClick={() => {
                    if (selectedPixelsRef.current.length === 0) {
                      alert('Please select at least one pixel to proceed with payment');
                      return;
                    }
                    setNameValidationAttempted(true);
                    if (!ownerName.trim()) {
                      return;
                    }
                    handleBulkPayment();
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
                  Proceed to Payment
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
                  {selectedPixel && selectedPixel.isSecured && selectedPixel.securityExpiresAt && new Date(selectedPixel.securityExpiresAt) > new Date() ? (
                    <div style={{ marginBottom: "20px" }}>
                      <p style={{ color: "#666", marginBottom: "10px" }}>
                        This is a protected pixel. To purchase it, you must pay exactly 10x its current price.
                      </p>
                      <div style={{ 
                        padding: "15px", 
                        backgroundColor: "#f8f9fa", 
                        borderRadius: "8px",
                        border: "1px solid #e9ecef"
                      }}>
                        <p style={{ margin: "0 0 5px 0" }}>Current Price: ${selectedPixel.price.toFixed(2)}</p>
                        <p style={{ margin: "0", fontWeight: "bold" }}>Required Price: ${(selectedPixel.price * 10).toFixed(2)}</p>
                      </div>
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
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
                  {withSecurity && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                      <span>Security (4x):</span>
                      <span>${(bidAmount * 4).toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{
                    display: "grid", 
                    gridTemplateColumns: "1fr 100px",
                    gap: "10px",
                    marginBottom: "5px" 
                  }}>
                    <span>Processing Fee:</span>
                    <span style={{ textAlign: "right" }}>${processingFee.toFixed(2)}</span>
                  </div>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "1fr 100px",
                    gap: "10px",
                    marginTop: "10px",
                    paddingTop: "10px",
                    borderTop: "1px solid #e9ecef",
                    fontWeight: "bold"
                  }}>
                    <span>Total:</span>
                    <span style={{ textAlign: "right" }}>
                      ${(withSecurity ? (bidAmount * 5) + processingFee : bidAmount + processingFee).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Payment Form */}
                <Elements stripe={stripe}>
                                   <PaymentForm
                    amount={withSecurity ? (bidAmount * 5) + processingFee : bidAmount + processingFee}
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
                    isProtectedPixel={Boolean(selectedPixel?.isSecured && selectedPixel?.securityExpiresAt && new Date(selectedPixel.securityExpiresAt) > new Date())}
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
              <p><strong>Owner:</strong> {selectedPixelInfo.ownerName || "Unclaimed"}</p>
              <p><strong>Price:</strong> ${selectedPixelInfo.price.toFixed(2)}</p>
              <p><strong>Last Updated:</strong> {new Date(selectedPixelInfo.lastUpdated).toLocaleString()}</p>
              {selectedPixelInfo.isSecured && selectedPixelInfo.securityExpiresAt && (
                <div style={{
                  marginTop: "15px",
                  padding: "12px",
                  backgroundColor: "#fff3cd",
                  border: "1px solid #ffeeba",
                  borderRadius: "6px",
                }}>
                  <p style={{ 
                    margin: "0 0 8px 0", 
                    color: "#856404",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <span style={{ fontSize: "18px" }}>🔒</span>
                    Protected Pixel
                  </p>
                  <p style={{ 
                    margin: "0", 
                    color: "#666",
                    fontSize: "14px"
                  }}>
                    This pixel is secured until {new Date(selectedPixelInfo.securityExpiresAt).toLocaleString()}
                  </p>
                </div>
              )}
              {selectedPixelInfo.link && (
                <p>
                  <strong>Link:</strong>{" "}
                  <a 
                    href={selectedPixelInfo.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ color: "#0066cc", textDecoration: "underline" }}
                  >
                    {selectedPixelInfo.link}
                  </a>
                </p>
              )}

              {/* Pixel History Section - vertical scrollable slider */}
              <div style={{ marginTop: "20px" }}>
                <h4 style={{ margin: 0, fontSize: "16px" }}>Pixel History</h4>
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  maxWidth: "100%",
                  marginTop: "10px"
                }}>
                  {/* History entries with vertical scrollbar */}
                  <div style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    width: "100%",
                    maxHeight: "220px",
                    overflowY: "auto",
                    border: "1px solid #e0e0e0",
                    borderRadius: "8px",
                    padding: "10px",
                    backgroundColor: "white"
                  }}>
                    {pixelHistory.length > 0 ? (
                      pixelHistory.map((history, index) => (
                        <div
                          key={history.id}
                          style={{
                            padding: "10px",
                            backgroundColor: index % 2 === 0 ? "#f8f9fa" : "white",
                            borderRadius: "4px",
                            border: "1px solid #e9ecef",
                            display: "flex",
                            flexDirection: "column"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "5px" }}>
                            <div style={{
                              width: "20px",
                              height: "20px",
                              backgroundColor: history.color,
                              border: "1px solid #ccc",
                              borderRadius: "4px"
                            }} />
                            <div>
                              <div style={{ fontWeight: "500" }}>{history.ownerName}</div>
                              <div style={{ fontSize: "12px", color: "#666" }}>
                                {new Date(history.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                          <div style={{ fontSize: "12px", color: "#666" }}>
                            Price: ${history.price.toFixed(2)}
                            {history.link && (
                              <span style={{ marginLeft: "8px" }}>
                                Link: <a href={history.link} target="_blank" rel="noopener noreferrer" style={{ color: "#0066cc" }}>{history.link}</a>
                              </span>
                            )}
                            {history.isSecured && history.securityExpiresAt && (
                              <span style={{
                                marginLeft: "8px",
                                color: "#856404",
                                backgroundColor: "#fff3cd",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid #ffeeba"
                              }}>
                                🔒 Protected until: {new Date(history.securityExpiresAt).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>
                        No history available for this pixel
                      </div>
                    )
                  }
                  </div>
                </div>
              </div>
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

      {/* Bulk Payment Modal */}
      {showBulkPaymentForm && (
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
              Purchase {selectedPixelsRef.current.length} Pixels
            </h3>
            <p style={{ marginBottom: "20px", color: "#666" }}>
              You are about to purchase {selectedPixelsRef.current.length} pixels as <strong>{ownerName}</strong>.
            </p>

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
                <span>${minPrice.toFixed(2)}</span>
              </div>
              {withSecurity && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span>Security (4x):</span>
                  <span>${(minPrice * 4).toFixed(2)}</span>
                </div>
              )}
              <div style={{
                display: "grid", 
                gridTemplateColumns: "1fr 100px",
                gap: "10px",
                marginBottom: "5px" 
              }}>
                <span>Processing Fee:</span>
                <span style={{ textAlign: "right" }}>${processingFee.toFixed(2)}</span>
              </div>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "1fr 100px",
                gap: "10px",
                marginTop: "10px",
                paddingTop: "10px",
                borderTop: "1px solid #e9ecef",
                fontWeight: "bold"
              }}>
                <span>Total:</span>
                <span style={{ textAlign: "right" }}>
                  ${(existingPixels.reduce((sum: number, pixel) => sum + (pixel.price + minPrice), 0) + 
                    (selectedPixelsRef.current.length - existingPixels.length) * minPrice + 
                    processingFee).toFixed(2)}
                </span>
              </div>
            </div>

            <Elements stripe={stripePromise}>
              <BulkPaymentForm
                selectedPixels={selectedPixelsRef.current}
                minPrice={minPrice}
                ownerName={ownerName}
                browserId={getOrCreateBrowserId()}
                processingFee={processingFee}
                onSuccess={handleBulkPaymentSuccess}
                onCancel={() => {
                  setShowBulkPaymentForm(false);
                  setBulkPaymentIntent(null);
                }}
              />
            </Elements>
          </div>
        </div>
      )}

      {/* Color Picker for Selected Pixel */}
      {showColorPickerForSelected && selectedPixelInfo && (
        <div 
          style={{ 
            position: "absolute",
            top: "16%",
            left: "77%",
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            zIndex: 1000,
            animation: "slideIn 0.3s ease-out",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            minWidth: "200px"
          }}
        >
          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", maxWidth: "200px" }}>
            {COLORS.map((color) => (
              <div
                key={color}
                onClick={() => {
                  const updatedPixels = selectedPixelsRef.current.map(p => {
                    if (p.x === selectedPixelInfo.x && p.y === selectedPixelInfo.y) {
                      return { ...p, color };
                    }
                    return p;
                  });
                  selectedPixelsRef.current = updatedPixels;
                  setSelectedPixels(updatedPixels);
                  setSelectedPixelInfo({ ...selectedPixelInfo, color });
                  triggerDraw();
                }}
                style={{
                  width: "25px",
                  height: "25px",
                  backgroundColor: color,
                  border: color === selectedPixelInfo.color ? "2px solid #000" : "1px solid #ccc",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "transform 0.2s ease",
                  transform: color === selectedPixelInfo.color ? "scale(1.1)" : "scale(1)",
                }}
              />
            ))}
          </div>
          <HexColorPicker 
            color={selectedPixelInfo.color} 
            onChange={(color) => {
              const updatedPixels = selectedPixelsRef.current.map(p => {
                if (p.x === selectedPixelInfo.x && p.y === selectedPixelInfo.y) {
                  return { ...p, color };
                }
                return p;
              });
              selectedPixelsRef.current = updatedPixels;
              setSelectedPixels(updatedPixels);
              setSelectedPixelInfo({ ...selectedPixelInfo, color });
              triggerDraw();
            }}
          />
          <button
            onClick={() => {
              setShowColorPickerForSelected(false);
              setSelectedPixelInfo(null);
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#f0f0f0",
              border: "1px solid #ccc",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      )}

      {/* Link Hover Popup */}
      {hoveredPixel && hoverPosition && hoveredPixel.link && (
        <div
          style={{
            position: "fixed",
            left: hoverPosition.x + 10,
            top: hoverPosition.y + 10,
            backgroundColor: "rgba(255, 255, 255, 0.98)",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
            zIndex: 1000,
            pointerEvents: "none",
            maxWidth: "300px",
            wordBreak: "break-all",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            animation: "popupFadeIn 0.2s ease-out",
            transform: "translateY(0)",
            opacity: 1,
            transition: "all 0.2s ease-out"
          }}
        >
          <div style={{ 
            fontSize: "14px", 
            color: "#444",
            fontWeight: 500,
            marginBottom: "6px",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
            <span style={{
              width: "8px",
              height: "8px",
              backgroundColor: hoveredPixel.color,
              borderRadius: "50%",
              display: "inline-block"
            }} />
            {hoveredPixel.ownerName ? `${hoveredPixel.ownerName}'s pixel` : 'Unclaimed pixel'}
          </div>
          <a
            href={hoveredPixel.link || undefined}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "#0066cc",
              textDecoration: "none",
              fontSize: "14px",
              display: "block",
              padding: "8px 12px",
              backgroundColor: "rgba(0, 102, 204, 0.08)",
              borderRadius: "6px",
              transition: "all 0.2s ease",
              border: "1px solid rgba(0, 102, 204, 0.1)",
              position: "relative",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 102, 204, 0.12)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(0, 102, 204, 0.08)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {hoveredPixel.link}
          </a>
        </div>
      )}

      {/* Add this style to your existing styles */}
      <style>
        {`
          @keyframes popupFadeIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes fadeOut {
            from {
              opacity: 1;
            }
            to {
              opacity: 0;
            }
          }

          @keyframes slideIn {
            from {
              transform: translateX(-100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }

          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(-100%);
              opacity: 0;
            }
          }

          .mode-toggle-button {
            padding: 10px 15px;
            font-size: 14px;
            cursor: pointer;
            color: white;
            border: none;
            border-radius: 6px;
            transition: all 0.3s ease;
            background-color: #2196F3;
          }
          
          .mode-toggle-button:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }
          
          .mode-toggle-button[data-active="true"] {
            background-color: #4CAF50;
          }
        `}
      </style>

      {/* Add TimelineSlider in view mode */}
      {mode === "view" && allPixels.length > 0 && (
        <TopMenu
          pixels={allPixels}
          onTimeChange={(date) => setSelectedDate(date)}
        />
      )}

      <canvas
        ref={canvasRef}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
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

      {showSecuredPixelWarning && securedPixelInfo && (
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
            padding: "30px",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
            maxWidth: "500px",
            width: "90%",
            border: "1px solid #e0e0e0",
          }}>
            <div style={{
              textAlign: "center",
              marginBottom: "20px",
            }}>
              <h2 style={{ 
                color: "#333", 
                fontSize: "24px", 
                marginBottom: "10px",
              }}>
                Protected Pixel
              </h2>
              <div style={{
                width: "100%",
                height: "2px",
                background: "linear-gradient(90deg, transparent, #4CAF50, transparent)",
                marginBottom: "20px"
              }} />
            </div>

            <div style={{ 
              backgroundColor: "#f8f9fa", 
              padding: "20px",
              borderRadius: "8px",
              marginBottom: "20px",
              border: "1px solid #e9ecef"
            }}>
              <p style={{ 
                color: "#333", 
                fontSize: "16px", 
                marginBottom: "15px",
                fontWeight: "500"
              }}>
                This pixel is currently protected by {securedPixelInfo.ownerName}
              </p>
              <div style={{ 
                display: "grid",
                gap: "10px",
                marginBottom: "15px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Current Price:</span>
                  <span style={{ color: "#333", fontWeight: "500" }}>${securedPixelInfo.price.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Required Price:</span>
                  <span style={{ color: "#4CAF50", fontWeight: "bold" }}>${(securedPixelInfo.price * 10).toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#666" }}>Protection expires:</span>
                  <span style={{ color: "#666" }}>{securedPixelInfo.expiresAt.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <p style={{ 
              color: "#666", 
              marginBottom: "20px",
              fontSize: "14px",
              textAlign: "center"
            }}>
              To purchase this protected pixel, you'll need to pay 10x its current price.
            </p>

            <div style={{ 
              display: "flex", 
              gap: "15px", 
              justifyContent: "center"
            }}>
              <button
                onClick={() => {
                  setShowSecuredPixelWarning(false);
                  setSecuredPixelInfo(null);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#f0f0f0",
                  color: "#333",
                  border: "1px solid #ccc",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "16px",
                  transition: "all 0.3s ease"
                }}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowSecuredPixelWarning(false);
                  setSelectedPixel({
                    x: securedPixelInfo.x,
                    y: securedPixelInfo.y,
                    price: securedPixelInfo.price,
                    isSecured: true,
                    securityExpiresAt: securedPixelInfo.expiresAt.toISOString(),
                    ownerName: securedPixelInfo.ownerName,
                    color: selectedColor,
                    ownerId: getOrCreateBrowserId(),
                    link: '',
                    lastUpdated: new Date().toISOString()
                  });
                  setBidAmount(securedPixelInfo.price * 10);
                  setPendingPixel({ x: securedPixelInfo.x, y: securedPixelInfo.y });
                  setShowChoiceModal(true);
                  // Automatically enable security for protected pixel purchases
                  setWithSecurity(true);
                }}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#4CAF50",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "16px",
                  fontWeight: "500",
                  transition: "all 0.3s ease"
                }}
                className="proceed-button"
              >
                Proceed to Purchase
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Update the styles */}
      <style>
        {`
          .cancel-button:hover {
            background-color: #e0e0e0;
          }

          .proceed-button:hover {
            background-color: #45a049;
          }
        `}
      </style>
    </div>
  );
}