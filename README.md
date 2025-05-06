# M-Pesa Integration Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-4.4+-green)](https://www.mongodb.com/)
[![React](https://img.shields.io/badge/React-18.0+-61DAFB.svg)](https://reactjs.org/)

A seamless integration platform enabling businesses to easily connect with M-Pesa payment services across East Africa.

## 🌟 Features

- **Unified API**: Single API to integrate with M-Pesa across multiple East African countries
- **Business Dashboard**: Comprehensive dashboard for transaction management and analytics
- **Multi-Country Support**: Supports Kenya, Tanzania, Uganda, Rwanda, Mozambique, and DRC
- **Developer SDKs**: Ready-to-use client libraries in JavaScript, PHP, and Python
- **Sandbox Environment**: Test your integration before going live
- **Robust Security**: JWT authentication, encryption, and 2FA
- **Comprehensive Documentation**: Detailed guides and API reference

## 🚀 Getting Started

### Prerequisites

- Node.js (v14+)
- MongoDB (v4.4+)
- NPM (v6+)
- Git

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/mpesa-integration-platform.git
   cd mpesa-integration-platform
   ```

2. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file with your configuration details

3. Install dependencies:

   ```bash
   # Install all dependencies (root, server, client)
   npm run install-all
   ```

4. Start development servers:

   ```bash
   # Start both backend and frontend
   npm run dev
   
   # Or start them separately
   npm run server
   npm run client
   ```

5. Access the application:
   - Backend API: <http://localhost:5000>
   - Frontend Dashboard: <http://localhost:3000>

### Using Docker

If you prefer using Docker:

```bash
# Build and start all services
docker-compose up -d

# Stop all services
docker-compose down
```

## 📋 Project Structure

```
mpesa-integration-platform/
├── client/                     # Frontend React application
├── server/                     # Backend Node.js application
├── sdk/                        # Client libraries for integration
├── docs/                       # Documentation
├── scripts/                    # Utility scripts
└── ...
```

## 📊 API Documentation

API documentation will be available at `/api/docs` when running the server locally, or at `https://your-deployed-url.com/api/docs` in production.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support and inquiries, please open an issue on GitHub.
