import axios from "axios";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { SolanaService } from "./solana-service";

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export interface SwapRequest {
  userPublicKey: string;
  wrapAndUnwrapSol: boolean;
  useSharedAccounts: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
}

export interface SwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
}

export class JupiterService {
  private readonly JUPITER_API_URL = "https://quote-api.jup.ag/v6"; // Completely free API
  private solanaService: SolanaService;
  private readonly SOL_MINT = "So11111111111111111111111111111111111111112";

  constructor() {
    this.solanaService = new SolanaService();
  }

  async getQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number = 100 // 1% slippage
  ): Promise<JupiterQuote | null> {
    try {
      const response = await axios.get(`${this.JUPITER_API_URL}/quote`, {
        params: {
          inputMint,
          outputMint,
          amount,
          slippageBps,
          onlyDirectRoutes: false,
          asLegacyTransaction: true,
          // route to correct cluster
          platform: this.solanaService.isDevnet() ? "solana-devnet" : "solana",
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error getting Jupiter quote:", error);
      return null;
    }
  }

  async getSwapTransaction(
    quote: JupiterQuote,
    userPublicKey: string,
    options: Partial<SwapRequest> = {}
  ): Promise<SwapResponse | null> {
    try {
      const swapRequest: SwapRequest = {
        userPublicKey,
        wrapAndUnwrapSol: true,
        useSharedAccounts: true,
        asLegacyTransaction: true,
        computeUnitPriceMicroLamports: 2000000, // 0.002 SOL priority fee
        ...options,
      };

      const response = await axios.post(`${this.JUPITER_API_URL}/swap`, {
        quoteResponse: quote,
        ...swapRequest,
      }, {
        params: {
          platform: this.solanaService.isDevnet() ? "solana-devnet" : "solana",
        }
      });

      return response.data;
    } catch (error) {
      console.error("Error getting swap transaction:", error);
      return null;
    }
  }

  async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: string,
    userPrivateKey: string,
    slippageBps: number = 100
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    quote?: JupiterQuote;
  }> {
    try {
      // Get the user's public key
      const keypair = this.solanaService.getKeypairFromPrivateKey(userPrivateKey);
      const userPublicKey = keypair.publicKey.toString();

      // Get quote
      const quote = await this.getQuote(inputMint, outputMint, amount, slippageBps);
      if (!quote) {
        return { success: false, error: "Unable to get quote for this swap" };
      }

      // Check price impact
      const priceImpact = parseFloat(quote.priceImpactPct);
      if (priceImpact > 10) { // 10% price impact warning
        return { 
          success: false, 
          error: `High price impact: ${priceImpact.toFixed(2)}%. This swap may not be profitable.`,
          quote 
        };
      }

      // Get swap transaction
      const swapResponse = await this.getSwapTransaction(quote, userPublicKey);
      if (!swapResponse) {
        return { success: false, error: "Unable to create swap transaction", quote };
      }

      // Deserialize and execute transaction
      const swapTransactionBuf = Buffer.from(swapResponse.swapTransaction, "base64");
      const versionedTx = VersionedTransaction.deserialize(swapTransactionBuf);

      // Sign versioned transaction
      versionedTx.sign([keypair]);

      // Send signed transaction bytes
      const signature = await this.solanaService.sendSignedTransaction(versionedTx.serialize());

      return {
        success: true,
        signature,
        quote,
      };
    } catch (error) {
      console.error("Error executing swap:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  async buyToken(
    tokenMint: string,
    solAmount: string,
    userPrivateKey: string,
    slippageBps: number = 100
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    quote?: JupiterQuote;
  }> {
    // Convert SOL to lamports
    const lamports = (parseFloat(solAmount) * 1e9).toString();

    return this.executeSwap(this.SOL_MINT, tokenMint, lamports, userPrivateKey, slippageBps);
  }

  async sellToken(
    tokenMint: string,
    tokenAmount: string,
    userPrivateKey: string,
    slippageBps: number = 100
  ): Promise<{
    success: boolean;
    signature?: string;
    error?: string;
    quote?: JupiterQuote;
  }> {
    // Convert token amount to smallest unit (assuming 9 decimals for most tokens)
    const tokenAmountInSmallestUnit = (parseFloat(tokenAmount) * 1e9).toString();

    return this.executeSwap(tokenMint, this.SOL_MINT, tokenAmountInSmallestUnit, userPrivateKey, slippageBps);
  }

  async getTokenPrice(tokenMint: string): Promise<number | null> {
    try {
      // Get price by getting a quote for 1 SOL worth of the token
      const oneSOLInLamports = "1000000000"; // 1 SOL

      const quote = await this.getQuote(this.SOL_MINT, tokenMint, oneSOLInLamports);
      if (!quote) return null;

      // Calculate price: 1 SOL / tokens received = price per token in SOL
      const tokensReceived = parseFloat(quote.outAmount) / 1e9; // Assuming 9 decimals
      const priceInSOL = 1 / tokensReceived;

      return priceInSOL;
    } catch (error) {
      console.error("Error getting token price:", error);
      return null;
    }
  }

  async getSupportedTokens(): Promise<Array<{
    address: string;
    symbol: string;
    name: string;
    decimals: number;
    logoURI?: string;
  }> | null> {
    try {
      const response = await axios.get("https://tokens.jup.ag/tokens?tags=verified");
      return response.data;
    } catch (error) {
      console.error("Error getting supported tokens:", error);
      return null;
    }
  }

  formatAmount(amount: string, decimals: number = 9): string {
    return (parseFloat(amount) / Math.pow(10, decimals)).toFixed(6);
  }
}
