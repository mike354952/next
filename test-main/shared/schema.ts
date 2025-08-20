import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  walletAddress: text("wallet_address"),
  walletPrivateKey: text("wallet_private_key"), // encrypted
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  signature: text("signature").unique(),
  type: text("type").notNull(), // 'buy' | 'sell'
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol"),
  tokenName: text("token_name"),
  amount: decimal("amount", { precision: 20, scale: 9 }).notNull(),
  solAmount: decimal("sol_amount", { precision: 20, scale: 9 }).notNull(),
  price: decimal("price", { precision: 20, scale: 9 }),
  status: text("status").notNull().default("pending"), // 'pending' | 'confirmed' | 'failed'
  slippage: decimal("slippage", { precision: 5, scale: 2 }).default("1"),
  fees: decimal("fees", { precision: 20, scale: 9 }),
  metadata: json("metadata"), // Additional transaction details
  createdAt: timestamp("created_at").default(sql`now()`),
  confirmedAt: timestamp("confirmed_at"),
});

export const tokenBalances = pgTable("token_balances", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  tokenAddress: text("token_address").notNull(),
  tokenSymbol: text("token_symbol"),
  tokenName: text("token_name"),
  balance: decimal("balance", { precision: 20, scale: 9 }).notNull(),
  lastUpdated: timestamp("last_updated").default(sql`now()`),
});

export const tradingSettings = pgTable("trading_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull().unique(),
  defaultSlippage: decimal("default_slippage", { precision: 5, scale: 2 }).default("1"),
  maxTransactionAmount: decimal("max_transaction_amount", { precision: 20, scale: 9 }).default("1"),
  autoConfirm: boolean("auto_confirm").default(false),
  notifications: boolean("notifications").default(true),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  telegramId: true,
  username: true,
  firstName: true,
  lastName: true,
  walletAddress: true,
  walletPrivateKey: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  userId: true,
  signature: true,
  type: true,
  tokenAddress: true,
  tokenSymbol: true,
  tokenName: true,
  amount: true,
  solAmount: true,
  price: true,
  slippage: true,
  fees: true,
  metadata: true,
});

export const insertTokenBalanceSchema = createInsertSchema(tokenBalances).pick({
  userId: true,
  tokenAddress: true,
  tokenSymbol: true,
  tokenName: true,
  balance: true,
});

export const insertTradingSettingsSchema = createInsertSchema(tradingSettings).pick({
  userId: true,
  defaultSlippage: true,
  maxTransactionAmount: true,
  autoConfirm: true,
  notifications: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type TokenBalance = typeof tokenBalances.$inferSelect;
export type InsertTokenBalance = z.infer<typeof insertTokenBalanceSchema>;

export type TradingSettings = typeof tradingSettings.$inferSelect;
export type InsertTradingSettings = z.infer<typeof insertTradingSettingsSchema>;
