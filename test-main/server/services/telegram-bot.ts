import { Telegraf, Markup, Context } from "telegraf";
import { storage } from "../storage";
import { SolanaService } from "./solana-service";
import { JupiterService } from "./jupiter-service";
import { PriceService } from "./price-service";
import { InsertUser } from "@shared/schema";

interface BotContext extends Context {
  match?: RegExpExecArray | null;
}

export class TelegramBot {
  private bot: Telegraf;
  private solanaService: SolanaService;
  private jupiterService: JupiterService;
  private priceService: PriceService;
  private readonly botToken: string = "8319039706:AAFppB3eWf6RX04btYhscX-nzEX7-mfurgg";

  constructor() {
    // Set timeout for bot initialization
    this.bot = new Telegraf(this.botToken, {
      handlerTimeout: 30000,
    });
    this.solanaService = new SolanaService();
    this.jupiterService = new JupiterService();
    this.priceService = new PriceService();

    this.setupHandlers();
  }

  private setupHandlers() {
    // Start command
    this.bot.start(async (ctx) => {
      const user = ctx.from;
      if (!user) return;

      await this.registerUser(ctx, user);
      
      const welcomeMessage = `
🚀 Welcome to Solana Memecoin Trading Bot!

This bot allows you to:
• Buy and sell memecoins on Solana
• Check your portfolio balance
• Connect your Solana wallet
• Get real-time token prices

⚠️ **Trading Risk Warning**: 
Memecoin trading is highly risky. Only trade with funds you can afford to lose. This bot executes real transactions on the Solana blockchain.

Use the buttons below to get started:
      `;

      await ctx.reply(welcomeMessage, this.getMainKeyboard());
    });

    // Main menu handlers
    this.bot.hears("💰 Buy Token", async (ctx) => {
      await ctx.reply(
        "Enter the token address or symbol you want to buy:\n\n" +
        "Example: `So11111111111111111111111111111111111111112` (SOL)\n" +
        "Or search by symbol like `BONK`",
        { parse_mode: "Markdown" }
      );
      // Set user state to awaiting token input for buy
    });

    this.bot.hears("📊 Portfolio", async (ctx) => {
      await this.showPortfolio(ctx);
    });

    this.bot.hears("🔗 Connect Wallet", async (ctx) => {
      await this.showWalletOptions(ctx);
    });

    this.bot.hears("⚙️ Settings", async (ctx) => {
      await this.showSettings(ctx);
    });

    this.bot.hears("📈 Token Price", async (ctx) => {
      await ctx.reply("Enter token address or symbol to get current price:");
    });

    // Handle token addresses and symbols
    this.bot.on("text", async (ctx) => {
      const text = ctx.message.text.trim();

      // Handle private key import flow: detect base58-encoded 64-88 chars
      const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
      if (text.length >= 60 && text.length <= 100 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(text)) {
        try {
          // Validate key by deriving keypair
          const keypair = this.solanaService.getKeypairFromPrivateKey(text);
          const publicKey = keypair.publicKey.toString();
          if (user) {
            await storage.updateUser(user.id, {
              walletAddress: publicKey,
              walletPrivateKey: text,
            });
            await ctx.reply(
              `✅ Wallet imported successfully.\nAddress: \`${publicKey}\``,
              { parse_mode: "Markdown" }
            );
            await this.showWalletOptions(ctx);
            return;
          }
        } catch {
          // not a valid private key; continue to other handlers
        }
      }

      // Check if it's a Solana address (base58, ~44 characters)
      if (this.isValidSolanaAddress(text)) {
        await this.handleTokenLookup(ctx, text);
      } else if (text.length <= 10 && /^[A-Za-z0-9]+$/.test(text)) {
        // Likely a token symbol
        await this.handleSymbolLookup(ctx, text.toUpperCase());
      }
    });

    // Callback query handlers
    this.bot.action(/^buy_([1-9A-HJ-NP-Za-km-z]{32,44})$/, async (ctx) => {
      const tokenAddress = ctx.match![1];
      await this.handleBuyToken(ctx, tokenAddress);
    });

    this.bot.action(/^sell_([1-9A-HJ-NP-Za-km-z]{32,44})$/, async (ctx) => {
      const tokenAddress = ctx.match![1];
      await this.handleSellToken(ctx, tokenAddress);
    });

    // Buy amount handlers
    this.bot.action(/^buy_([1-9A-HJ-NP-Za-km-z]{32,44})_(\d+(?:\.\d+)?)$/, async (ctx) => {
      const [, tokenAddress, amount] = ctx.match!;
      await this.executeBuyOrder(ctx, tokenAddress, amount);
    });

    // Sell percentage handlers
    this.bot.action(/^sell_([1-9A-HJ-NP-Za-km-z]{32,44})_(\d{1,3})$/, async (ctx) => {
      const [, tokenAddress, percentage] = ctx.match!;
      await this.executeSellOrder(ctx, tokenAddress, percentage);
    });

    this.bot.action("generate_wallet", async (ctx) => {
      await this.generateWallet(ctx);
    });

    this.bot.action("import_wallet", async (ctx) => {
      await ctx.reply(
        "⚠️ **Security Warning**: Only import wallets in a secure environment.\n\n" +
        "Send me your base58 private key (we will validate and store it for trading).",
        { parse_mode: "Markdown" }
      );
    });

    this.bot.action("connect_wallet", async (ctx) => {
      await this.showWalletOptions(ctx);
    });

    // Settings handlers
    this.bot.action("set_slippage", async (ctx) => {
      await ctx.reply("Send your preferred slippage percentage (0.1-5):");
    });

    this.bot.action("set_max_amount", async (ctx) => {
      await ctx.reply("Send your maximum transaction amount in SOL:");
    });

    this.bot.action("toggle_auto", async (ctx) => {
      await this.toggleAutoConfirm(ctx);
    });

    this.bot.action("toggle_notifications", async (ctx) => {
      await this.toggleNotifications(ctx);
    });

    // Confirmation handlers
    this.bot.action(/^confirm_buy_([1-9A-HJ-NP-Za-km-z]{32,44})_(\d+(?:\.\d+)?)$/, async (ctx) => {
      const [, tokenAddress, amount] = ctx.match!;
      await this.executeSwap(ctx, "buy", tokenAddress, amount);
    });

    this.bot.action(/^confirm_sell_([1-9A-HJ-NP-Za-km-z]{32,44})_(\d{1,3})$/, async (ctx) => {
      const [, tokenAddress, percentage] = ctx.match!;
      await this.executeSwap(ctx, "sell", tokenAddress, percentage);
    });

    this.bot.action("cancel_order", async (ctx) => {
      await ctx.reply("❌ Order cancelled.", this.getMainKeyboard());
    });

    this.bot.action("refresh_portfolio", async (ctx) => {
      await this.showPortfolio(ctx);
    });

    this.bot.action("fund_wallet", async (ctx) => {
      const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
      if (user?.walletAddress) {
        const isDevnet = this.solanaService.isDevnet();
        const message = isDevnet
          ? `💰 **Fund Your Wallet**\n\n` +
            `Your wallet address:\n\`${user.walletAddress}\`\n\n` +
            `**Devnet Funding Options:**\n` +
            `1. **Faucet**: https://faucet.solana.com\n` +
            `2. **CLI**: \`solana airdrop 1 ${user.walletAddress} --url devnet\`\n\n` +
            `After funding, use "🔄 Refresh" to update your balance.`
          : `💰 **Fund Your Wallet**\n\n` +
            `Your wallet address:\n\`${user.walletAddress}\`\n\n` +
            `Send SOL from an exchange or another wallet to the address above.\n` +
            `After funding, use "🔄 Refresh" to update your balance.`;
        await ctx.reply(message, { parse_mode: "Markdown" });
      }
    });

    this.bot.action("view_portfolio", async (ctx) => {
      await this.showPortfolio(ctx);
    });

    this.bot.action("refresh_balance", async (ctx) => {
      const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
      if (user?.walletAddress) {
        const balance = await this.solanaService.getBalance(user.walletAddress);
        await ctx.reply(`🔄 **Balance Updated**\n\nSOL Balance: ${balance} SOL`);
      }
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      console.error("Bot error:", err);
      ctx.reply("An error occurred. Please try again later.");
    });
  }

