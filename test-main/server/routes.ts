import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { insertUserSchema, insertTransactionSchema, insertTradingSettingsSchema, insertTokenBalanceSchema, User, Transaction } from "@shared/schema";
import { SolanaService } from "./services/solana-service";
import { JupiterService } from "./services/jupiter-service";
import { PriceService } from "./services/price-service";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export async function registerRoutes(app: Express): Promise<Server> {
  const solanaService = new SolanaService();
  const jupiterService = new JupiterService();
  const priceService = new PriceService();
  
  // Dashboard stats endpoint
  app.get("/api/dashboard/stats", async (req, res) => {
    try {
      const users = Array.from((storage as any).users.values()) as User[];
      const transactions = Array.from((storage as any).transactions.values()) as Transaction[];
      
      const totalUsers = users.length;
      const activeUsers = users.filter((user: User) => user.walletAddress).length;
      const confirmedTransactions = transactions.filter((tx: Transaction) => tx.status === "confirmed");
      const totalTransactions = confirmedTransactions.length;
      
      const totalVolume = confirmedTransactions
        .reduce((sum: number, tx: Transaction) => sum + parseFloat(tx.solAmount || "0"), 0)
        .toFixed(2);
      
      const recentTransactions = transactions
        .sort((a: Transaction, b: Transaction) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
        .slice(0, 10)
        .map((tx: Transaction) => ({
          id: tx.id,
          type: tx.type,
          tokenSymbol: tx.tokenSymbol || "UNKNOWN",
          amount: `${tx.amount} tokens`,
          status: tx.status,
          createdAt: tx.createdAt!.toISOString(),
        }));
      
      res.json({
        totalUsers,
        activeUsers,
        totalTransactions,
        totalVolume,
        recentTransactions,
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching dashboard stats" });
    }
  });
  
  // Get user profile
  app.get("/api/users/:telegramId", async (req, res) => {
    try {
      const { telegramId } = req.params;
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return private key
      const { walletPrivateKey, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create or update user
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByTelegramId(userData.telegramId);
      if (existingUser) {
        // Update existing user
        const { walletPrivateKey, ...safeUser } = await storage.updateUser(existingUser.id, userData) || existingUser;
        return res.json(safeUser);
      }
      
      // Create new user
      const user = await storage.createUser(userData);
      const { walletPrivateKey, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid user data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user transactions
  app.get("/api/users/:telegramId/transactions", async (req, res) => {
    try {
      const { telegramId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const transactions = await storage.getUserTransactions(user.id, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create transaction
  app.post("/api/transactions", async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(transactionData);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update transaction status
  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const transaction = await storage.updateTransaction(id, updates);
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      res.json(transaction);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user token balances
  app.get("/api/users/:telegramId/balances", async (req, res) => {
    try {
      const { telegramId } = req.params;
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const balances = await storage.getUserTokenBalances(user.id);
      res.json(balances);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get/Update trading settings
  app.get("/api/users/:telegramId/settings", async (req, res) => {
    try {
      const { telegramId } = req.params;
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const settings = await storage.getTradingSettings(user.id);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/users/:telegramId/settings", async (req, res) => {
    try {
      const { telegramId } = req.params;
      
      const user = await storage.getUserByTelegramId(telegramId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const settingsData = insertTradingSettingsSchema.parse({
        ...req.body,
        userId: user.id
      });
      
      const settings = await storage.createOrUpdateTradingSettings(settingsData);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Solana Service Endpoints
  app.get("/api/solana/generate-wallet", async (req, res) => {
    try {
      const wallet = solanaService.generateWallet();
      res.json({
        publicKey: wallet.publicKey,
        privateKey: wallet.privateKey
      });
    } catch (error) {
      console.error("Wallet generation error:", error);
      res.status(500).json({ message: "Error generating wallet" });
    }
  });

  app.get("/api/solana/balance/:address", async (req, res) => {
    try {
      const { address } = req.params;
      const balance = await solanaService.getBalance(address);
      res.json({ balance });
    } catch (error) {
      console.error("Balance check error:", error);
      res.status(500).json({ message: "Error checking balance" });
    }
  });

  // Jupiter Service Endpoints
  app.get("/api/jupiter/quote", async (req, res) => {
    try {
      const { inputMint, outputMint, amount, slippageBps } = req.query;
      
      const quote = await jupiterService.getQuote(
        inputMint as string,
        outputMint as string,
        amount as string,
        parseInt(slippageBps as string) || 100
      );
      
      if (!quote) {
        return res.status(404).json({ message: "No quote available" });
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Jupiter quote error:", error);
      res.status(500).json({ message: "Error getting quote" });
    }
  });

  app.get("/api/jupiter/tokens", async (req, res) => {
    try {
      const tokens = await jupiterService.getSupportedTokens();
      res.json(tokens || []);
    } catch (error) {
      console.error("Jupiter tokens error:", error);
      res.status(500).json({ message: "Error getting tokens" });
    }
  });

  // Price Service Endpoints
  app.get("/api/prices/token", async (req, res) => {
    try {
      const { address } = req.query;
      
      const price = await priceService.getTokenPrice(address as string);
      const tokenInfo = await priceService.getTokenInfo(address as string);
      
      res.json({
        price,
        tokenInfo
      });
    } catch (error) {
      console.error("Price service error:", error);
      res.status(500).json({ message: "Error getting price data" });
    }
  });

  // User Management Endpoints (Fixed)
  app.get("/api/users/telegram/:telegramId", async (req, res) => {
    try {
      const { telegramId } = req.params;
      const user = await storage.getUserByTelegramId(telegramId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return private key
      const { walletPrivateKey, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const user = await storage.updateUser(id, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return private key
      const { walletPrivateKey, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Settings endpoints (Fixed)
  app.get("/api/settings/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const settings = await storage.getTradingSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.post("/api/settings", async (req, res) => {
    try {
      const settingsData = insertTradingSettingsSchema.parse(req.body);
      const settings = await storage.createOrUpdateTradingSettings(settingsData);
      res.status(201).json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid settings data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Token Balance Endpoints
  app.post("/api/token-balances", async (req, res) => {
    try {
      const balanceData = insertTokenBalanceSchema.parse(req.body);
      const balance = await storage.createOrUpdateTokenBalance(balanceData);
      res.status(201).json(balance);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid balance data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // On-the-fly download endpoints
  app.get("/api/downloads/bot-files", async (_req, res) => {
    try {
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", "attachment; filename=updated-bot-files.tar.gz");

      const tar = spawn("tar", [
        "-cz",
        "-C",
        "/workspace/server/services",
        "telegram-bot.ts",
        "jupiter-service.ts",
        "solana-service.ts",
      ]);

      tar.stdout.pipe(res);
      tar.stderr.on("data", (d) => console.error(d.toString()));
      tar.on("error", () => res.status(500).end());
    } catch (error) {
      res.status(500).json({ message: "Error preparing download" });
    }
  });

  app.get("/api/downloads/project", async (_req, res) => {
    try {
      res.setHeader("Content-Type", "application/gzip");
      res.setHeader("Content-Disposition", "attachment; filename=SolanaSniper-project.tar.gz");

      const tar = spawn("tar", [
        "-cz",
        "-C",
        "/workspace",
        ".",
      ]);

      tar.stdout.pipe(res);
      tar.stderr.on("data", (d) => console.error(d.toString()));
      tar.on("error", () => res.status(500).end());
    } catch (error) {
      res.status(500).json({ message: "Error preparing download" });
    }
  });

  // Simple HTML page with clickable links
  app.get("/download", (_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      `<!doctype html><html><head><meta charset=\"utf-8\"><title>Downloads</title></head><body>` +
      `<h1>Downloads</h1>` +
      `<ul>` +
      `<li><a href=\"/sniper.zip\">Download sniper.zip (full project)</a></li>` +
      `<li><a href=\"/api/downloads/project\">Download full project (tar.gz)</a></li>` +
      `<li><a href=\"/api/downloads/bot-files\">Download updated bot files only (tar.gz)</a></li>` +
      `</ul>` +
      `</body></html>`
    );
  });

  // Direct ZIP download endpoint
  app.get("/sniper.zip", (_req, res) => {
    try {
      const filePath = "/workspace/sniper.zip";
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: "sniper.zip not found. Create it first." });
      }
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", "attachment; filename=sniper.zip");
      fs.createReadStream(filePath).pipe(res);
    } catch (error) {
      res.status(500).json({ message: "Error preparing ZIP download" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
