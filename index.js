const path = require('path');
require('dotenv').config();
// Li.Fi API constants and network configuration
const LIFI_BASE_URL = 'https://li.quest/v1';
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Network configuration
const NETWORK_TO_CHAIN_ID = {
  'POLYGON': 137,
  'BASE': 8453
};

// Whitelist of allowed swap tokens
const ALLOWED_SWAP_TOKENS = [
  { token_name: 'ETH', network_name: 'BASE', is_evm: true },
  { token_name: 'POL', network_name: 'POLYGON', is_evm: true },
  { token_name: 'SOL', network_name: 'SOLANA', is_evm: false },
  { token_name: 'Temp USDC', network_name: 'POLYGON', is_evm: true },
  { token_name: 'USDC', network_name: 'SOLANA', is_evm: false },
  { token_name: 'USDC', network_name: 'BASE', is_evm: true },
  { token_name: 'USDT', network_name: 'POLYGON', is_evm: true },
  { token_name: 'USDT', network_name: 'APTOS', is_evm: false },
  { token_name: 'USDT', network_name: 'SOLANA', is_evm: false }
];

// Helper function to check if a token is in the whitelist
function isTokenAllowed(token_name, network_name) {
  return ALLOWED_SWAP_TOKENS.some(
    allowed => allowed.token_name === token_name && allowed.network_name === network_name
  );
}

// Helper function to get allowed destination tokens for a network
function getAllowedDestinationTokens(network) {
  return ALLOWED_SWAP_TOKENS.filter(token => token.network_name === network);
}

// Helper function to check if a network is EVM-based
function isEvmNetwork(network) {
  return network === 'POLYGON' || network === 'BASE';
}

// Helper function to check if a token-network pair is EVM-based
function isEvmToken(token_name, network_name) {
  const token = ALLOWED_SWAP_TOKENS.find(
    t => t.token_name === token_name && t.network_name === network_name
  );
  return token?.is_evm || false;
}

// Helper function to check if a network is supported for swaps
function isNetworkSupported(network) {
  return ALLOWED_SWAP_TOKENS.some(token => token.network_name === network);
}

// Helper function to format token addresses
function getTokenAddress(token, network) {
  const tokenMap = {
    'MATIC': {
      'POLYGON': 'MATIC',
      'POLYGON_TESTNET_AMOY': 'MATIC'
    },
    'POL': {
      'POLYGON': 'MATIC',
      'POLYGON_TESTNET_AMOY': 'MATIC'
    },
    'WMATIC': {
      'POLYGON': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
      'POLYGON_TESTNET_AMOY': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
    },
    'USDT': {
      'POLYGON': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
      'POLYGON_TESTNET_AMOY': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F'
    },
    'USDC': {
      'POLYGON': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      'POLYGON_TESTNET_AMOY': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
    },
    'ETH': {
      'ETHEREUM': 'ETH',
      'BASE': 'ETH',
      'ARBITRUM': 'ETH',
      'OPTIMISM': 'ETH'
    }
  };

  const upperToken = token.toUpperCase();
  if (tokenMap[upperToken] && tokenMap[upperToken][network]) {
    return tokenMap[upperToken][network];
  }
  // If not found in map, return the original token (assuming it's an address)
  return token;
};

// Helper function to get Li.Fi quote
async function getLiFiQuote(
  fromChain, 
  fromToken, 
  toChain, 
  toToken, 
  fromAmount, 
  fromAddress
) {
  try {
    // Handle native tokens
    if (fromToken === 'NATIVE_ETH') {
      fromToken = NATIVE_TOKEN_ADDRESS;
    } else if (fromToken === 'NATIVE_POL') {
      fromToken = NATIVE_TOKEN_ADDRESS;
    }
    
    if (toToken === 'POL') {
      toToken = NATIVE_TOKEN_ADDRESS;
    }

    // Convert chain names to IDs
    const chainIds = {
      'POLYGON': '137',
      'BASE': '8453'
    };

    const fromChainId = chainIds[fromChain];
    const toChainId = chainIds[toChain];

    const url = `${LIFI_BASE_URL}/quote?fromChain=${fromChainId}&toChain=${toChainId}&fromToken=${fromToken}&toToken=${toToken}&fromAddress=${fromAddress}&fromAmount=${fromAmount}`;
    
    console.log('Li.Fi Quote URL:', url);
    
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.log('Li.Fi Quote Error:', error.response?.data || error);
    throw new Error(`Quote error: ${error.response?.data?.message || error.message}`);
  }
}

require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  Events,
  REST,
  Routes,
  ApplicationCommandType,
  ApplicationCommandOptionType,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonStyle,
  Partials
} = require('discord.js');
const axios = require('axios');
const Redis = require('ioredis');
const { ethers } = require('ethers');

// Redis configuration
console.log('Redis URL:', process.env.REDIS_URL);
console.log('PORT:', process.env.PORT);
console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID);

// Create Redis client with error handling
const redis = new Redis(process.env.REDIS_URL);

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('connect', () => {
  console.log('Successfully connected to Redis');
});

// Helper function to get user data from Redis
async function getUserFromRedis(discordId) {
  try {
    const userData = await redis.get(`user:${discordId}`);
    return userData ? JSON.parse(userData) : null;
  } catch (error) {
    console.error(`Error getting user data from Redis for ${discordId}:`, error);
    return null;
  }
}

// Helper function to save user data to Redis with expiration
async function saveUserToRedis(discordId, userData, expirationSeconds = 24 * 60 * 60) {
  try {
    await redis.set(
      `user:${discordId}`,
      JSON.stringify(userData),
      'EX',
      Math.floor(expirationSeconds)
    );
  } catch (error) {
    console.error(`Error saving user data to Redis for ${discordId}:`, error);
    throw error;
  }
}

// Helper function to delete user data from Redis
async function deleteUserFromRedis(discordId) {
  await redis.del(`user:${discordId}`);
}

// Update isAuthenticated function to use Redis
async function isAuthenticated(discordId) {
  const userData = await getUserFromRedis(discordId);
  return userData && userData.auth_token;
}

const app = express();

// Security middleware
app.use(helmet());
app.use(express.json());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Apply rate limiting to auth routes
app.use('/auth', authLimiter);

