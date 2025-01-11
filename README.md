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

## Deployment to Google Cloud Platform

1. Install the Google Cloud SDK
2. Initialize your project:
```bash
gcloud init
```

3. Deploy to App Engine:
```bash
cd gcp
gcloud app deploy
```

The `app.yaml` file is already configured with the necessary settings for deployment.

## Deployment to DigitalOcean Droplet

1. Create a new Ubuntu droplet on DigitalOcean
   - Choose Ubuntu 22.04 LTS
   - Select your preferred size (minimum 1GB RAM recommended)
   - Add your SSH key for secure access

2. Connect to your droplet:
```bash
ssh root@your_droplet_ip
```

3. Update system and install dependencies:
```bash
apt update && apt upgrade -y
apt install -y nodejs npm nginx certbot python3-certbot-nginx
```

4. Install Node.js 18:
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs
```

5. Clone the repository:
```bash
git clone https://github.com/yourusername/OktoDeFiBot.git
cd OktoDeFiBot
```

6. Install PM2 globally:
```bash
npm install -g pm2
```

7. Set up environment variables:
```bash
nano .env
# Add your environment variables here
```

8. Install dependencies and start the application:
```bash
npm install
pm2 start gcp/index.js --name oktobot
pm2 save
pm2 startup
```

9. Configure Nginx:
```bash
nano /etc/nginx/sites-available/oktobot
```

Add the following configuration:
```nginx
server {
    server_name your_domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

10. Enable the site and get SSL certificate:
```bash
ln -s /etc/nginx/sites-available/oktobot /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
certbot --nginx -d your_domain.com
```

11. Monitor the application:
```bash
pm2 status
pm2 logs oktobot
```

### Maintenance Commands

- Restart the bot: `pm2 restart oktobot`
- View logs: `pm2 logs oktobot`
- Monitor resources: `pm2 monit`
- Update application:
```bash
cd OktoDeFiBot
git pull
npm install
pm2 restart oktobot
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
