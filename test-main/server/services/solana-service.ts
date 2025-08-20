import {
  Connection,
  PublicKey,
  Keypair,
  LAMPORTS_PER_SOL,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import bs58 from "bs58";

export interface WalletInfo {
  publicKey: string;
  privateKey: string;
}

export interface TokenAccount {
  address: string;
  mint: string;
  balance: string;
}

export class SolanaService {
  private connection: Connection;
  private network: "mainnet" | "devnet";

  constructor() {
    // Determine network; default to devnet for safety, enable mainnet via env
    const explicitNetwork = (process.env.SOLANA_NETWORK || "").toLowerCase();
    const inferredFromUrl = (process.env.SOLANA_RPC_URL || "").includes("devnet") ? "devnet" : "mainnet";
    this.network = explicitNetwork === "mainnet" || explicitNetwork === "devnet" ? (explicitNetwork as any) : inferredFromUrl as any;

    const defaultRpc = this.network === "mainnet"
      ? "https://api.mainnet-beta.solana.com"
      : "https://api.devnet.solana.com";

    const rpcUrl = process.env.SOLANA_RPC_URL || defaultRpc;
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  generateWallet(): WalletInfo {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey.toString(),
      privateKey: bs58.encode(keypair.secretKey),
    };
  }

  getKeypairFromPrivateKey(privateKey: string): Keypair {
    try {
      const secretKey = bs58.decode(privateKey);
      return Keypair.fromSecretKey(secretKey);
    } catch (error) {
      throw new Error("Invalid private key format");
    }
  }

  async getBalance(publicKey: string): Promise<number> {
    try {
      const pubKey = new PublicKey(publicKey);
      const balance = await this.connection.getBalance(pubKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error("Error getting balance:", error);
      return 0;
    }
  }

  async getTokenBalance(walletAddress: string, tokenMintAddress: string): Promise<string> {
    try {
      const walletPubKey = new PublicKey(walletAddress);
      const mintPubKey = new PublicKey(tokenMintAddress);

      // Get the associated token account address
      const associatedTokenAccount = await getAssociatedTokenAddress(
        mintPubKey,
        walletPubKey
      );

      try {
        const accountInfo = await getAccount(this.connection, associatedTokenAccount);
        // Get token mint info to get decimals
        const mintInfo = await this.connection.getParsedAccountInfo(mintPubKey);
        const decimals = (mintInfo.value?.data as any)?.parsed?.info?.decimals || 9;
        return (Number(accountInfo.amount) / Math.pow(10, decimals)).toString();
      } catch (error) {
        // Account doesn't exist, balance is 0
        return "0";
      }
    } catch (error) {
      console.error("Error getting token balance:", error);
      return "0";
    }
  }

  async getAllTokenBalances(walletAddress: string): Promise<TokenAccount[]> {
    try {
      const walletPubKey = new PublicKey(walletAddress);
      
      // Get all token accounts for this wallet
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPubKey,
        { programId: TOKEN_PROGRAM_ID }
      );

      const balances: TokenAccount[] = [];

      for (const account of tokenAccounts.value) {
        const accountData = account.account.data.parsed.info;
        const balance = accountData.tokenAmount.uiAmount;
        
        if (balance > 0) {
          balances.push({
            address: account.pubkey.toString(),
            mint: accountData.mint,
            balance: balance.toString(),
          });
        }
      }

      return balances;
    } catch (error) {
      console.error("Error getting token balances:", error);
      return [];
    }
  }

  async sendTransaction(transaction: Transaction, signerPrivateKey: string): Promise<string> {
    try {
      const signer = this.getKeypairFromPrivateKey(signerPrivateKey);
      
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = signer.publicKey;

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [signer],
        {
          commitment: "confirmed",
          maxRetries: 3,
        }
      );

      return signature;
    } catch (error) {
      console.error("Error sending transaction:", error);
      throw error;
    }
  }

  async sendSignedTransaction(rawTransaction: Uint8Array): Promise<string> {
    try {
      const signature = await this.connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        maxRetries: 3,
      });
      await this.connection.confirmTransaction(signature, "confirmed");
      return signature;
    } catch (error) {
      console.error("Error sending signed transaction:", error);
      throw error;
    }
  }

  async getTransactionStatus(signature: string): Promise<{
    confirmed: boolean;
    error?: string;
  }> {
    try {
      const status = await this.connection.getSignatureStatus(signature);
      
      if (status.value === null) {
        return { confirmed: false };
      }

      return {
        confirmed: status.value.confirmationStatus === "confirmed" || 
                  status.value.confirmationStatus === "finalized",
        error: status.value.err ? "Transaction failed" : undefined,
      };
    } catch (error) {
      console.error("Error getting transaction status:", error);
      return { confirmed: false, error: "Error checking status" };
    }
  }

  async airdropSol(publicKey: string, amount: number): Promise<string> {
    try {
      const pubKey = new PublicKey(publicKey);
      const signature = await this.connection.requestAirdrop(
        pubKey,
        amount * LAMPORTS_PER_SOL
      );

      // Wait for confirmation
      await this.connection.confirmTransaction(signature);
      return signature;
    } catch (error) {
      console.error("Error requesting airdrop:", error);
      throw error;
    }
  }

  isValidPublicKey(publicKey: string): boolean {
    try {
      new PublicKey(publicKey);
      return true;
    } catch {
      return false;
    }
  }

  isDevnet(): boolean {
    return this.network === "devnet";
  }
}
