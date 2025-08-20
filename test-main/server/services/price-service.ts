import axios from "axios";

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price?: number;
}

export interface PriceData {
  id: string;
  mintSymbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
}

export class PriceService {
  private tokenCache = new Map<string, { data: TokenInfo; timestamp: number }>();
  private priceCache = new Map<string, { price: number; timestamp: number }>();
  private readonly CACHE_DURATION = 60000; // 1 minute cache

  async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      // Check cache first
      const cached = this.tokenCache.get(tokenAddress);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.data;
      }

      // Try to get token info from Jupiter's token list
      const response = await axios.get(`https://tokens.jup.ag/token/${tokenAddress}`);
      const tokenData = response.data;

      const tokenInfo: TokenInfo = {
        address: tokenAddress,
        symbol: tokenData.symbol || "UNKNOWN",
        name: tokenData.name || "Unknown Token",
        decimals: tokenData.decimals || 9,
        logoURI: tokenData.logoURI,
      };

      // Cache the result
      this.tokenCache.set(tokenAddress, {
        data: tokenInfo,
        timestamp: Date.now(),
      });

      return tokenInfo;
    } catch (error) {
      console.error("Error getting token info:", error);
      
      // Fallback to basic info if API fails
      return {
        address: tokenAddress,
        symbol: "UNKNOWN",
        name: "Unknown Token",
        decimals: 9,
      };
    }
  }

  async getTokenPrice(tokenAddress: string): Promise<number | null> {
    try {
      // Check cache first
      const cached = this.priceCache.get(tokenAddress);
      if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
        return cached.price;
      }

      // Try multiple price APIs
      let price = await this.getPriceFromBirdeye(tokenAddress);
      
      if (!price) {
        price = await this.getPriceFromCoingecko(tokenAddress);
      }

      if (!price) {
        price = await this.getPriceFromJupiter(tokenAddress);
      }

      if (price) {
        // Cache the result
        this.priceCache.set(tokenAddress, {
          price,
          timestamp: Date.now(),
        });
      }

      return price;
    } catch (error) {
      console.error("Error getting token price:", error);
      return null;
    }
  }

  private async getPriceFromBirdeye(tokenAddress: string): Promise<number | null> {
    try {
      // Skip Birdeye if no API key - it's optional for free usage
      if (!process.env.BIRDEYE_API_KEY) {
        return null;
      }

      const response = await axios.get(
        `https://public-api.birdeye.so/defi/price?address=${tokenAddress}`,
        {
          headers: {
            'X-API-KEY': process.env.BIRDEYE_API_KEY,
          },
        }
      );

      return response.data?.data?.value || null;
    } catch (error) {
      return null;
    }
  }

  private async getPriceFromCoingecko(tokenAddress: string): Promise<number | null> {
    try {
      // CoinGecko has free tier with rate limits - completely free for basic usage
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/simple/token_price/solana?contract_addresses=${tokenAddress}&vs_currencies=usd`
      );

      return response.data[tokenAddress.toLowerCase()]?.usd || null;
    } catch (error) {
      return null;
    }
  }

  private async getPriceFromJupiter(tokenAddress: string): Promise<number | null> {
    try {
      // Jupiter's quote API is completely free to use
      const response = await axios.get(`https://quote-api.jup.ag/v6/quote`, {
        params: {
          inputMint: "So11111111111111111111111111111111111111112", // SOL
          outputMint: tokenAddress,
          amount: "1000000000", // 1 SOL in lamports
          slippageBps: 100,
        },
      });

      if (response.data?.outAmount) {
        // Calculate price: 1 SOL / tokens received = price per token in SOL
        const tokensReceived = parseFloat(response.data.outAmount) / 1e9;
        const priceInSOL = 1 / tokensReceived;
        
        // Get SOL price from a free source or use fallback
        const solPrice = await this.getSOLPrice() || 100; // Free SOL price or fallback
        return priceInSOL * solPrice;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async getSOLPrice(): Promise<number | null> {
    try {
      // Use free CoinGecko API for SOL price
      const response = await axios.get(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd'
      );
      return response.data?.solana?.usd || null;
    } catch (error) {
      return null;
    }
  }

  async getTokenBySymbol(symbol: string): Promise<string | null> {
    try {
      // Search in Jupiter's token list
      const response = await axios.get("https://tokens.jup.ag/tokens?tags=verified");
      const tokens = response.data;

      const token = tokens.find((t: any) => 
        t.symbol.toLowerCase() === symbol.toLowerCase()
      );

      return token?.address || null;
    } catch (error) {
      console.error("Error searching token by symbol:", error);
      return null;
    }
  }

  async getMarketData(tokenAddress: string): Promise<PriceData | null> {
    try {
      // Try to get comprehensive market data from Birdeye
      const response = await axios.get(
        `https://public-api.birdeye.so/defi/token_overview?address=${tokenAddress}`,
        {
          headers: {
            'X-API-KEY': process.env.BIRDEYE_API_KEY || '',
          },
        }
      );

      const data = response.data?.data;
      if (!data) return null;

      return {
        id: tokenAddress,
        mintSymbol: data.symbol || "UNKNOWN",
        price: data.price || 0,
        priceChange24h: data.priceChange24hPercent || 0,
        volume24h: data.volume24h || 0,
        marketCap: data.marketCap || 0,
      };
    } catch (error) {
      console.error("Error getting market data:", error);
      return null;
    }
  }

  async getTopTokens(limit: number = 20): Promise<TokenInfo[]> {
    try {
      const response = await axios.get("https://tokens.jup.ag/tokens?tags=verified");
      const tokens = response.data;

      return tokens.slice(0, limit).map((token: any) => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.logoURI,
      }));
    } catch (error) {
      console.error("Error getting top tokens:", error);
      return [];
    }
  }

  clearCache(): void {
    this.tokenCache.clear();
    this.priceCache.clear();
  }
}
