import { type User, type InsertUser, type Transaction, type InsertTransaction, type TokenBalance, type InsertTokenBalance, type TradingSettings, type InsertTradingSettings } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User management
  getUser(id: string): Promise<User | undefined>;
  getUserByTelegramId(telegramId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // Transaction management
  getTransaction(id: string): Promise<Transaction | undefined>;
  getTransactionBySignature(signature: string): Promise<Transaction | undefined>;
  getUserTransactions(userId: string, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined>;
  
  // Token balance management
  getUserTokenBalances(userId: string): Promise<TokenBalance[]>;
  getTokenBalance(userId: string, tokenAddress: string): Promise<TokenBalance | undefined>;
  createOrUpdateTokenBalance(balance: InsertTokenBalance): Promise<TokenBalance>;
  
  // Trading settings
  getTradingSettings(userId: string): Promise<TradingSettings | undefined>;
  createOrUpdateTradingSettings(settings: InsertTradingSettings): Promise<TradingSettings>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private transactions: Map<string, Transaction>;
  private tokenBalances: Map<string, TokenBalance>;
  private tradingSettings: Map<string, TradingSettings>;

  constructor() {
    this.users = new Map();
    this.transactions = new Map();
    this.tokenBalances = new Map();
    this.tradingSettings = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByTelegramId(telegramId: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.telegramId === telegramId,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      ...insertUser,
      id,
      isActive: true,
      createdAt: new Date(),
      username: insertUser.username || null,
      firstName: insertUser.firstName || null,
      lastName: insertUser.lastName || null,
      walletAddress: insertUser.walletAddress || null,
      walletPrivateKey: insertUser.walletPrivateKey || null,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Transaction methods
  async getTransaction(id: string): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async getTransactionBySignature(signature: string): Promise<Transaction | undefined> {
    return Array.from(this.transactions.values()).find(
      (tx) => tx.signature === signature,
    );
  }

  async getUserTransactions(userId: string, limit = 50): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter((tx) => tx.userId === userId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
      .slice(0, limit);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = {
      ...insertTransaction,
      id,
      status: "pending",
      createdAt: new Date(),
      confirmedAt: null,
      signature: insertTransaction.signature || null,
      tokenSymbol: insertTransaction.tokenSymbol || null,
      tokenName: insertTransaction.tokenName || null,
      price: insertTransaction.price || null,
      slippage: insertTransaction.slippage || null,
      fees: insertTransaction.fees || null,
      metadata: insertTransaction.metadata || null,
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction | undefined> {
    const transaction = this.transactions.get(id);
    if (!transaction) return undefined;
    
    const updatedTransaction = { 
      ...transaction, 
      ...updates,
      confirmedAt: updates.status === "confirmed" ? new Date() : transaction.confirmedAt
    };
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }

  // Token balance methods
  async getUserTokenBalances(userId: string): Promise<TokenBalance[]> {
    return Array.from(this.tokenBalances.values()).filter(
      (balance) => balance.userId === userId,
    );
  }

  async getTokenBalance(userId: string, tokenAddress: string): Promise<TokenBalance | undefined> {
    return Array.from(this.tokenBalances.values()).find(
      (balance) => balance.userId === userId && balance.tokenAddress === tokenAddress,
    );
  }

  async createOrUpdateTokenBalance(insertBalance: InsertTokenBalance): Promise<TokenBalance> {
    const existing = await this.getTokenBalance(insertBalance.userId, insertBalance.tokenAddress);
    
    if (existing) {
      const updated = {
        ...existing,
        ...insertBalance,
        lastUpdated: new Date(),
      };
      this.tokenBalances.set(existing.id, updated);
      return updated;
    }
    
    const id = randomUUID();
    const balance: TokenBalance = {
      ...insertBalance,
      id,
      lastUpdated: new Date(),
      tokenSymbol: insertBalance.tokenSymbol || null,
      tokenName: insertBalance.tokenName || null,
    };
    this.tokenBalances.set(id, balance);
    return balance;
  }

  // Trading settings methods
  async getTradingSettings(userId: string): Promise<TradingSettings | undefined> {
    return Array.from(this.tradingSettings.values()).find(
      (settings) => settings.userId === userId,
    );
  }

  async createOrUpdateTradingSettings(insertSettings: InsertTradingSettings): Promise<TradingSettings> {
    const existing = await this.getTradingSettings(insertSettings.userId);
    
    if (existing) {
      const updated = { ...existing, ...insertSettings };
      this.tradingSettings.set(existing.id, updated);
      return updated;
    }
    
    const id = randomUUID();
    const settings: TradingSettings = {
      ...insertSettings,
      id,
      defaultSlippage: insertSettings.defaultSlippage || "1",
      maxTransactionAmount: insertSettings.maxTransactionAmount || "1",
      autoConfirm: insertSettings.autoConfirm || false,
      notifications: insertSettings.notifications !== undefined ? insertSettings.notifications : true,
    };
    this.tradingSettings.set(id, settings);
    return settings;
  }
}

export const storage = new MemStorage();
