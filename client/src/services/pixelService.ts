import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export interface Pixel {
  x: number;
  y: number;
  color: string;
  price: number;
  ownerId: string | null;
  ownerName: string | null;
  link: string | null;
  lastUpdated: string;
  isSecured: boolean;
  securityExpiresAt: string | null;
}

interface PaymentData {
  id: string;
  amount: number;
  status: string;
  metadata: {
    x: number;
    y: number;
    color: string;
    ownerId: string;
    ownerName: string;
  };
}

interface BulkPaymentData {
  id: string;
  amount: number;
  status: string;
  metadata: {
    pixels: Array<{ x: number; y: number; color: string }>;
    ownerId: string;
    ownerName: string;
  };
}

export interface PixelHistory {
  id: number;
  x: number;
  y: number;
  color: string;
  price: number;
  ownerId: string;
  ownerName: string;
  link: string | null;
  isSecured: boolean;
  securityExpiresAt: string | null;
  paymentIntentId: string | null;
  createdAt: string;
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

  // Create a payment intent
  createPaymentIntent: async (
    x: number, 
    y: number, 
    color: string, 
    price: number,
    ownerId: string,
    ownerName: string
  ): Promise<{ clientSecret: string }> => {
    try {
      console.log('Creating payment intent with:', { x, y, color, price, ownerId, ownerName });
      const response = await axios.post<{ clientSecret: string }>(
        `${API_URL}/payments/create-payment-intent`,
        { x, y, color, price, ownerId, ownerName }
      );
      console.log('Payment intent created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      if (error.response) {
        console.error('Axios error details:', {
          status: error.response.status,
          data: error.response.data,
          message: error.message
        });
        throw new Error(error.response.data?.message || error.message);
      }
      throw error;
    }
  },

  // Create or update pixel with payment
  updatePixel: async (
    x: number, 
    y: number, 
    color: string, 
    price: number = 0,
    ownerId: string,
    paymentIntentId?: string,
    ownerName?: string,
    link?: string,
    withSecurity?: boolean
  ): Promise<{ pixel?: Pixel; currentPrice?: number }> => {
    try {
      const requestData = { 
        x, 
        y, 
        color, 
        price, 
        ownerId, 
        paymentIntentId, 
        ownerName, 
        link,
        withSecurity 
      };
      console.log('Updating pixel with:', requestData);
      
      const response = await axios.post<{ pixel?: Pixel; currentPrice?: number }>(
        `${API_URL}/pixels`,
        requestData
      );
      
      console.log('Pixel update response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error updating pixel:', error);
      if (error.response) {
        console.error('Axios error details:', {
          status: error.response.status,
          data: error.response.data,
          message: error.message
        });
        throw new Error(error.response.data?.message || error.message);
      }
      throw error;
    }
  },

  // Handle successful payment
  handlePaymentSuccess: async (paymentData: PaymentData): Promise<Pixel> => {
    const response = await axios.post<Pixel>(`${API_URL}/pixels/payment-success`, paymentData);
    return response.data;
  },

  // Get free pixel count for a user
  getFreePixelCount: async (browserId: string): Promise<number> => {
    const response = await axios.get<number>(`${API_URL}/pixels/free-count/${browserId}`);
    return response.data;
  },

  // Create a bulk payment intent
  createBulkPaymentIntent: async (
    pixels: Array<{ x: number; y: number; color: string; price: number }>,
    totalAmount: number,
    ownerId: string,
    ownerName: string
  ): Promise<{ clientSecret: string }> => {
    try {
      console.log('Creating bulk payment intent with:', { pixels, totalAmount, ownerId, ownerName });
      const response = await axios.post<{ clientSecret: string }>(
        `${API_URL}/payments/create-bulk-payment-intent`,
        { pixels, totalAmount, ownerId, ownerName }
      );
      console.log('Bulk payment intent created:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Error creating bulk payment intent:', error);
      if (error.response) {
        console.error('Axios error details:', {
          status: error.response.status,
          data: error.response.data,
          message: error.message
        });
        throw new Error(error.response.data?.message || error.message);
      }
      throw error;
    }
  },

  // Handle successful bulk payment
  handleBulkPaymentSuccess: async (paymentData: BulkPaymentData): Promise<Pixel[]> => {
    const response = await axios.post<Pixel[]>(`${API_URL}/pixels/bulk-payment-success`, paymentData);
    return response.data;
  },

  // Update pixel link
  updatePixelLink: async (x: number, y: number, link: string): Promise<Pixel> => {
    const response = await axios.put<Pixel>(`${API_URL}/pixels/${x}/${y}/link`, { link });
    return response.data;
  },

  // Get pixel history
  getPixelHistory: async (x: number, y: number): Promise<PixelHistory[]> => {
    try {
      const response = await axios.get<PixelHistory[]>(`${API_URL}/pixels/${x}/${y}/history`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching pixel history:', error);
      if (error.response) {
        console.error('Axios error details:', {
          status: error.response.status,
          data: error.response.data,
          message: error.message
        });
        throw new Error(error.response.data?.message || error.message);
      }
      throw error;
    }
  }
}; 