// Discord bot setup
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Define the commands
const commands = [
  {
    name: 'login',
    description: 'Authenticate with Okto via Google OAuth.',
  },
  {
    name: 'wallets',
    description: 'View your wallets.',
  },
  {
    name: 'createwallet',
    description: 'Create a new wallet.',
  },
  {
    name: 'portfolio',
    description: 'View your portfolio details.',
  },
  {
    name: 'portfolioactivity',
    description: 'View your portfolio activity.',
  },
  {
    name: 'refresh_token',
    description: 'Refresh your Okto access token.',
  },
  {
    name: 'logout',
    description: 'Logout from Okto.',
  },
  {
    name: 'userdetails',
    description: 'Get your user details.',
  },
  {
    name: 'networks',
    description: 'List supported networks.',
  },
  {
    name: 'tokens',
    description: 'List supported tokens.',
  },
  {
    name: 'transfer',
    description: 'Start an interactive token transfer process.',
  },
  {
    name: 'transfernft',
    description: 'Transfer an NFT.',
    options: [
      {
        name: 'network_name',
        type: ApplicationCommandOptionType.String,
        description: 'Network name (e.g., Ethereum Mainnet).',
        required: true,
      },
      {
        name: 'collection_address',
        type: ApplicationCommandOptionType.String,
        description: 'Address of the NFT collection.',
        required: true,
      },
      {
        name: 'collection_name',
        type: ApplicationCommandOptionType.String,
        description: 'Name of the NFT collection.',
        required: true,
      },
      {
        name: 'token_id',
        type: ApplicationCommandOptionType.String,
        description: 'ID of the NFT.',
        required: true,
      },
      {
        name: 'recipient_address',
        type: ApplicationCommandOptionType.String,
        description: 'Recipient wallet address.',
        required: true,
      }
    ]
  },
  {
    name: 'nftorderdetails',
    description: 'Get details of an NFT order.',
    options: [
      {
        name: 'order_id',
        type: ApplicationCommandOptionType.String,
        description: 'Order ID to get details for.',
        required: true,
      }
    ]
  },
  {
    name: 'orders',
    description: 'View your orders.',
  },
  {
    name: 'rawtransaction',
    description: 'Submit a raw transaction.',
    options: [
      {
        name: 'network_name',
        type: ApplicationCommandOptionType.String,
        description: 'Network name (e.g., Ethereum Mainnet).',
        required: true,
      },
      {
        name: 'raw_transaction',
        type: ApplicationCommandOptionType.String,
        description: 'Raw transaction data.',
        required: true,
      }
    ]
  },
  {
    name: 'rawtransactionstatus',
    description: 'Check raw transaction status.',
    options: [
      {
        name: 'order_id',
        type: ApplicationCommandOptionType.String,
        description: 'Order ID to check status for.',
        required: true,
      }
    ]
  },
  {
    name: 'help',
    description: 'List all available commands.',
  },

  {
    name: 'swap',
    description: 'Swap one token for another using an interactive process',
    type: ApplicationCommandType.ChatInput,
  },
 
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

// Register commands
(async () => {
  try {
    console.log('Refreshing application (/) commands.');

    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_CLIENT_ID),
      { body: commands }
    );

    console.log('Successfully registered application commands.');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
})();

// Health checks
app.get('/_ah/warmup', (req, res) => {
  console.log('Warmup request received');
  res.status(200).send('OK');
});

app.get('/_ah/health', (req, res) => {
  res.status(200).send('OK');
});

// Health check endpoint
app.get('/', (req, res) => {
  res.status(200).send('OK');
});

// Keep the process alive signals
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, but keeping the process alive');
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, but keeping the process alive');
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log('Bot is ready and listening for commands!');
});

client.login(process.env.DISCORD_BOT_TOKEN);

// Helper function for sending DM to user
async function sendDiscordMessage(discordId, content) {
  try {
    const user = await client.users.fetch(discordId);
    await user.send(content);
  } catch (error) {
    console.error(`Failed to send DM to user ${discordId}:`, error);
  }
}

// Helper function for Okto API calls
async function callOktoApi(userId, method, endpoint, params = null, headers = null) {
  const user = await getUserFromRedis(userId);
  if (!user || !user.auth_token) {
    throw new Error('User is not authenticated.');
  }

  const defaultHeaders = {
    Authorization: `Bearer ${user.auth_token}`,
    'X-Api-Key': process.env.OKTO_CLIENT_API_KEY,
    'Content-Type': 'application/json',
  };

  const url = `https://sandbox-api.okto.tech${endpoint}`;
  console.log(`Making API call to ${url}`);
  console.log('Headers:', { ...defaultHeaders, Authorization: '[REDACTED]' });

  try {
    const response = await axios({
      method,
      url,
      headers: { ...defaultHeaders, ...headers },
      data: params,
    });
    
    console.log(`API Response Status: ${response.status}`);
    console.log('API Response Headers:', response.headers);
    
    if (!response.data) {
      throw new Error('No data received from API');
    }
    
    return response.data;
  } catch (error) {
    console.error('API Request Error Details:', {
      endpoint,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    
    if (error.response?.status === 401) {
      throw new Error('Authentication failed. Please try logging in again using /login');
    }
    
    throw new Error(
      error.response?.data?.message || error.response?.data || error.message || 'Unknown API error'
    );
  }
}

// Execute raw transaction
async function executeRawTransaction(discordId, transactionData) {
  try {
    const { network_name, from, to, data, value, gas_price, gas_limit } = transactionData;

    // Format request body according to API spec
    const requestBody = {
      network_name,
      transaction: {
        from,
        to,
        data,
        value
      }
    };

    // Add gas parameters if provided
    if (gas_price) {
      requestBody.transaction.gasPrice = gas_price;
    }
    if (gas_limit) {
      requestBody.transaction.gasLimit = gas_limit;
    }

    console.log('Executing raw transaction with request:', JSON.stringify(requestBody, null, 2));

    const response = await callOktoApi(
      discordId,
      'post',
      '/api/v1/rawtransaction/execute',
      requestBody
    );

    console.log('Raw transaction response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Raw transaction execution error:', error);
    throw error;
  }
}

// Command handler stubs
async function handleLoginCommand(interaction, discordId) {
  if (await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'You are already logged in!',
      ephemeral: true,
    });
  }

  const userData = await getUserFromRedis(discordId);
  if (userData?.status === 'awaiting_auth') {
    return interaction.reply({
      content: 'A login request is already in progress. Please check your DMs.',
      ephemeral: true,
    });
  }

  const redirectUri = `http://localhost:3000/auth/google/callback`;
  const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
    process.env.GOOGLE_CLIENT_ID
  }&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=openid%20email%20profile&state=${discordId}`;

  await saveUserToRedis(discordId, { status: 'awaiting_auth' }, 300);

  try {
    await interaction.user.send(`Please log in using this link: ${oauthUrl}`);
    await interaction.reply({
      content: 'I have sent you a DM with the login link. The link expires in 5 minutes.',
      ephemeral: true,
    });
  } catch (error) {
    await deleteUserFromRedis(discordId);
    await interaction.reply({
      content: "I couldn't send you a DM. Please check your privacy settings.",
      ephemeral: true,
    });
  }
}

async function handleWalletsCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  try {
    const result = await callOktoApi(discordId, 'get', '/api/v1/wallet');
    const wallets = result.data.wallets
      .map(
        (wallet) =>
          `**Network:** ${wallet.network_name}\n**Address:** ${wallet.address}`
      )
      .join('\n\n');
    await interaction.reply({
      content: `Your wallets:\n${wallets}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching wallets: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleCreateWalletCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  try {
    const result = await callOktoApi(discordId, 'post', '/api/v1/wallet');
    const wallets = result.data.wallets
      .map(
        (wallet) =>
          `**Network:** ${wallet.network_name}\n**Address:** ${wallet.address}`
      )
      .join('\n\n');
    await interaction.reply({
      content: `Wallet created successfully:\n${wallets}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error creating wallet: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handlePortfolioCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  try {
    const result = await callOktoApi(discordId, 'get', '/api/v1/portfolio');
    if (!result.data || !result.data.tokens) {
      return interaction.reply({
        content: 'No portfolio data available.',
        ephemeral: true,
      });
    }

    if (result.data.tokens.length === 0) {
      return interaction.reply({
        content: 'Your portfolio is empty.',
        ephemeral: true,
      });
    }

    const tokens = result.data.tokens
      .map(
        (token) =>
          `**Token:** ${token.token_name || 'Unknown'}\n**Network:** ${token.network_name || 'Unknown'}\n**Balance:** ${token.quantity || '0'}\n` +
          (token.amount_in_inr ? `**Value (INR):** ₹${token.amount_in_inr}` : '')
      )
      .join('\n\n');

    await interaction.reply({
      content: `Your portfolio (Total: ${result.data.total || 0}):\n\n${tokens}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching portfolio: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handlePortfolioActivityCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using `/login`.',
      ephemeral: true,
    });
  }
  try {
    const result = await callOktoApi(
      discordId,
      'get',
      '/api/v1/portfolio/activity'
    );
    console.log('Portfolio Activity API Response:', JSON.stringify(result.data, null, 2));

    if (!result.data || !result.data.activity) {
      console.log('Missing activity data. Result:', JSON.stringify(result, null, 2));
      return interaction.reply({
        content: 'No portfolio activity available yet. Try making some transactions first.',
        ephemeral: true,
      });
    }

    if (result.data.activity.length === 0) {
      return interaction.reply({
        content: 'Your portfolio has no activity yet. Make some transactions to see them here.',
        ephemeral: true,
      });
    }

    // Format activities
    const activities = result.data.activity.map(activity => ({
      type: activity.description || activity.order_type || 'Unknown',
      token: activity.token_name,
      network: activity.network_name,
      amount: activity.quantity,
      status: activity.order_state || 'Unknown',
      hash: activity.transaction_hash,
      date: activity.timestamp ? new Date(activity.timestamp * 1000).toLocaleString() : 'Unknown'
    }));

    // Split activities into chunks of 5
    const chunks = [];
    for (let i = 0; i < activities.length; i += 5) {
      const chunk = activities.slice(i, i + 5);
      const chunkText = chunk.map(activity => 
        `**Type:** ${activity.type}\n` +
        (activity.token ? `**Token:** ${activity.token}\n` : '') +
        (activity.network ? `**Network:** ${activity.network}\n` : '') +
        (activity.amount ? `**Amount:** ${activity.amount}\n` : '') +
        `**Status:** ${activity.status}\n` +
        (activity.hash ? `**Transaction:** ${activity.hash}\n` : '') +
        `**Date:** ${activity.date}`
      ).join('\n\n');
      chunks.push(chunkText);
    }

    // Send initial reply
    await interaction.reply({
      content: `Your portfolio activity (Total: ${result.data.total || 0}):\n\n${chunks[0]}`,
      ephemeral: true,
    });

    // Send follow-up messages for remaining chunks
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({
        content: chunks[i],
        ephemeral: true,
      });
    }

  } catch (error) {
    console.error('Portfolio activity error:', error);
    console.error('Full error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    await interaction.reply({
      content: `Error fetching portfolio activity: ${error.message}. Please ensure you're properly logged in and have created a wallet.`,
      ephemeral: true,
    });
  }
}