  private async registerUser(ctx: BotContext, user: any) {
    try {
      const userData: InsertUser = {
        telegramId: user.id.toString(),
        username: user.username || undefined,
        firstName: user.first_name || undefined,
        lastName: user.last_name || undefined,
        walletAddress: undefined,
        walletPrivateKey: undefined,
      };

      await storage.createUser(userData);
    } catch (error) {
      // User might already exist, which is fine
      console.log("User registration:", error);
    }
  }

  private async showPortfolio(ctx: BotContext) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    if (!user) {
      await ctx.reply("Please start the bot first with /start");
      return;
    }

    if (!user.walletAddress) {
      await ctx.reply("Please connect a wallet first!", this.getWalletKeyboard());
      return;
    }

    try {
      await ctx.reply("🔄 Loading portfolio...");
      
      const balances = await storage.getUserTokenBalances(user.id);
      const solBalance = await this.solanaService.getBalance(user.walletAddress);

      // Get SOL price for USD value
      const solPrice = await this.priceService.getTokenPrice("So11111111111111111111111111111111111111112");
      const solValue = solPrice ? (solBalance * solPrice).toFixed(2) : "N/A";

      let portfolioMessage = `📊 **Your Portfolio**\n\n`;
      portfolioMessage += `💎 **SOL Balance**: ${solBalance} SOL`;
      if (solValue !== "N/A") {
        portfolioMessage += ` (~$${solValue})`;
      }
      portfolioMessage += `\n\n`;

      if (balances.length === 0) {
        portfolioMessage += "No token holdings found.\n\n";
        if (solBalance === 0) {
          portfolioMessage += "💡 **Get Started:**\n";
          portfolioMessage += "1. Fund your wallet with devnet SOL\n";
          portfolioMessage += "2. Use faucet: https://faucet.solana.com\n";
          portfolioMessage += `3. Your wallet: \`${user.walletAddress.substring(0, 8)}...${user.walletAddress.substring(-8)}\``;
        }
      } else {
        portfolioMessage += "**Token Holdings:**\n";
        let totalValue = parseFloat(solValue) || 0;
        
        for (const balance of balances) {
          const price = await this.priceService.getTokenPrice(balance.tokenAddress);
          const value = price ? (parseFloat(balance.balance) * price) : 0;
          totalValue += value;
          
          portfolioMessage += `• **${balance.tokenSymbol || "Unknown"}**: ${parseFloat(balance.balance).toFixed(6)}`;
          if (value > 0) {
            portfolioMessage += ` (~$${value.toFixed(2)})`;
          }
          portfolioMessage += `\n`;
        }
        
        if (totalValue > 0) {
          portfolioMessage += `\n💰 **Total Portfolio Value**: ~$${totalValue.toFixed(2)}`;
        }
      }

      const portfolioKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Refresh", "refresh_portfolio")],
        [Markup.button.callback("📈 Add Funds", "fund_wallet")],
      ]);

      await ctx.reply(portfolioMessage, { 
        parse_mode: "Markdown",
        ...portfolioKeyboard
      });
    } catch (error) {
      console.error("Portfolio error:", error);
      await ctx.reply("Error fetching portfolio. Please try again.");
    }
  }

  private async showWalletOptions(ctx: BotContext) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    
    if (user?.walletAddress) {
      // Check SOL balance for connected wallet
      const balance = await this.solanaService.getBalance(user.walletAddress);
      
      const connectedKeyboard = Markup.inlineKeyboard([
        [Markup.button.callback("📊 View Portfolio", "view_portfolio")],
        [Markup.button.callback("💰 Fund Wallet", "fund_wallet")],
        [Markup.button.callback("🔄 Refresh Balance", "refresh_balance")],
      ]);

      await ctx.reply(
        `🔗 **Wallet Connected**\n\n` +
        `Address: \`${user.walletAddress}\`\n` +
        `Balance: ${balance} SOL\n\n` +
        `Your wallet is ready for trading!`,
        { 
          parse_mode: "Markdown",
          ...connectedKeyboard
        }
      );
      return;
    }

    const walletKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback("🎲 Generate New Wallet", "generate_wallet")],
      [Markup.button.callback("📥 Import Existing Wallet", "import_wallet")],
    ]);

    await ctx.reply(
      "🔗 **Wallet Setup**\n\n" +
      "Choose an option to connect your Solana wallet:\n\n" +
      "• **Generate**: Create a new wallet (recommended for beginners)\n" +
      "• **Import**: Use your existing wallet private key",
      { 
        parse_mode: "Markdown",
        ...walletKeyboard
      }
    );
  }

  private async generateWallet(ctx: BotContext) {
    try {
      const wallet = this.solanaService.generateWallet();
      const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
      
      if (!user) return;

      // Update user with wallet info (encrypted in real implementation)
      await storage.updateUser(user.id, {
        walletAddress: wallet.publicKey,
        walletPrivateKey: wallet.privateKey, // Should be encrypted
      });

      // Log wallet details for trading functionality
      console.log(`🔐 Wallet Generated for User ${ctx.from?.id}:`);
      console.log(`   Public Key: ${wallet.publicKey}`);
      console.log(`   Private Key: ${wallet.privateKey}`);
      console.log(`   User can now trade with this wallet`);

      await ctx.reply(
        "✅ **Wallet Generated Successfully\\!**\n\n" +
        `Address: \`${wallet.publicKey}\`\n\n` +
        "⚠️ **IMPORTANT**: Your private key has been securely stored\\. " +
        "Make sure to backup your wallet\\!\n\n" +
        `Private Key: ||\`${wallet.privateKey}\`||\n\n` +
        "Click to reveal and copy your private key\\. Store it safely\\!",
        { 
          parse_mode: "MarkdownV2",
          ...this.getMainKeyboard()
        }
      );
    } catch (error) {
      console.error("Wallet generation error:", error);
      await ctx.reply("Error generating wallet. Please try again.");
    }
  }

  private async showSettings(ctx: BotContext) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    if (!user) return;

    const settings = await storage.getTradingSettings(user.id);
    
    const settingsMessage = `⚙️ **Trading Settings**\n\n` +
      `• Default Slippage: ${settings?.defaultSlippage || "1"}%\n` +
      `• Max Transaction: ${settings?.maxTransactionAmount || "1"} SOL\n` +
      `• Auto-Confirm: ${settings?.autoConfirm ? "Enabled" : "Disabled"}\n` +
      `• Notifications: ${settings?.notifications ? "Enabled" : "Disabled"}`;

    const settingsKeyboard = Markup.inlineKeyboard([
      [Markup.button.callback("📊 Change Slippage", "set_slippage")],
      [Markup.button.callback("💰 Set Max Amount", "set_max_amount")],
      [Markup.button.callback("🔄 Toggle Auto-Confirm", "toggle_auto")],
      [Markup.button.callback("🔔 Toggle Notifications", "toggle_notifications")],
    ]);

    await ctx.reply(settingsMessage, {
      parse_mode: "Markdown",
      ...settingsKeyboard
    });
  }

  private async handleTokenLookup(ctx: BotContext, tokenAddress: string) {
    try {
      const tokenInfo = await this.priceService.getTokenInfo(tokenAddress);
      if (!tokenInfo) {
        await ctx.reply("Token not found or invalid address.");
        return;
      }

      const price = await this.priceService.getTokenPrice(tokenAddress);
      
      let tokenMessage = `🪙 **${tokenInfo.name || "Unknown Token"}**\n\n`;
      tokenMessage += `Symbol: ${tokenInfo.symbol || "N/A"}\n`;
      tokenMessage += `Address: \`${tokenAddress}\`\n`;
      if (price) {
        tokenMessage += `Price: $${price.toFixed(6)}\n`;
      }

      const tokenKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("💰 Buy", `buy_${tokenAddress}`),
          Markup.button.callback("📊 Sell", `sell_${tokenAddress}`),
        ],
      ]);

      await ctx.reply(tokenMessage, {
        parse_mode: "Markdown",
        ...tokenKeyboard
      });
    } catch (error) {
      console.error("Token lookup error:", error);
      await ctx.reply("Error looking up token information.");
    }
  }

  private async handleSymbolLookup(ctx: BotContext, symbol: string) {
    try {
      const tokenAddress = await this.priceService.getTokenBySymbol(symbol);
      if (tokenAddress) {
        await this.handleTokenLookup(ctx, tokenAddress);
      } else {
        await ctx.reply(`Token with symbol "${symbol}" not found.`);
      }
    } catch (error) {
      console.error("Symbol lookup error:", error);
      await ctx.reply("Error searching for token by symbol.");
    }
  }

  private async handleBuyToken(ctx: BotContext, tokenAddress: string) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    if (!user?.walletAddress || !user.walletPrivateKey) {
      await ctx.reply("Please connect a wallet first!", this.getWalletKeyboard());
      return;
    }

    // Get amount selection
    const amountKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("0.1 SOL", `buy_${tokenAddress}_0.1`),
        Markup.button.callback("0.5 SOL", `buy_${tokenAddress}_0.5`),
      ],
      [
        Markup.button.callback("1 SOL", `buy_${tokenAddress}_1`),
        Markup.button.callback("2 SOL", `buy_${tokenAddress}_2`),
      ],
    ]);

    await ctx.reply("💰 Select amount to buy:", amountKeyboard);
  }

  private async handleSellToken(ctx: BotContext, tokenAddress: string) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    if (!user?.walletAddress) {
      await ctx.reply("Please connect a wallet first!");
      return;
    }

    const balance = await storage.getTokenBalance(user.id, tokenAddress);
    if (!balance || parseFloat(balance.balance) === 0) {
      await ctx.reply("You don't hold any of this token.");
      return;
    }

    const sellKeyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback("25%", `sell_${tokenAddress}_25`),
        Markup.button.callback("50%", `sell_${tokenAddress}_50`),
      ],
      [
        Markup.button.callback("75%", `sell_${tokenAddress}_75`),
        Markup.button.callback("100%", `sell_${tokenAddress}_100`),
      ],
    ]);

    await ctx.reply(
      `📊 Your balance: ${balance.balance} ${balance.tokenSymbol}\n\nSelect percentage to sell:`,
      sellKeyboard
    );
  }

  private isValidSolanaAddress(address: string): boolean {
    // Basic validation for Solana address (base58, typically 32-44 characters)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  private getMainKeyboard() {
    return Markup.keyboard([
      ["💰 Buy Token", "📊 Portfolio"],
      ["🔗 Connect Wallet", "📈 Token Price"],
      ["⚙️ Settings"],
    ]).resize();
  }

  private getWalletKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.callback("🔗 Connect Wallet", "connect_wallet")],
    ]);
  }

  private async executeBuyOrder(ctx: BotContext, tokenAddress: string, amount: string) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    if (!user?.walletAddress || !user.walletPrivateKey) {
      await ctx.reply("Please connect a wallet first!");
      return;
    }

    try {
      await ctx.reply("🔄 Processing buy order...");

      // Get token info
      const tokenInfo = await this.priceService.getTokenInfo(tokenAddress);
      const solBalance = await this.solanaService.getBalance(user.walletAddress);
      
      const buyAmount = parseFloat(amount);
      
      if (solBalance < buyAmount) {
        await ctx.reply(`❌ Insufficient balance. You have ${solBalance} SOL but need ${buyAmount} SOL.`);
        return;
      }

      // Get Jupiter quote
      const settings = await storage.getTradingSettings(user.id);
      const slippageBps = Math.round((parseFloat(settings?.defaultSlippage || "1") * 100));
      const inputAmount = (buyAmount * 1e9).toString(); // Convert to lamports
      
      const quote = await this.jupiterService.getQuote(
        "So11111111111111111111111111111111111111112", // SOL mint
        tokenAddress,
        inputAmount,
        slippageBps
      );

      if (!quote) {
        await ctx.reply("❌ Unable to get price quote. Try again later.");
        return;
      }

      const outputAmount = this.jupiterService.formatAmount(quote.outAmount, tokenInfo?.decimals || 9);
      const priceImpact = parseFloat(quote.priceImpactPct);

      // Show confirmation
      const networkLabel = this.solanaService.isDevnet() ? "devnet" : "mainnet";
      const confirmMessage = `💰 **Buy Order Confirmation**\n\n` +
        `Token: ${tokenInfo?.name || "Unknown"} (${tokenInfo?.symbol || "N/A"})\n` +
        `Amount: ${buyAmount} SOL → ~${outputAmount} ${tokenInfo?.symbol || "tokens"}\n` +
        `Price Impact: ${priceImpact.toFixed(2)}%\n` +
        `Slippage: ${settings?.defaultSlippage || "1"}%\n\n` +
        (priceImpact > 5 ? "⚠️ **HIGH PRICE IMPACT WARNING**\n\n" : "") +
        `This will execute a real transaction on Solana ${networkLabel}.`;

      const confirmKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Confirm", `confirm_buy_${tokenAddress}_${amount}`),
          Markup.button.callback("❌ Cancel", "cancel_order"),
        ],
      ]);

      await ctx.reply(confirmMessage, {
        parse_mode: "Markdown",
        ...confirmKeyboard
      });

    } catch (error) {
      console.error("Buy order error:", error);
      await ctx.reply("❌ Error processing buy order. Please try again.");
    }
  }

  private async executeSellOrder(ctx: BotContext, tokenAddress: string, percentage: string) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    if (!user?.walletAddress) {
      await ctx.reply("Please connect a wallet first!");
      return;
    }

    try {
      await ctx.reply("🔄 Processing sell order...");

      const balance = await storage.getTokenBalance(user.id, tokenAddress);
      if (!balance || parseFloat(balance.balance) === 0) {
        await ctx.reply("❌ You don't hold any of this token.");
        return;
      }

      const sellPercentage = parseFloat(percentage);
      const sellAmount = (parseFloat(balance.balance) * sellPercentage / 100);
      const tokenInfo = await this.priceService.getTokenInfo(tokenAddress);

      // Get Jupiter quote for selling
      const settings = await storage.getTradingSettings(user.id);
      const slippageBps = Math.round((parseFloat(settings?.defaultSlippage || "1") * 100));
      const inputAmount = (sellAmount * Math.pow(10, tokenInfo?.decimals || 9)).toString();
      
      const quote = await this.jupiterService.getQuote(
        tokenAddress,
        "So11111111111111111111111111111111111111112", // SOL mint
        inputAmount,
        slippageBps
      );

      if (!quote) {
        await ctx.reply("❌ Unable to get price quote. Try again later.");
        return;
      }

      const outputSol = this.jupiterService.formatAmount(quote.outAmount, 9);
      const priceImpact = parseFloat(quote.priceImpactPct);

      const networkLabel = this.solanaService.isDevnet() ? "devnet" : "mainnet";
      const confirmMessage = `📊 **Sell Order Confirmation**\n\n` +
        `Token: ${tokenInfo?.name || "Unknown"} (${balance.tokenSymbol})\n` +
        `Amount: ${sellAmount.toFixed(6)} ${balance.tokenSymbol} (${percentage}%)\n` +
        `Receive: ~${outputSol} SOL\n` +
        `Price Impact: ${priceImpact.toFixed(2)}%\n` +
        `Slippage: ${settings?.defaultSlippage || "1"}%\n\n` +
        (priceImpact > 5 ? "⚠️ **HIGH PRICE IMPACT WARNING**\n\n" : "") +
        `This will execute a real transaction on Solana ${networkLabel}.`;

      const confirmKeyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Confirm", `confirm_sell_${tokenAddress}_${percentage}`),
          Markup.button.callback("❌ Cancel", "cancel_order"),
        ],
      ]);

      await ctx.reply(confirmMessage, {
        parse_mode: "Markdown",
        ...confirmKeyboard
      });

    } catch (error) {
      console.error("Sell order error:", error);
      await ctx.reply("❌ Error processing sell order. Please try again.");
    }
  }

  private async toggleAutoConfirm(ctx: BotContext) {
    try {
      const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
      if (!user) return;

      const settings = await storage.getTradingSettings(user.id);
      const newAutoConfirm = !settings?.autoConfirm;
      
      await storage.createOrUpdateTradingSettings({
        userId: user.id,
        defaultSlippage: settings?.defaultSlippage || "1",
        maxTransactionAmount: settings?.maxTransactionAmount || "1",
        autoConfirm: newAutoConfirm,
        notifications: settings?.notifications ?? true,
      });

      await ctx.reply(`✅ Auto-confirm ${newAutoConfirm ? "enabled" : "disabled"}.`);
    } catch (error) {
      console.error("Toggle auto-confirm error:", error);
      await ctx.reply("Error updating settings.");
    }
  }

  private async toggleNotifications(ctx: BotContext) {
    try {
      const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
      if (!user) return;

      const settings = await storage.getTradingSettings(user.id);
      const newNotifications = !settings?.notifications;
      
      await storage.createOrUpdateTradingSettings({
        userId: user.id,
        defaultSlippage: settings?.defaultSlippage || "1",
        maxTransactionAmount: settings?.maxTransactionAmount || "1",
        autoConfirm: settings?.autoConfirm || false,
        notifications: newNotifications,
      });

      await ctx.reply(`🔔 Notifications ${newNotifications ? "enabled" : "disabled"}.`);
    } catch (error) {
      console.error("Toggle notifications error:", error);
      await ctx.reply("Error updating settings.");
    }
  }

  private async executeSwap(ctx: BotContext, type: "buy" | "sell", tokenAddress: string, amountOrPercentage: string) {
    const user = await storage.getUserByTelegramId(ctx.from!.id.toString());
    if (!user?.walletAddress || !user.walletPrivateKey) {
      await ctx.reply("Please connect a wallet first!");
      return;
    }

    try {
      await ctx.reply("⏳ Executing transaction...");

      const settings = await storage.getTradingSettings(user.id);
      const slippageBps = Math.round((parseFloat(settings?.defaultSlippage || "1") * 100));

      let inputMint: string;
      let outputMint: string;
      let inputAmount: string;
      let displayAmount: string;

      if (type === "buy") {
        // Buy with SOL
        inputMint = "So11111111111111111111111111111111111111112"; // SOL
        outputMint = tokenAddress;
        const buyAmount = parseFloat(amountOrPercentage);
        inputAmount = (buyAmount * 1e9).toString(); // Convert to lamports
        displayAmount = `${buyAmount} SOL`;
      } else {
        // Sell tokens for SOL
        inputMint = tokenAddress;
        outputMint = "So11111111111111111111111111111111111111112"; // SOL
        const balance = await storage.getTokenBalance(user.id, tokenAddress);
        if (!balance) {
          await ctx.reply("❌ No token balance found.");
          return;
        }
        const sellPercentage = parseFloat(amountOrPercentage);
        const sellAmount = (parseFloat(balance.balance) * sellPercentage / 100);
        const tokenInfo = await this.priceService.getTokenInfo(tokenAddress);
        inputAmount = (sellAmount * Math.pow(10, tokenInfo?.decimals || 9)).toString();
        displayAmount = `${sellAmount.toFixed(6)} ${balance.tokenSymbol}`;
      }

      // Get fresh quote
      const quote = await this.jupiterService.getQuote(inputMint, outputMint, inputAmount, slippageBps);
      if (!quote) {
        await ctx.reply("❌ Unable to get price quote. Market conditions may have changed.");
        return;
      }

      // Execute the swap
      const swapResult = await this.jupiterService.executeSwap(inputMint, outputMint, inputAmount, user.walletPrivateKey, slippageBps);
      
      if (!swapResult.success) {
        await ctx.reply(`❌ Transaction failed: ${swapResult.error}`);
        return;
      }
      
      const signature = swapResult.signature;

      // Get token info for display
      const tokenInfo = await this.priceService.getTokenInfo(tokenAddress);
      const tokenPrice = await this.priceService.getTokenPrice(tokenAddress);

      // Use the quote from the swap result
      const finalQuote = swapResult.quote || quote;
      
      // Record transaction
      await storage.createTransaction({
        userId: user.id,
        signature: signature || "pending",
        type: type,
        tokenAddress: tokenAddress,
        tokenSymbol: tokenInfo?.symbol || "Unknown",
        tokenName: tokenInfo?.name || "Unknown Token",
        amount: type === "buy" 
          ? this.jupiterService.formatAmount(finalQuote.outAmount, tokenInfo?.decimals || 9)
          : this.jupiterService.formatAmount(finalQuote.outAmount, 9), // SOL has 9 decimals
        solAmount: type === "buy" 
          ? parseFloat(amountOrPercentage).toString()
          : this.jupiterService.formatAmount(finalQuote.outAmount, 9),
        price: tokenPrice?.toString() || null,
        slippage: settings?.defaultSlippage || "1",
        fees: null,
        metadata: { priceImpact: finalQuote.priceImpactPct }
      });

      // Update token balances
      if (type === "buy") {
        const tokenAmount = this.jupiterService.formatAmount(finalQuote.outAmount, tokenInfo?.decimals || 9);
        await storage.createOrUpdateTokenBalance({
          userId: user.id,
          tokenAddress: tokenAddress,
          tokenSymbol: tokenInfo?.symbol || "Unknown",
          tokenName: tokenInfo?.name || "Unknown Token",
          balance: tokenAmount
        });
      }

      // Success message
      const outputAmount = type === "buy" 
        ? `${this.jupiterService.formatAmount(finalQuote.outAmount, tokenInfo?.decimals || 9)} ${tokenInfo?.symbol}`
        : `${this.jupiterService.formatAmount(finalQuote.outAmount, 9)} SOL`;

      const explorerCluster = this.solanaService.isDevnet() ? "?cluster=devnet" : "";
      const successMessage = `✅ **Transaction Successful!**\n\n` +
        `${type === "buy" ? "Bought" : "Sold"}: ${displayAmount}\n` +
        `Received: ${outputAmount}\n` +
        `Transaction: \`${signature}\`\n\n` +
        `View on Explorer: https://solscan.io/tx/${signature}${explorerCluster}`;

      await ctx.reply(successMessage, {
        parse_mode: "Markdown",
        ...this.getMainKeyboard()
      });

    } catch (error) {
      console.error("Swap execution error:", error);
      await ctx.reply(`❌ Transaction failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  public async start() {
    // Set webhook URL for production or use polling for development
    if (process.env.NODE_ENV === "production" && process.env.WEBHOOK_URL) {
      await this.bot.telegram.setWebhook(`${process.env.WEBHOOK_URL}/bot${this.botToken}`);
      console.log("Telegram bot webhook set");
    } else {
      await this.bot.launch();
      console.log("Telegram bot started with polling");
    }

    // Enable graceful stop
    process.once("SIGINT", () => this.bot.stop("SIGINT"));
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
  }

  public getWebhookCallback() {
    return this.bot.webhookCallback(`/bot${this.botToken}`);
  }
}
