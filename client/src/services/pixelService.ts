import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface Pixel {
  x: number;
  y: number;
  color: string;
  price: number;
  ownerId: string | null;
  lastUpdated: string;
}

export const pixelService = {
  // Get all pixels
  getAllPixels: async (): Promise<Pixel[]> => {
    const response = await axios.get<Pixel[]>(`${API_URL}/pixels`);
    return response.data;
  },

  // Get pixel by coordinates
  getPixel: async (x: number, y: number): Promise<Pixel> => {
    const response = await axios.get<Pixel>(`${API_URL}/pixels/${x}/${y}`);
    return response.data;
  },

  // Create or update pixel with payment
  updatePixel: async (
    x: number, 
    y: number, 
    color: string, 
    price: number = 0,
    ownerId: string,
    paymentIntentId?: string
  ): Promise<{ pixel?: Pixel; clientSecret?: string; currentPrice?: number }> => {
    const response = await axios.post<{ pixel?: Pixel; clientSecret?: string; currentPrice?: number }>(
      `${API_URL}/pixels`,
      { x, y, color, price, ownerId, paymentIntentId }
    );
    return response.data;
  },

  // Handle successful payment
  handlePaymentSuccess: async (paymentIntentId: string): Promise<Pixel> => {
    const response = await axios.post<Pixel>(`${API_URL}/pixels/payment-success`, { paymentIntentId });
    return response.data;
  },

  // Get free pixel count for a user
  getFreePixelCount: async (browserId: string): Promise<number> => {
    const response = await axios.get<number>(`${API_URL}/pixels/free-count/${browserId}`);
    return response.data;
  }
}; 