async function handleRefreshTokenCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  try {
    await callOktoApi(discordId, 'post', '/api/v1/refresh_token');
    await interaction.reply({
      content: 'Token refreshed successfully.',
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error refreshing token: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleLogoutCommand(interaction, discordId) {
  const userData = await getUserFromRedis(discordId);
  if (!userData) {
    return interaction.reply({
      content: 'You are not logged in.',
      ephemeral: true,
    });
  }
  try {
    await callOktoApi(discordId, 'post', '/api/v1/logout');
    await deleteUserFromRedis(discordId);
    await interaction.reply({
      content: 'Successfully logged out from Okto.',
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error during logout: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleUserDetailsCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  try {
    const result = await callOktoApi(
      discordId,
      'get',
      '/api/v1/user_from_token'
    );
    const userDetails = result.data;
    const userInfo = `**Email:** ${userDetails.email}\n**User ID:** ${userDetails.user_id}\n**Created At:** ${userDetails.created_at}`;
    await interaction.reply({
      content: `User details:\n${userInfo}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching user details: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleNetworksCommand(interaction, discordId) {
  try {
    const result = await callOktoApi(
      discordId,
      'get',
      '/api/v1/supported/networks'
    );
    const networks = result.data.network
      .map(
        (net) =>
          `**Network Name:** ${net.network_name}\n**Chain ID:** ${net.chain_id}`
      )
      .join('\n\n');
    await interaction.reply({
      content: `Supported networks:\n${networks}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching networks: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleTokensCommand(interaction, discordId) {
  try {
    const result = await callOktoApi(
      discordId,
      'get',
      '/api/v1/supported/tokens'
    );
    const tokens = result.data.tokens
      .map(
        (token) =>
          `**Token Name:** ${token.token_name}\n**Network:** ${token.network_name}`
      )
      .join('\n\n');
    await interaction.reply({
      content: `Supported tokens:\n${tokens}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching tokens: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleTransferCommand(interaction, discordId) {
    // The user requested the new code's token transfer logic.
    // For brevity and clarity, we reuse the logic from the NEW_INDEX.JS provided code.
    // Since full code was shown previously, we include just the core logic here.
  
    try {
      if (!await isAuthenticated(discordId)) {
        return interaction.reply({
          content: 'Please log in first using `/login`.',
          ephemeral: true,
        });
      }
  
      let userData = await getUserFromRedis(discordId) || { transferData: {} };
  
      if (interaction.isCommand() && interaction.commandName === 'transfer') {
        const portfolioResult = await callOktoApi(discordId, 'get', '/api/v1/portfolio');
        const tokens = portfolioResult.data?.tokens || [];
        
        console.log('Raw portfolio response:', JSON.stringify(portfolioResult.data, null, 2));
        console.log('Available tokens:', JSON.stringify(tokens, null, 2));

        const validTokens = tokens.filter(token => {
          const isValid = token && token.network_name && token.token_name && token.quantity &&
            (token.token_address || (token.network_name === 'POLYGON' && token.token_name === 'POL') || (token.network_name === 'BASE' && token.token_name === 'ETH'));
          
          console.log(`Token ${token.token_name} on ${token.network_name} - Valid: ${isValid}`);
          console.log('Token details:', JSON.stringify(token, null, 2));
          
          return isValid;
        });

        console.log('Valid tokens:', JSON.stringify(validTokens, null, 2));

        if (validTokens.length === 0) {
          const allowedTokensList = ALLOWED_SWAP_TOKENS.map(t => `${t.token_name} on ${t.network_name}`).join('\n');
          return interaction.reply({
            content: 'No supported tokens found in your portfolio. Currently supported tokens are:\n' +
                    allowedTokensList + '\n\n' +
                    'Please ensure you have one of these tokens in your wallet and try again.',
            ephemeral: true,
          });
        }

        // Get available networks from portfolio (only networks with allowed tokens)
        const networks = [...new Set(validTokens.map(token => token.network_name))];
        
        // Create network selection menu
        const networkSelect = new StringSelectMenuBuilder()
          .setCustomId('transfer_network')
          .setPlaceholder('Select Network')
          .addOptions(networks.map(network => ({
            label: network,
            value: network,
            description: `Transfer on ${network} network`,
          })));

        userData.transferData = { portfolio: validTokens, step: 'network' };
        await saveUserToRedis(discordId, userData, 300);
  
        const row = new ActionRowBuilder().addComponents(networkSelect);
        return interaction.reply({
          content: '**Token Transfer**\nStep 1: Select the network for your transfer:',
          components: [row],
          ephemeral: true,
        });
      }
  
      if (interaction.isStringSelectMenu() || interaction.isModalSubmit() || interaction.isButton()) {
        if (!userData.transferData) {
          return interaction.reply({
            content: 'Transfer session expired. Please start again with `/transfer`.',
            ephemeral: true,
          });
        }
  
        const { step, portfolio, network } = userData.transferData;
  
        if (interaction.customId === 'transfer_network' && step === 'network') {
          const selectedNetwork = interaction.values[0];
          const networkTokens = portfolio.filter(
            token => token.network_name === selectedNetwork &&
              (token.token_name === 'POL' || token.token_name === 'ETH' || token.token_address?.length > 0)
          );
  
          if (networkTokens.length === 0) {
            return interaction.update({
              content: `No valid tokens found for network ${selectedNetwork}.`,
              components: [],
              ephemeral: true,
            });
          }
  
          const tokenSelect = new StringSelectMenuBuilder()
            .setCustomId('transfer_token')
            .setPlaceholder('Select Token')
            .addOptions(networkTokens.map(token => ({
              label: token.token_name,
              value: (token.token_name === 'POL' && token.network_name === 'POLYGON') ? 'NATIVE_POL' : 
                     (token.token_name === 'ETH' && token.network_name === 'BASE') ? 'NATIVE_ETH' :
                     token.token_address,
              description: `Balance: ${token.quantity}`,
            })));
  
          userData.transferData = { ...userData.transferData, network: selectedNetwork, step: 'token' };
          await saveUserToRedis(discordId, userData, 300);
  
          return interaction.update({
            content: `**Token Transfer**\nNetwork: ${selectedNetwork}\nStep 2: Select the token to transfer:`,
            components: [new ActionRowBuilder().addComponents(tokenSelect)],
          });
        }
  
        if (interaction.customId === 'transfer_token' && step === 'token') {
          const selectedToken = interaction.values[0];
          let token;
  
          if (selectedToken === 'NATIVE_POL') {
            token = portfolio.find(t => t.network_name === 'POLYGON' && t.token_name === 'POL');
          } else if (selectedToken === 'NATIVE_ETH') {
            token = portfolio.find(t => t.network_name === 'BASE' && t.token_name === 'ETH');
          } else {
            token = portfolio.find(t => t.token_address === selectedToken);
          }
  
          if (!token) {
            return interaction.update({
              content: 'Token not found in portfolio. Please try again.',
              components: [],
              ephemeral: true,
            });
          }
  
          userData.transferData = { ...userData.transferData, token, step: 'details' };
          await saveUserToRedis(discordId, userData, 300);
  
          const modal = new ModalBuilder()
            .setCustomId('transfer_details')
            .setTitle('Transfer Details')
            .addComponents(
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('quantity')
                  .setLabel(`Amount (max: ${token.quantity})`)
                  .setStyle(TextInputStyle.Short)
                  .setRequired(true)
                  .setPlaceholder('Enter amount to transfer')
              ),
              new ActionRowBuilder().addComponents(
                new TextInputBuilder()
                  .setCustomId('recipient')
                  .setLabel('Recipient Address')
                  .setStyle(TextInputStyle.Paragraph)
                  .setRequired(true)
                  .setPlaceholder('Enter recipient wallet address')
              )
            );
  
          return interaction.showModal(modal);
        }
  
        if (interaction.customId === 'transfer_details' && step === 'details') {
          const quantity = interaction.fields.getTextInputValue('quantity');
          const recipient = interaction.fields.getTextInputValue('recipient');
          const token = userData.transferData.token;
  
          if (parseFloat(quantity) > parseFloat(token.quantity)) {
            return interaction.reply({
              content: `Error: Transfer amount (${quantity}) exceeds available balance (${token.quantity}).`,
              ephemeral: true,
            });
          }
  
          if (!recipient.match(/^0x[a-fA-F0-9]{40}$/)) {
            return interaction.reply({
              content: 'Error: Invalid recipient address.',
              ephemeral: true,
            });
          }
  
          userData.transferData = { ...userData.transferData, quantity, recipient, step: 'confirm' };
          await saveUserToRedis(discordId, userData, 300);
  
          const confirmationEmbed = new EmbedBuilder()
            .setColor('#0099ff')
            .setTitle('Transfer Confirmation')
            .addFields(
              { name: 'Network', value: network, inline: true },
              { name: 'Token', value: token.token_name, inline: true },
              { name: 'Amount', value: quantity, inline: true },
              { name: 'Recipient', value: recipient }
            )
            .setTimestamp();
  
          const confirmButton = new ButtonBuilder()
            .setCustomId('transfer_confirm')
            .setLabel('Confirm')
            .setStyle(ButtonStyle.Success);
  
          const cancelButton = new ButtonBuilder()
            .setCustomId('transfer_cancel')
            .setLabel('Cancel')
            .setStyle(ButtonStyle.Danger);
  
          return interaction.reply({
            content: 'Please review your transfer details:',
            embeds: [confirmationEmbed],
            components: [new ActionRowBuilder().addComponents(confirmButton, cancelButton)],
            ephemeral: true,
          });
        }
  
        if (interaction.customId === 'transfer_confirm' && step === 'confirm') {
          const { token, network, quantity, recipient } = userData.transferData;
  
          const transferPayload = {
            operation_type: 'TOKEN_TRANSFER',
            network_name: network,
            token_name: token.token_name,
            token_address: token.token_name === 'POL' ? null : token.token_address,
            quantity,
            recipient_address: recipient,
          };
  
          try {
            const transferResult = await callOktoApi(
              discordId,
              'post',
              '/api/v1/transfer/tokens/execute',
              transferPayload,
              {
                'Authorization': `Bearer ${userData.auth_token}`,
                'X-Api-Key': process.env.OKTO_CLIENT_API_KEY,
                'Content-Type': 'application/json',
              }
            );
  
            delete userData.transferData;
            await saveUserToRedis(discordId, userData);
  
            return interaction.update({
              content: `Transfer initiated successfully! Order ID: ${transferResult.data.orderId}`,
              components: [],
              embeds: [],
              ephemeral: true,
            });
          } catch (error) {
            return interaction.update({
              content: `Error initiating transfer: ${error.message}`,
              components: [],
              ephemeral: true,
            });
          }
        }
  
        if (interaction.customId === 'transfer_cancel' && step) {
          delete userData.transferData;
          await saveUserToRedis(discordId, userData);
  
          return interaction.update({
            content: 'Transfer cancelled.',
            components: [],
            embeds: [],
            ephemeral: true,
          });
        }
      }
    } catch (error) {
      console.error('Error in handleTransferCommand:', error);
      try {
        await interaction.reply({
          content: `An error occurred: ${error.message}`,
          ephemeral: true,
        });
      } catch (e) {
        console.error('Error sending error message:', e);
      }
    }
  }

async function handleTransferNftCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  const params = {
    operation_type: 'NFT_TRANSFER',
    network_name: interaction.options.getString('network_name'),
    collection_address: interaction.options.getString('collection_address'),
    collection_name: interaction.options.getString('collection_name'),
    nft_address: interaction.options.getString('token_id'),
    quantity: "1",
    recipient_address: interaction.options.getString('recipient_address'),
  };

  try {
    const result = await callOktoApi(
      discordId,
      'post',
      '/api/v1/nft/transfer',
      params
    );
    await interaction.reply({
      content: `NFT transfer initiated. Order ID: ${result.data.order_id}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error during NFT transfer: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleNftOrderDetailsCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  const order_id = interaction.options.getString('order_id') || null;
  const params = order_id ? { order_id } : null;

  try {
    const result = await callOktoApi(
      discordId,
      'get',
      '/api/v1/nft/order_details',
      params
    );
    const nfts = result.data.details
      .map(
        (nft) =>
          `**NFT Name:** ${nft.nft_name}\n**Collection:** ${nft.collection_name}\n**Network:** ${nft.network_name}`
      )
      .join('\n\n');
    await interaction.reply({
      content: `NFT Order Details:\n${nfts}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching NFT order details: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleOrdersCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }

  try {
    const result = await callOktoApi(
      discordId, 
      'get', 
      `/api/v1/orders?offset=0&limit=100`
    );
    
    if (!result.data.jobs || result.data.jobs.length === 0) {
      return interaction.reply({
        content: 'No orders found.',
        ephemeral: true,
      });
    }

    const sortedOrders = result.data.jobs.sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    );

    const ordersPerPage = 5;
    const orderChunks = [];
    for (let i = 0; i < sortedOrders.length; i += ordersPerPage) {
      orderChunks.push(sortedOrders.slice(i, i + ordersPerPage));
    }

    const userData = await getUserFromRedis(discordId) || {};
    userData.ordersData = {
      chunks: orderChunks,
      currentPage: 0,
      totalOrders: sortedOrders.length,
      hasMore: (sortedOrders.length === 100)
    };
    await saveUserToRedis(discordId, userData, 300);

    const ordersMessage = formatOrdersPage(orderChunks[0], 1, orderChunks.length, sortedOrders.length, userData.ordersData.hasMore);

    const components = [];
    if (orderChunks.length > 1 || userData.ordersData.hasMore) {
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('orders_prev')
            .setLabel('Previous')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId('orders_next')
            .setLabel('Next')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(false)
        );
      components.push(row);
    }

    await interaction.reply({
      content: ordersMessage,
      components,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching orders: ${error.message}`,
      ephemeral: true,
    });
  }
}

function formatOrdersPage(orders, currentPage, totalPages, totalOrders, hasMore) {
  const formattedOrders = orders.map(order => {
    let orderDetails = [
      `**Order ID:** ${order.order_id}`,
      `**Type:** ${order.order_type}`,
      `**Status:** ${order.status}`,
      `**Network:** ${order.network_name || 'N/A'}`,
      `**Token:** ${order.token_name || 'N/A'}`
    ];

    if (order.quantity) {
      orderDetails.push(`**Amount:** ${order.quantity}`);
    }

    if (order.recipient_address) {
      orderDetails.push(`**Recipient:** ${order.recipient_address}`);
    }

    if (order.error) {
      orderDetails.push(`**Error:** ${order.error}`);
    }

    orderDetails.push(`**Created At:** ${new Date(order.created_at).toLocaleString()}`);

    if (order.updated_at) {
      orderDetails.push(`**Updated At:** ${new Date(order.updated_at).toLocaleString()}`);
    }

    return orderDetails.join('\n');
  }).join('\n\n');

  let headerText = `**Your Orders (Page ${currentPage}/${totalPages}`;
  if (hasMore) {
    headerText += '+';
  }
  headerText += `, Showing ${totalOrders} orders`;
  if (hasMore) {
    headerText += '+';
  }
  headerText += ')**\n\n';

  return headerText + formattedOrders;
}

async function handleRawTransactionCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  const network_name = interaction.options.getString('network_name');
  const raw_transaction = interaction.options.getString('raw_transaction');

  let transaction;
  try {
    transaction = JSON.parse(raw_transaction);
  } catch (error) {
    return interaction.reply({
      content: 'Invalid transaction data. Please provide valid JSON.',
      ephemeral: true,
    });
  }

  const params = {
    network_name,
    transaction,
  };

  try {
    const result = await callOktoApi(
      discordId,
      'post',
      '/api/v1/rawtransaction/execute',
      params
    );
    await interaction.reply({
      content: `Raw transaction executed. Job ID: ${result.data.jobId}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error executing raw transaction: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleRawTransactionStatusCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using /login.',
      ephemeral: true,
    });
  }
  const order_id = interaction.options.getString('order_id');

  const params = { order_id };

  try {
    // NOTE: The Okto API docs show `GET /api/v1/rawtransaction/status` with a query parameter, not POST
    // Adjusting to GET request:
    const result = await callOktoApi(
      discordId,
      'get',
      `/api/v1/rawtransaction/status?order_id=${order_id}`
    );
    const jobs = result.data.jobs
      .map(
        (job) =>
          `**Order ID:** ${job.order_id}\n**Status:** ${job.status}\n**Transaction Hash:** ${job.transaction_hash}`
      )
      .join('\n\n');
    await interaction.reply({
      content: `Raw transaction status:\n${jobs}`,
      ephemeral: true,
    });
  } catch (error) {
    await interaction.reply({
      content: `Error fetching raw transaction status: ${error.message}`,
      ephemeral: true,
    });
  }
}

async function handleHelpCommand(interaction) {
  const helpMessage = commands
    .map((cmd) => `**/${cmd.name}** - ${cmd.description}`)
    .join('\n');
  await interaction.reply({
    content: `Available Commands:\n${helpMessage}`,
    ephemeral: true,
  });
}

async function handleSwapCommand(interaction, discordId) {
  if (!await isAuthenticated(discordId)) {
    return interaction.reply({
      content: 'Please log in first using `/login`.',
      ephemeral: true,
    });
  }

  try {
    // Get user's portfolio first
    const portfolioResult = await callOktoApi(
      discordId,
      'get',
      '/api/v1/portfolio'
    );

    console.log('Portfolio Response:', JSON.stringify(portfolioResult.data, null, 2));

    if (!portfolioResult.data?.tokens || portfolioResult.data.tokens.length === 0) {
      return interaction.reply({
        content: 'No tokens found in your portfolio. Please add some tokens to your wallet first using the Okto app.',
        ephemeral: true,
      });
    }

    // Whitelist of allowed swap tokens
    const ALLOWED_SWAP_TOKENS = [
      { token_name: 'ETH', network_name: 'BASE', is_evm: true },
      { token_name: 'POL', network_name: 'POLYGON', is_evm: true },
      { token_name: 'SOL', network_name: 'SOLANA', is_evm: false },
      { token_name: 'Temp USDC', network_name: 'POLYGON', is_evm: true },
      { token_name: 'USDC', network_name: 'SOLANA', is_evm: false },
      { token_name: 'USDC', network_name: 'BASE', is_evm: true },
      { token_name: 'USDT', network_name: 'POLYGON', is_evm: true },
      { token_name: 'USDT', network_name: 'APTOS', is_evm: false },
      { token_name: 'USDT', network_name: 'SOLANA', is_evm: false }
    ];

    // Helper function to check if a token is in the whitelist
    function isTokenAllowed(token_name, network_name) {
      return ALLOWED_SWAP_TOKENS.some(
        allowed => allowed.token_name === token_name && allowed.network_name === network_name
      );
    }

    // Helper function to get allowed destination tokens for a network
    function getAllowedDestinationTokens(network) {
      return ALLOWED_SWAP_TOKENS.filter(token => token.network_name === network);
    }

    // Filter out tokens with invalid data and not in whitelist
    const validTokens = portfolioResult.data.tokens.filter(token => {
      // Basic token validation
      if (!token || !token.network_name || !token.token_name || !token.quantity) {
        return false;
      }

      // Check if token is in whitelist
      if (!isTokenAllowed(token.token_name, token.network_name)) {
        return false;
      }

      // For native tokens (like MATIC/POL on Polygon or ETH on Base), token_address might be empty
      if ((token.network_name === "POLYGON" && token.token_name === "POL") ||
          (token.network_name === "BASE" && token.token_name === "ETH")) {
        return true;
      }

      // For other tokens, require token_address
      return !!token.token_address;
    });

    console.log('Valid tokens for swap:', JSON.stringify(validTokens, null, 2));

    if (validTokens.length === 0) {
      const allowedTokensList = ALLOWED_SWAP_TOKENS.map(t => `${t.token_name} on ${t.network_name}`).join('\n');
      return interaction.reply({
        content: 'No supported tokens found in your portfolio. Currently supported tokens are:\n' +
                allowedTokensList + '\n\n' +
                'Please ensure you have one of these tokens in your wallet and try again.',
        ephemeral: true,
      });
    }

    // Get available networks from portfolio (only networks with allowed tokens)
    const networks = [...new Set(validTokens.map(token => token.network_name))];
    
    // Create network selection menu
    const networkSelect = new StringSelectMenuBuilder()
      .setCustomId('swap_network')
      .setPlaceholder('Select Network')
      .addOptions(networks.map(network => ({
        label: network,
        value: network,
        description: `Swap on ${network} network`,
      })));

    const row = new ActionRowBuilder().addComponents(networkSelect);

    // Save swap data in Redis with 5-minute expiration
    const userData = await getUserFromRedis(discordId) || {};
    const swapData = {
      portfolio: validTokens,
      step: 'network'
    };

    await saveUserToRedis(discordId, { 
      ...userData,
      swapData
    }, 300);

    await interaction.reply({
      content: '**Token Swap**\nStep 1: Select the network for your swap:',
      components: [row],
      ephemeral: true,
    });
  } catch (error) {
    console.error('Swap error:', error);
    await interaction.reply({
      content: `An error occurred: ${error.message}`,
      ephemeral: true,
    });
  }
}

// Add handler for swap interactions
client.on('interactionCreate', async interaction => {
  if (!interaction.isStringSelectMenu() && !interaction.isModalSubmit()) return;

  const discordId = interaction.user.id;
  const userData = await getUserFromRedis(discordId);

  // Only check for swap data if it's a swap-related interaction
  if (interaction.customId?.startsWith('swap_')) {
    if (!userData?.swapData) {
      return interaction.reply({
        content: 'Swap session expired. Please start again with `/swap`.',
        ephemeral: true,
      });
    }

    const { step, portfolio, network } = userData.swapData;

    // Handle network selection
    if (interaction.customId === 'swap_network' && step === 'network') {
      const selectedFromNetwork = interaction.values[0];
      const networkTokens = portfolio.filter(
        token => token.network_name === selectedFromNetwork
      );

      // Create token selection menu
      const tokenOptions = networkTokens.map(token => {
        let value = token.token_address;
        
        // Handle native tokens
        if (token.token_name === 'POL' && token.network_name === 'POLYGON') {
          value = 'NATIVE_POL';
        } else if (token.token_name === 'ETH' && token.network_name === 'BASE') {
          value = 'NATIVE_ETH';
        } else if (!token.token_address) {
          // Skip tokens without addresses that aren't native tokens
          return null;
        }

        return {
          label: token.token_name,
          value: value || 'UNKNOWN',  // Ensure value is never empty
          description: `Balance: ${token.quantity}`,
        };
      }).filter(option => option !== null);  // Remove any null options

      const tokenSelect = new StringSelectMenuBuilder()
        .setCustomId('swap_sell_token')
        .setPlaceholder('Select Token to Sell')
        .addOptions(tokenOptions);

      userData.swapData = { 
        ...userData.swapData, 
        fromNetwork: selectedFromNetwork,
        step: 'sell_token'
      };
      await saveUserToRedis(discordId, userData, 300);

      return interaction.update({
        content: `**Token Swap**\nFrom Network: ${selectedFromNetwork}\nStep 2: Select the token to sell:`,
        components: [new ActionRowBuilder().addComponents(tokenSelect)],
      });
    }

    // Handle sell token selection
    if (interaction.customId === 'swap_sell_token' && step === 'sell_token') {
      const selectedToken = interaction.values[0];
      const networkTokens = portfolio.filter(
        token => token.network_name === userData.swapData.fromNetwork
      );

      // Get the selected token details
      let sellToken;
      if (selectedToken === 'NATIVE_POL') {
        sellToken = networkTokens.find(t => t.network_name === 'POLYGON' && t.token_name === 'POL');
      } else if (selectedToken === 'NATIVE_ETH') {
        sellToken = networkTokens.find(t => t.network_name === 'BASE' && t.token_name === 'ETH');
      } else {
        sellToken = networkTokens.find(t => t.token_address === selectedToken);
      }

      // Create amount input modal
      const modal = new ModalBuilder()
        .setCustomId('swap_amount')
        .setTitle('Swap Amount')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('amount')
              .setLabel(`Amount of ${sellToken.token_name} to swap`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(`Max: ${sellToken.quantity}`)
              .setRequired(true)
          )
        );

      userData.swapData = {
        ...userData.swapData,
        sellToken,
        sellTokenId: selectedToken,
        step: 'amount' 
      };
      await saveUserToRedis(discordId, userData, 300);

      return interaction.showModal(modal);
    }

    // Handle amount submission
    if (interaction.customId === 'swap_amount' && step === 'amount') {
      try {
        await interaction.deferReply({ ephemeral: true });
        
        const amount = interaction.fields.getTextInputValue('amount');
        
        // Validate amount
        if (isNaN(amount) || Number(amount) <= 0) {
          return interaction.editReply({
            content: 'Invalid amount. Please provide a valid positive number.',
          });
        }

        const sellAmount = Number(amount);
        const availableAmount = Number(userData.swapData.sellToken.quantity);

        if (sellAmount > availableAmount) {
          return interaction.editReply({
            content: `Insufficient balance. You only have ${availableAmount} ${userData.swapData.sellToken.token_name} available.`,
          });
        }

        // Create destination network selection menu
        const toNetworkSelect = new StringSelectMenuBuilder()
          .setCustomId('swap_to_network')
          .setPlaceholder('Select Destination Network')
          .addOptions(Object.keys(NETWORK_TO_CHAIN_ID)
            .filter(network => network !== userData.swapData.fromNetwork)
            .map(network => ({
              label: network,
              value: network,
              description: `Swap to ${network} network`,
            })));

        userData.swapData = {
          ...userData.swapData,
          amount,
          step: 'to_network'
        };
        await saveUserToRedis(discordId, userData, 300);

        return interaction.editReply({
          content: `**Token Swap**\nFrom: ${amount} ${userData.swapData.sellToken.token_name} (${userData.swapData.fromNetwork})\nStep 4: Select destination network:`,
          components: [new ActionRowBuilder().addComponents(toNetworkSelect)],
        });
      } catch (error) {
        console.error('Error handling amount:', error);
        return interaction.editReply({
          content: `Error: ${error.message}`,
        });
      }
    }

    // Handle destination network selection
    if (interaction.customId === 'swap_to_network' && step === 'to_network') {
      const selectedToNetwork = interaction.values[0];
      const fromNetwork = userData.swapData.fromNetwork;
      const fromToken = userData.swapData.sellToken.token_name;

      // Check if both networks are EVM-compatible
      if (!isEvmNetwork(fromNetwork) || !isEvmNetwork(selectedToNetwork)) {
        return interaction.update({
          content: 'Cross-chain swaps between these networks are not supported yet. Currently, swaps are only supported between POLYGON and BASE networks.',
          components: [interaction.message.components[0]], // Keep the network selection menu
        });
      }

      // Get allowed tokens for the selected network
      const allowedTokens = getAllowedDestinationTokens(selectedToNetwork);
      
      if (allowedTokens.length === 0) {
        return interaction.update({
          content: `No supported tokens available on ${selectedToNetwork}. Please select a different network.`,
          components: [interaction.message.components[0]], // Keep the network selection menu
        });
      }

      // Filter out non-EVM tokens
      const evmTokens = allowedTokens.filter(token => token.is_evm);

      // Create destination token selection
      const buyTokenSelect = new StringSelectMenuBuilder()
        .setCustomId('swap_buy_token')
        .setPlaceholder('Select Token to Receive')
        .addOptions(evmTokens.map(token => ({
          label: token.token_name,
          value: token.token_name,
          description: `Receive ${token.token_name} on ${selectedToNetwork}`,
        })));

      userData.swapData = {
        ...userData.swapData,
        toNetwork: selectedToNetwork,
        step: 'buy_token'
      };
      await saveUserToRedis(discordId, userData, 300);

      return interaction.update({
        content: `**Token Swap**\nFrom: ${userData.swapData.amount} ${userData.swapData.sellToken.token_name} (${userData.swapData.fromNetwork})\nTo Network: ${selectedToNetwork}\nStep 5: Select the token to receive:`,
        components: [new ActionRowBuilder().addComponents(buyTokenSelect)],
      });
    }

    // Handle buy token selection
    if (interaction.customId === 'swap_buy_token' && step === 'buy_token') {
      await interaction.deferUpdate();

      try {
        const selectedToken = interaction.values[0];
        const amount = userData.swapData.amount;
        const userWallet = (await callOktoApi(discordId, 'get', '/api/v1/wallet')).data.wallets.find(
          wallet => wallet.network_name === userData.swapData.fromNetwork
        )?.address;

        if (!userWallet) {
          return interaction.editReply({
            content: `No wallet found for network ${userData.swapData.fromNetwork}. Please create one first.`,
          });
        }

        // Convert amount to wei
        const decimals = 18; // Most tokens use 18 decimals
        let sellAmountWei;
        try {
          sellAmountWei = ethers.utils.parseUnits(amount.toString(), decimals).toString();
        } catch (error) {
          return interaction.editReply({
            content: 'Error: Invalid amount format.',
          });
        }

        const fromChainId = NETWORK_TO_CHAIN_ID[userData.swapData.fromNetwork.toUpperCase()];
        const toChainId = NETWORK_TO_CHAIN_ID[userData.swapData.toNetwork.toUpperCase()];

        if (!fromChainId || !toChainId) {
          return interaction.editReply({
            content: 'Unsupported network combination.',
          });
        }

        // Get quote from Li.Fi
        const fromTokenAddress = userData.swapData.sellTokenId === 'NATIVE_POL' ? NATIVE_TOKEN_ADDRESS : userData.swapData.sellTokenId;
        
        console.log('Getting Li.Fi quote with params:', {
          fromChain: userData.swapData.fromNetwork,
          toChain: userData.swapData.toNetwork,
          fromToken: fromTokenAddress,
          toToken: selectedToken,
          fromAmount: sellAmountWei,
          fromAddress: userWallet
        });

        const quoteData = await getLiFiQuote(
          userData.swapData.fromNetwork,
          fromTokenAddress,
          userData.swapData.toNetwork,
          selectedToken,
          sellAmountWei,
          userWallet
        );

        console.log('Li.Fi Quote Response:', JSON.stringify(quoteData, null, 2));

        // Extract transaction details
        const { transactionRequest, estimate, action } = quoteData;
        if (!estimate || !action) {
          throw new Error('Invalid quote response: Missing required data');
        }

        // Get token decimals from the action object which contains the complete token information
        const fromTokenDecimals = action.fromToken?.decimals || 18;
        const toTokenDecimals = action.toToken?.decimals || 18;

        // Prepare transaction data for Okto API
        const transactionData = {
          network_name: userData.swapData.fromNetwork,
          from: userWallet,
          to: transactionRequest.to,
          data: transactionRequest.data,
          value: transactionRequest.value || '0',
          gas_price: transactionRequest.gasPrice || '0',
          gas_limit: transactionRequest.gasLimit || '0'
        };

        // Show confirmation message with estimated output
        const estimatedOutput = ethers.utils.formatUnits(estimate.toAmount, toTokenDecimals);
        const fromTokenDisplay = action.fromToken?.symbol || userData.swapData.sellToken?.token_name || 'Unknown Token';
        const toTokenDisplay = action.toToken?.symbol || 'Unknown Token';
        
        const message = `Swap Summary:
From: ${amount} ${fromTokenDisplay} (${userData.swapData.fromNetwork})
To: ~${estimatedOutput} ${toTokenDisplay} (${userData.swapData.toNetwork})
Estimated Gas (USD): $${estimate.gasCosts[0]?.amountUSD || '0'}
Minimum Received: ${ethers.utils.formatUnits(estimate.toAmountMin, toTokenDecimals)} ${toTokenDisplay}

Do you want to proceed with this swap?`;

        // Create confirm/cancel buttons
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('confirm_swap')
              .setLabel('Confirm')
              .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
              .setCustomId('cancel_swap')
              .setLabel('Cancel')
              .setStyle(ButtonStyle.Danger)
          );

        // Store transaction data in user session
        userData.pendingSwap = {
          transactionData,
          quoteData,
          message
        };

        // Send confirmation message with buttons
        await interaction.editReply({
          content: message,
          components: [row],
          ephemeral: true
        });

        // Set up button collector
        const filter = i => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async i => {
          if (i.customId === 'confirm_swap') {
            await i.deferUpdate();
            await handleSwapConfirmation(i, userData);
          } else if (i.customId === 'cancel_swap') {
            await i.update({ content: 'Swap cancelled.', components: [] });
            collector.stop();
          }
        });

        collector.on('end', collected => {
          if (collected.size === 0) {
            interaction.editReply({ content: 'Swap timed out.', components: [] });
          }
        });
      } catch (error) {
        console.error('Swap Error:', error);
        return interaction.editReply({
          content: `Error: ${error.message}`,
        });
      }
    }

    // Handle swap confirmation
    if (interaction.customId === 'confirm_swap') {
      await interaction.deferUpdate();

      try {
        console.log('Executing swap with transaction data:', JSON.stringify(userData.pendingSwap.transactionData, null, 2));
        
        // Execute the raw transaction
        const result = await executeRawTransaction(interaction.user.id, userData.pendingSwap.transactionData);

        console.log('Raw transaction response:', JSON.stringify(result, null, 2));

        // Check if we have an orderId in the response (direct response case)
        if (result.orderId) {
          const orderId = result.orderId;
          
          // Store the order ID for status tracking
          userData.pendingSwap.jobId = orderId;
          await saveUserToRedis(interaction.user.id, userData, 300);

          const successMessage = `Swap completed successfully!\nOrder ID: ${orderId}`;
          return interaction.editReply({
            content: successMessage,
            components: []
          });
        }
        // Check nested data structure
        else if (result.status === 'success' || result.status === 'completed') {
          const jobId = result.data?.jobId || result.data?.orderId;
          if (!jobId) {
            throw new Error('No order ID or job ID found in response');
          }
          
          // Store the job ID for status tracking
          userData.pendingSwap.jobId = jobId;
          await saveUserToRedis(interaction.user.id, userData, 300);

          const successMessage = `Swap completed successfully!\nOrder ID: ${jobId}`;
          return interaction.editReply({
            content: successMessage,
            components: []
          });
        } else {
          throw new Error(`Failed to execute swap: ${result.message || 'Transaction failed'}`);
        }
      } catch (error) {
        console.error('Swap Execution Error:', error);
        
        let errorMessage = 'Failed to execute swap: ';
        
        if (error.response?.data?.error?.message) {
          // Handle structured error response
          errorMessage += error.response.data.error.message;
          if (error.response.data.error.details) {
            errorMessage += `\nDetails: ${error.response.data.error.details}`;
          }
        } else if (error.response?.data?.message) {
          // Handle simple error message
          errorMessage += error.response.data.message;
        } else if (error.message && error.message !== '[object Object]') {
          // Handle generic error message, avoiding [object Object]
          errorMessage += error.message;
        } else {
          // Fallback error message
          errorMessage += 'An unexpected error occurred. Please try again later.';
        }
        
        return interaction.editReply({
          content: errorMessage,
          components: []
        });
      }
    }

    // Handle swap cancellation
    if (interaction.customId === 'cancel_swap') {
      // Clear swap data
      delete userData.pendingSwap;
      delete userData.swapData;
      await saveUserToRedis(interaction.user.id, userData);

      return interaction.update({
        content: 'Swap cancelled.',
        components: []
      });
    }
  }
});

// Command handler stubs
const commandHandlers = {
  login: handleLoginCommand,
  wallets: handleWalletsCommand,
  createwallet: handleCreateWalletCommand,
  portfolio: handlePortfolioCommand,
  portfolioactivity: handlePortfolioActivityCommand,
  refresh_token: handleRefreshTokenCommand,
  logout: handleLogoutCommand,
  userdetails: handleUserDetailsCommand,
  networks: handleNetworksCommand,
  tokens: handleTokensCommand,
  transfer: handleTransferCommand,
  transfernft: handleTransferNftCommand,
  nftorderdetails: handleNftOrderDetailsCommand,
  orders: handleOrdersCommand,
  rawtransaction: handleRawTransactionCommand,
  rawtransactionstatus: handleRawTransactionStatusCommand,
  help: handleHelpCommand,
  swap: handleSwapCommand,
};

client.on('interactionCreate', async (interaction) => {
    const discordId = interaction.user.id;
  
    try {
      if (interaction.isCommand()) {
        const { commandName } = interaction;
        if (commandName === 'help') {
          await handleHelpCommand(interaction);
          return;
        }
  
        if (commandName === 'login' || await isAuthenticated(discordId)) {
          if (commandHandlers[commandName]) {
            await commandHandlers[commandName](interaction, discordId);
          } else {
            await interaction.reply({
              content: 'Unknown command. Use /help to see available commands.',
              ephemeral: true,
            });
          }
        } else {
          await interaction.reply({
            content: 'Please login first using the /login command.',
            ephemeral: true,
          });
        }
      }
      else if (
        interaction.isStringSelectMenu() || 
        interaction.isButton() || 
        (interaction.isModalSubmit() && interaction.customId === 'transfer_details')
      ) {
        if (interaction.customId.startsWith('transfer_')) {
          await handleTransferCommand(interaction, discordId);
        } else if (interaction.customId === 'orders_next' || interaction.customId === 'orders_prev') {
          await handleOrdersPagination(interaction, discordId);
        }
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
      try {
        const reply = {
          content: `An error occurred: ${error.message}`,
          ephemeral: true,
        };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(reply);
        } else {
          await interaction.reply(reply);
        }
      } catch (e) {
        console.error('Error sending error message:', e);
      }
    }
  });

async function handleOrdersPagination(interaction, discordId) {
  const userData = await getUserFromRedis(discordId);
  if (!userData || !userData.ordersData) {
    return interaction.reply({
      content: 'Order pagination data not found. Please run /orders again.',
      ephemeral: true,
    });
  }
  
  const { chunks, currentPage, totalOrders, hasMore } = userData.ordersData;
  
  let newPage = currentPage;
  if (interaction.customId === 'orders_next') {
    newPage = currentPage + 1;
  } else if (interaction.customId === 'orders_prev') {
    newPage = currentPage - 1;
  }
  
  if (newPage < 0) newPage = 0;
  if (newPage >= chunks.length) newPage = chunks.length - 1;
  
  userData.ordersData.currentPage = newPage;
  await saveUserToRedis(discordId, userData, 300);

  const ordersMessage = formatOrdersPage(chunks[newPage], newPage + 1, chunks.length, totalOrders, hasMore);

  const components = [];
  const prevDisabled = newPage === 0;
  const nextDisabled = newPage === chunks.length - 1 && !hasMore;
  
  const row = new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('orders_prev')
        .setLabel('Previous')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(prevDisabled),
      new ButtonBuilder()
        .setCustomId('orders_next')
        .setLabel('Next')
        .setStyle(ButtonStyle.Primary)
        .setDisabled(nextDisabled)
    );
  
  components.push(row);
  
  await interaction.update({
    content: ordersMessage,
    components,
    ephemeral: true,
  });
}

// Base URL configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
console.log('Base URL:', BASE_URL);

// OAuth Callback for Google Auth
app.get('/auth/google/callback', async (req, res) => {
  const { code, state: discordId } = req.query;
  
  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'http://localhost:3000/auth/google/callback',
      grant_type: 'authorization_code'
    });

    const idToken = tokenResponse.data.id_token;

    if (!idToken) {
      return res.status(400).send('Failed to retrieve id_token from Google');
    }

    try {
      const oktoResponse = await axios.post(
        'https://sandbox-api.okto.tech/api/v2/authenticate',
        { id_token: idToken },
        {
          headers: {
            'X-Api-Key': process.env.OKTO_CLIENT_API_KEY,
            'Content-Type': 'application/json',
          },
        }
      );

      const authData = oktoResponse.data.data;
      await saveUserToRedis(discordId, {
        auth_token: authData.auth_token,
        refresh_auth_token: authData.refresh_auth_token,
        device_token: authData.device_token,
        status: 'authenticated',
      });

      await sendDiscordMessage(
        discordId,
        'You have been successfully authenticated with Okto!'
      );

      res.send(
        'You have been successfully authenticated! You can now return to Discord.'
      );
    } catch (oktoError) {
      console.error(
        'Okto API Error:',
        JSON.stringify(
          oktoError.response ? oktoError.response.data : oktoError.message,
          null,
          2
        )
      );
      res.status(500).send('Okto authentication failed.');
    }
  } catch (error) {
    console.error(
      'Error during Google token exchange:',
      error.response ? error.response.data : error.message
    );
    res.status(500).send('Google token exchange failed.');
  }
});

async function handleSwapConfirmation(interaction, userData) {
  try {
    console.log('Executing swap with transaction data:', JSON.stringify(userData.pendingSwap.transactionData, null, 2));
    
    // Execute the raw transaction
    const result = await executeRawTransaction(interaction.user.id, userData.pendingSwap.transactionData);

    console.log('Raw transaction response:', JSON.stringify(result, null, 2));

    // Check if we have an orderId in the response (direct response case)
    if (result.orderId) {
      const orderId = result.orderId;
      
      // Store the order ID for status tracking
      userData.pendingSwap.jobId = orderId;
      await saveUserToRedis(interaction.user.id, userData, 300);

      const successMessage = `Swap completed successfully!\nOrder ID: ${orderId}`;
      return interaction.editReply({
        content: successMessage,
        components: []
      });
    }
    // Check nested data structure
    else if (result.status === 'success' || result.status === 'completed') {
      const jobId = result.data?.jobId || result.data?.orderId;
      if (!jobId) {
        throw new Error('No order ID or job ID found in response');
      }
      
      // Store the job ID for status tracking
      userData.pendingSwap.jobId = jobId;
      await saveUserToRedis(interaction.user.id, userData, 300);

      const successMessage = `Swap completed successfully!\nOrder ID: ${jobId}`;
      return interaction.editReply({
        content: successMessage,
        components: []
      });
    } else {
      throw new Error(`Failed to execute swap: ${result.message || 'Transaction failed'}`);
    }
  } catch (error) {
    console.error('Swap Execution Error:', error);
    
    let errorMessage = 'Failed to execute swap: ';
    
    if (error.response?.data?.error?.message) {
      // Handle structured error response
      errorMessage += error.response.data.error.message;
      if (error.response.data.error.details) {
        errorMessage += `\nDetails: ${error.response.data.error.details}`;
      }
    } else if (error.response?.data?.message) {
      // Handle simple error message
      errorMessage += error.response.data.message;
    } else if (error.message && error.message !== '[object Object]') {
      // Handle generic error message, avoiding [object Object]
      errorMessage += error.message;
    } else {
      // Fallback error message
      errorMessage += 'An unexpected error occurred. Please try again later.';
    }
    
    return interaction.editReply({
      content: errorMessage,
      components: []
    });
  }
}
