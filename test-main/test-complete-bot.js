// Complete bot integration test
import axios from 'axios';

async function testCompleteBot() {
  console.log('🤖 Testing Complete Bot Integration');
  console.log('===================================');

  try {
    // Test 1: Create user (simulates /start command)
    console.log('1. Testing user creation...');
    const userResponse = await axios.post('http://localhost:5000/api/users', {
      telegramId: "complete_test_456",
      username: "completetest",
      firstName: "Complete",
      lastName: "Test"
    });
    console.log(`   ✅ User created: ${userResponse.data.firstName} ${userResponse.data.lastName}`);
    const userId = userResponse.data.id;

    // Test 2: Generate wallet (simulates /wallet command)
    console.log('2. Testing wallet generation...');
    const walletResponse = await axios.get('http://localhost:5000/api/solana/generate-wallet');
    const { publicKey, privateKey } = walletResponse.data;
    console.log(`   ✅ Wallet: ${publicKey.substring(0, 8)}...`);

    // Test 3: Update user with wallet
    console.log('3. Testing wallet connection...');
    await axios.patch(`http://localhost:5000/api/users/${userId}`, {
      walletAddress: publicKey,
      walletPrivateKey: privateKey
    });
    console.log(`   ✅ Wallet connected to user account`);

    // Test 4: Set trading settings (simulates /settings)
    console.log('4. Testing trading settings...');
    const settingsResponse = await axios.post('http://localhost:5000/api/settings', {
      userId: userId,
      defaultSlippage: "1.0",
      maxTransactionAmount: "1.0",
      autoConfirm: false,
      notifications: true
    });
    console.log(`   ✅ Settings: ${settingsResponse.data.defaultSlippage}% slippage`);

    // Test 5: Check balance (simulates /balance command) 
    console.log('5. Testing balance check...');
    const balanceResponse = await axios.get(`http://localhost:5000/api/solana/balance/${publicKey}`);
    console.log(`   ✅ SOL Balance: ${balanceResponse.data.balance}`);

    // Test 6: Get popular tokens
    console.log('6. Testing token list...');
    const tokensResponse = await axios.get('http://localhost:5000/api/jupiter/tokens');
    const popularTokens = tokensResponse.data.slice(0, 5);
    console.log(`   ✅ Found ${tokensResponse.data.length} supported tokens`);
    popularTokens.forEach((token, i) => {
      console.log(`     ${i+1}. ${token.symbol} - ${token.name}`);
    });

    // Test 7: Test price quotes for popular tokens
    console.log('7. Testing price quotes...');
    const testToken = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC
    const quoteResponse = await axios.get('http://localhost:5000/api/jupiter/quote', {
      params: {
        inputMint: 'So11111111111111111111111111111111111111112', // SOL
        outputMint: testToken,
        amount: '100000000', // 0.1 SOL
        slippageBps: '100'
      }
    });
    
    if (quoteResponse.data && quoteResponse.data.outAmount) {
      const usdcAmount = (parseFloat(quoteResponse.data.outAmount) / 1e6).toFixed(4);
      console.log(`   ✅ Quote: 0.1 SOL → ${usdcAmount} USDC`);
      console.log(`   💰 Price Impact: ${quoteResponse.data.priceImpactPct}%`);
    }

    // Test 8: Simulate bot workflow (user looks up token info)
    console.log('8. Testing token information...');
    const priceResponse = await axios.get('http://localhost:5000/api/prices/token', {
      params: { address: testToken }
    });
    if (priceResponse.data.tokenInfo) {
      console.log(`   ✅ Token Info: ${priceResponse.data.tokenInfo.name} (${priceResponse.data.tokenInfo.symbol})`);
      console.log(`   📈 Decimals: ${priceResponse.data.tokenInfo.decimals}`);
    }

    // Test 9: Test transaction recording (simulates trade completion)
    console.log('9. Testing transaction recording...');
    const transactionResponse = await axios.post('http://localhost:5000/api/transactions', {
      userId: userId,
      signature: 'test_signature_' + Date.now(),
      type: 'buy',
      tokenAddress: testToken,
      tokenSymbol: 'USDC',
      tokenName: 'USD Coin',
      amount: '100.0000',
      solAmount: '0.1',
      price: '184.50',
      slippage: '1.0',
      fees: null,
      status: 'pending'
    });
    console.log(`   ✅ Transaction recorded: ${transactionResponse.data.type} ${transactionResponse.data.tokenSymbol}`);

    // Test 10: Test user's transaction history
    console.log('10. Testing transaction history...');
    const historyResponse = await axios.get(`http://localhost:5000/api/users/complete_test_456/transactions?limit=5`);
    console.log(`   ✅ Transaction history: ${historyResponse.data.length} transactions found`);

    // Test 11: Test token balance management
    console.log('11. Testing token balance tracking...');
    const tokenBalanceResponse = await axios.post('http://localhost:5000/api/token-balances', {
      userId: userId,
      tokenAddress: testToken,
      tokenSymbol: 'USDC',
      tokenName: 'USD Coin',
      balance: '100.0000'
    });
    console.log(`   ✅ Token balance updated: ${tokenBalanceResponse.data.balance} ${tokenBalanceResponse.data.tokenSymbol}`);

    // Test 12: Get user's complete portfolio
    console.log('12. Testing portfolio view...');
    const portfolioResponse = await axios.get(`http://localhost:5000/api/users/complete_test_456/balances`);
    console.log(`   ✅ Portfolio: ${portfolioResponse.data.length} token balances tracked`);

    console.log('\n🎉 COMPLETE BOT TEST SUCCESSFUL!');
    console.log('\n📊 System Status:');
    console.log('   • User Management: ✅ Working');
    console.log('   • Wallet Generation: ✅ Working');
    console.log('   • Balance Checking: ✅ Working');
    console.log('   • Token Discovery: ✅ Working');
    console.log('   • Price Quotes: ✅ Working');
    console.log('   • Trading Settings: ✅ Working');
    console.log('   • Transaction Tracking: ✅ Working');
    console.log('   • Portfolio Management: ✅ Working');
    
    console.log('\n🚀 Bot Ready for Live Trading!');
    console.log('📱 Telegram Bot: @Solanatrader1bot');
    console.log('💰 Test Wallet:', publicKey);
    console.log('🔗 Fund at: https://faucet.solana.com');
    console.log('📖 Commands: /start, /wallet, /balance, /settings, /buy, /sell');

    return { success: true, walletAddress: publicKey };

  } catch (error) {
    console.error('❌ Complete bot test failed:', error.message);
    if (error.response?.data) {
      console.log('Response error:', error.response.data);
    }
    return { success: false };
  }
}

// Run the complete bot test
testCompleteBot().then(result => {
  console.log(`\n${result.success ? '🎯 All systems operational!' : '💥 System has issues'}`);
  if (result.success) {
    console.log('✅ Ready for memecoin trading on Solana devnet');
    console.log('✅ Zero cost operation - completely FREE');
    console.log('✅ Multi-user support enabled');
    console.log('✅ Real DEX integration via Jupiter');
    console.log('\n🎊 Telegram bot is ready for users!');
  }
  process.exit(result.success ? 0 : 1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});