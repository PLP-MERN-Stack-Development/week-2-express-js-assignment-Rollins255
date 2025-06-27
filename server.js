// server.js - Complete Express server

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Custom Error Classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.statusCode = 404;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
  }
}

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = 401;
  }
}

// Middleware setup
app.use(bodyParser.json());

// Custom Logger Middleware
const loggerMiddleware = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
};

app.use(loggerMiddleware);

// Authentication Middleware
const apiKeyMiddleware = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // In a real application, you would validate against a database or environment variable
  if (!apiKey || apiKey !== 'secret-api-key') {
    throw new AuthError('Invalid or missing API key');
  }
  
  next();
};

// Validation Middleware
const validateProductMiddleware = (req, res, next) => {
  const product = req.body;
  
  if (!product.name || typeof product.name !== 'string') {
    throw new ValidationError('Product name is required and must be a string');
  }
  
  if (!product.description || typeof product.description !== 'string') {
    throw new ValidationError('Product description is required and must be a string');
  }
  
  if (!product.price || typeof product.price !== 'number' || product.price <= 0) {
    throw new ValidationError('Product price is required and must be a positive number');
  }
  
  if (!product.category || typeof product.category !== 'string') {
    throw new ValidationError('Product category is required and must be a string');
  }
  
  if (typeof product.inStock !== 'boolean') {
    throw new ValidationError('Product inStock status is required and must be a boolean');
  }
  
  next();
};

// Sample in-memory products database
let products = [
  {
    id: '1',
    name: 'Laptop',
    description: 'High-performance laptop with 16GB RAM',
    price: 1200,
    category: 'electronics',
    inStock: true
  },
  {
    id: '2',
    name: 'Smartphone',
    description: 'Latest model with 128GB storage',
    price: 800,
    category: 'electronics',
    inStock: true
  },
  {
    id: '3',
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with timer',
    price: 50,
    category: 'kitchen',
    inStock: false
  }
];

// Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Product API! Go to /api/products to see all products.');
});

// GET /api/products - Get all products with filtering and pagination
app.get('/api/products', (req, res) => {
  let filteredProducts = [...products];
  
  // Filter by category if provided
  if (req.query.category) {
    filteredProducts = filteredProducts.filter(
      product => product.category.toLowerCase() === req.query.category.toLowerCase()
    );
  }
  
  // Filter by inStock if provided
  if (req.query.inStock) {
    const inStock = req.query.inStock.toLowerCase() === 'true';
    filteredProducts = filteredProducts.filter(
      product => product.inStock === inStock
    );
  }
  
  // Pagination
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  
  const results = {
    total: filteredProducts.length,
    page,
    limit,
    products: filteredProducts.slice(startIndex, endIndex)
  };
  
  res.json(results);
});

// GET /api/products/search - Search products by name
app.get('/api/products/search', (req, res) => {
  if (!req.query.q) {
    throw new ValidationError('Search query parameter "q" is required');
  }
  
  const searchTerm = req.query.q.toLowerCase();
  const matchedProducts = products.filter(product => 
    product.name.toLowerCase().includes(searchTerm)
  );
  
  res.json(matchedProducts);
});

// GET /api/products/stats - Get product statistics
app.get('/api/products/stats', (req, res) => {
  const stats = {
    totalProducts: products.length,
    inStock: products.filter(p => p.inStock).length,
    outOfStock: products.filter(p => !p.inStock).length,
    categories: {}
  };
  
  products.forEach(product => {
    if (!stats.categories[product.category]) {
      stats.categories[product.category] = 0;
    }
    stats.categories[product.category]++;
  });
  
  res.json(stats);
});

// GET /api/products/:id - Get a specific product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  
  if (!product) {
    throw new NotFoundError('Product not found');
  }
  
  res.json(product);
});

// POST /api/products - Create a new product
app.post('/api/products', apiKeyMiddleware, validateProductMiddleware, (req, res) => {
  const newProduct = {
    id: uuidv4(),
    ...req.body
  };
  
  products.push(newProduct);
  res.status(201).json(newProduct);
});

// PUT /api/products/:id - Update a product
app.put('/api/products/:id', apiKeyMiddleware, validateProductMiddleware, (req, res) => {
  const productIndex = products.findIndex(p => p.id === req.params.id);
  
  if (productIndex === -1) {
    throw new NotFoundError('Product not found');
  }
  
  const updatedProduct = {
    ...products[productIndex],
    ...req.body,
    id: req.params.id // Ensure ID remains the same
  };
  
  products[productIndex] = updatedProduct;
  res.json(updatedProduct);
});

// DELETE /api/products/:id - Delete a product
app.delete('/api/products/:id', apiKeyMiddleware, (req, res) => {
  const productIndex = products.findIndex(p => p.id === req.params.id);
  
  if (productIndex === -1) {
    throw new NotFoundError('Product not found');
  }
  
  products = products.filter(p => p.id !== req.params.id);
  res.status(204).send();
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    error: {
      name: err.name || 'Error',
      message,
      statusCode
    }
  });
});

// 404 Handler
app.use((req, res, next) => {
  throw new NotFoundError('Endpoint not found');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Export the app for testing purposes
module.exports = app;