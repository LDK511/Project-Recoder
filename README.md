# Shopping Mall - Full Stack Application

## Architecture
- **Backend**: Node.js + Express
- **Frontend**: React
- **Database**: PostgreSQL
- **Payment**: Local processing

## Setup

### Prerequisites
- Node.js 16+
- PostgreSQL 12+

### Installation

1. Install dependencies:
```bash
npm install
cd client && npm install && cd ..
```

2. Setup PostgreSQL:
```bash
psql -U postgres -d shopping_mall -f server/init.sql
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Start development:
```bash
npm run dev
```

- Backend: http://localhost:5000
- Frontend: http://localhost:3000

## Features
- Product listing with images
- Shopping cart management
- Checkout with payment processing
- Order tracking
- Local payment validation

## API Endpoints
- `GET /health` - Health check
- `GET /api/products` - List all products
- `GET /api/products/:id` - Get product details
- `POST /api/orders` - Create order
- `GET /api/orders/:id` - Get order details
- `POST /api/payment` - Process payment
