# OktoDeFi Bot

A Discord bot for managing cryptocurrency wallets and performing DeFi operations using the Okto API and Li.Fi protocol integration.

## Features

- Wallet Management (Create, View, List)
- Portfolio Tracking
- Token Transfers
- Cross-chain Token Swaps
- NFT Transfers
- Transaction History
- Portfolio Activity Monitoring

## Prerequisites

- Node.js 18 or higher
- Discord Bot Token
- Okto API credentials
- Upstash Redis account

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000                        # Server port (defaults to 3000)
BASE_URL=localhost               # Base URL for your application

# Discord Configuration
DISCORD_BOT_TOKEN=your_discord_token
DISCORD_CLIENT_ID=your_client_id

# Okto API Configuration
OKTO_APP_ID=your_okto_app_id
OKTO_API_KEY=your_okto_api_key
OKTO_CLIENT_API_KEY=your_okto_client_api_key

# Redis Configuration (Upstash)
REDIS_URL=your_upstash_redis_url
```

## Installation

### Option 1: Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/OktoDeFiBot.git
   cd OktoDeFiBot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up your environment variables in `.env` file (see Environment Variables section)

4. Start the bot:
   ```bash
   npm start
   ```

### Option 2: Docker Deployment

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/OktoDeFiBot.git
   cd OktoDeFiBot
   ```

2. Create a `.env` file with your environment variables (see Environment Variables section)

3. Build and run using Docker Compose:
   ```bash
   docker-compose up -d
   ```

4. Check container logs:
   ```bash
   docker-compose logs -f
   ```

### Health Check

The application includes a built-in health check endpoint that Docker uses to monitor the service status. You can manually check it at:
```bash
curl http://localhost:3000/
```

### Troubleshooting

1. If the container fails to start, check the logs:
   ```bash
   docker-compose logs
   ```

2. To restart the container:
   ```bash
   docker-compose restart
   ```

## Commands

- `/login` - Authenticate with Okto
- `/wallets` - View your wallets
- `/create-wallet` - Create a new wallet
- `/portfolio` - View your portfolio
- `/portfolio-activity` - View recent portfolio activity
- `/transfer` - Transfer tokens
- `/transfer-nft` - Transfer NFTs
- `/swap` - Perform cross-chain token swaps
- `/networks` - List supported networks
- `/tokens` - List supported tokens
- `/orders` - View order history
- `/help` - Display help information

## Security Features

- Rate limiting
- Helmet security middleware
- Redis session management
- Environment variable configuration
- HTTPS enforcement in production

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
