# 🚀 FREE Solana Memecoin Trading Bot

A **completely free** Telegram bot for real Solana memecoin trading with web dashboard. Trade memecoins directly through Telegram with real blockchain transactions.

## ✨ Features

- 🤖 **Telegram Bot Interface** - Easy trading through Telegram commands
- 💰 **Real Trading** - Execute actual trades on Solana blockchain 
- 🔗 **Wallet Integration** - Generate or import Solana wallets
- 📊 **Portfolio Tracking** - Monitor your token holdings and balances
- 💱 **Jupiter DEX Integration** - Best prices through Jupiter aggregator
- 📈 **Real-time Prices** - Live token prices from multiple sources
- 🎯 **Risk Management** - Configurable slippage and transaction limits
- 📱 **Web Dashboard** - Monitor bot activity and statistics

## 💸 COMPLETELY FREE!

This bot uses only **FREE services**:
- ✅ Solana Devnet (free testing network)
- ✅ Jupiter DEX API (free)  
- ✅ CoinGecko API (free tier)
- ✅ Telegram Bot API (free)
- ✅ In-memory storage (no database costs)
- ✅ Replit hosting (free tier)

**Total Cost: $0.00** 🎉

## 🛠️ Setup Instructions

### 1. Create a Telegram Bot (FREE)

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Choose a name and username for your bot
4. Copy the bot token you receive

### 2. Configure Environment

The bot only needs your Telegram bot token to work:

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
```

### 3. Start the Application

Click the "Run" button in Replit or use:

```bash
npm run dev
```

### 4. Test Your Bot

1. Open your Telegram bot
2. Send `/start` to begin
3. Follow the bot's instructions to:
   - Generate a free wallet
   - Get free devnet SOL for testing
   - Start trading tokens

## 📱 Bot Commands

- `/start` - Initialize the bot and create account
- `💰 Buy Token` - Purchase tokens by address or symbol
- `📊 Portfolio` - View your token holdings
- `🔗 Connect Wallet` - Generate or import wallet
- `⚙️ Settings` - Configure trading preferences
- `📈 Token Price` - Get real-time token prices

## 🔧 Trading Process

1. **Connect Wallet**: Generate a new wallet or import existing one
2. **Get Test SOL**: Request free devnet SOL for trading
3. **Find Tokens**: Enter token address or search by symbol
4. **Execute Trade**: Choose amount and confirm transaction
5. **Track Portfolio**: Monitor your holdings and performance

## 🌐 Web Dashboard

Access the web dashboard at `http://localhost:5000` to view:
- Total users and active traders
- Transaction volume and history
- Bot status and performance metrics
- Recent trading activity

## ⚠️ Important Notes

### Testing Environment
- Uses **Solana Devnet** for safe testing
- Devnet tokens have no real value
- Perfect for learning and testing strategies

### Security Features
- Private keys stored securely (encrypted in production)
- Transaction confirmation required
- Slippage protection built-in
- Maximum transaction limits

### Production Deployment
To use on mainnet:
1. Change `SOLANA_RPC_URL` to mainnet endpoint
2. Add proper private key encryption
3. Use real SOL for transactions
4. Set up production monitoring

## 🔗 Architecture

- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript  
- **Blockchain**: Solana + Jupiter DEX
- **Bot**: Telegraf framework
- **Storage**: In-memory (no database needed)
- **APIs**: All free APIs with fallbacks

## 🤝 Support

- Create issues for bugs or feature requests
- Join our Telegram community for help
- Check the web dashboard for bot status
- All services are free - no hidden costs!

## 🎯 Next Steps

1. Set up your Telegram bot token
2. Run the application
3. Start trading on devnet
4. Explore the web dashboard
5. Customize settings and limits
6. Deploy to production when ready

Happy trading! 🎉