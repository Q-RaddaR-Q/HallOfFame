import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

interface PixelConfig {
  minPrice: number;
  maxPixels: number;
  processingFee: number;
}

class ConfigService {
  private static instance: ConfigService;
  private config: PixelConfig | null = null;
  private configPromise: Promise<PixelConfig> | null = null;

  private constructor() {}

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  public async getConfig(): Promise<PixelConfig> {
    if (this.config) {
      return this.config;
    }

    if (this.configPromise) {
      return this.configPromise;
    }

    this.configPromise = new Promise<PixelConfig>((resolve, reject) => {
      axios.get<PixelConfig>(`${API_URL}/pixels/config`)
        .then(response => {
          this.config = response.data;
          resolve(this.config);
        })
        .catch(error => {
          console.error('Error fetching pixel configuration:', error);
          reject(new Error('Failed to fetch pixel configuration from server'));
        });
    });

    return this.configPromise;
  }

  public async getMinPrice(): Promise<number> {
    const config = await this.getConfig();
    return config.minPrice;
  }

  public async getMaxPixels(): Promise<number> {
    const config = await this.getConfig();
    return config.maxPixels;
  }

  public async getProcessingFee(): Promise<number> {
    const config = await this.getConfig();
    return config.processingFee;
  }
}

export const configService = ConfigService.getInstance(); 