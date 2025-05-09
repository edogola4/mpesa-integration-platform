// server/tests/setup.js
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.test' });

let mongoServer;

// Set up the in-memory database before tests
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

// Clear database between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Close database connection after tests
afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// server/tests/unit/models/user.test.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../../../src/models/user');

describe('User Model', () => {
  it('should hash password before saving', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'business'
    };

    const user = new User(userData);
    await user.save();

    expect(user.password).not.toBe(userData.password);
    expect(await bcrypt.compare(userData.password, user.password)).toBe(true);
  });

  it('should not allow duplicate emails', async () => {
    const userData = {
      email: 'duplicate@example.com',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'business'
    };

    await new User(userData).save();
    
    const duplicateUser = new User(userData);
    
    await expect(duplicateUser.save()).rejects.toThrow();
  });

  it('should validate email format', async () => {
    const userData = {
      email: 'invalid-email',
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role: 'business'
    };

    const user = new User(userData);
    
    await expect(user.validate()).rejects.toThrow();
  });
});

// server/tests/unit/models/business.test.js
const mongoose = require('mongoose');
const Business = require('../../../src/models/business');
const User = require('../../../src/models/user');

describe('Business Model', () => {
  let ownerId;

  beforeEach(async () => {
    const user = await new User({
      email: 'business-owner@example.com',
      password: 'Password123!',
      firstName: 'Business',
      lastName: 'Owner',
      role: 'business'
    }).save();
    
    ownerId = user._id;
  });

  it('should create a business successfully', async () => {
    const businessData = {
      name: 'Test Business',
      owner: ownerId,
      notificationEmail: 'notifications@testbusiness.com',
      notificationPhone: '+254712345678'
    };

    const business = await new Business(businessData).save();
    
    expect(business.name).toBe(businessData.name);
    expect(business.owner.toString()).toBe(ownerId.toString());
  });

  it('should add API keys to a business', async () => {
    const business = await new Business({
      name: 'API Key Test Business',
      owner: ownerId
    }).save();
    
    business.apiKeys.push({
      key: 'test-api-key',
      secret: 'test-api-secret',
      name: 'Test API Key'
    });
    
    await business.save();
    
    expect(business.apiKeys.length).toBe(1);
    expect(business.apiKeys[0].name).toBe('Test API Key');
  });

  it('should add M-Pesa integration to a business', async () => {
    const business = await new Business({
      name: 'M-Pesa Integration Test',
      owner: ownerId
    }).save();
    
    business.mpesaIntegrations.push({
      country: 'kenya',
      shortCode: '174379',
      consumerKey: 'test-consumer-key',
      consumerSecret: 'test-consumer-secret',
      passkey: 'test-passkey'
    });
    
    await business.save();
    
    expect(business.mpesaIntegrations.length).toBe(1);
    expect(business.mpesaIntegrations[0].country).toBe('kenya');
  });
});

// server/tests/unit/models/transaction.test.js
const mongoose = require('mongoose');
const Transaction = require('../../../src/models/transaction');
const Business = require('../../../src/models/business');
const User = require('../../../src/models/user');

describe('Transaction Model', () => {
  let businessId;

  beforeEach(async () => {
    const user = await new User({
      email: 'transaction-test@example.com',
      password: 'Password123!',
      firstName: 'Transaction',
      lastName: 'Tester',
      role: 'business'
    }).save();
    
    const business = await new Business({
      name: 'Transaction Test Business',
      owner: user._id
    }).save();
    
    businessId = business._id;
  });

  it('should create a transaction successfully', async () => {
    const transactionData = {
      business: businessId,
      transactionType: 'payment',
      amount: 1000,
      currency: 'KES',
      country: 'kenya',
      phoneNumber: '254712345678',
      internalReference: 'TEST-REF-001'
    };

    const transaction = await new Transaction(transactionData).save();
    
    expect(transaction.amount).toBe(transactionData.amount);
    expect(transaction.status).toBe('initiated');
    expect(transaction.statusHistory.length).toBe(1);
  });

  it('should update transaction status correctly', async () => {
    const transaction = await new Transaction({
      business: businessId,
      transactionType: 'payment',
      amount: 1000,
      currency: 'KES',
      country: 'kenya',
      phoneNumber: '254712345678',
      internalReference: 'TEST-REF-002'
    }).save();
    
    // Update status to pending
    transaction.status = 'pending';
    transaction.statusHistory.push({
      status: 'pending',
      metadata: { reason: 'Payment initiated with M-Pesa' }
    });
    await transaction.save();
    
    // Update to completed
    transaction.status = 'completed';
    transaction.mpesaReference = 'MPESA-REF-123';
    transaction.statusHistory.push({
      status: 'completed',
      metadata: { mpesaReference: 'MPESA-REF-123' }
    });
    await transaction.save();
    
    expect(transaction.status).toBe('completed');
    expect(transaction.statusHistory.length).toBe(3); // initiated, pending, completed
    expect(transaction.mpesaReference).toBe('MPESA-REF-123');
  });
});

// server/tests/integration/auth.test.js
const request = require('supertest');
const app = require('../../src/app');
const User = require('../../src/models/user');

describe('Authentication API', () => {
  beforeEach(async () => {
    // Create a test user
    await new User({
      email: 'auth-test@example.com',
      password: await bcrypt.hash('Password123!', 10),
      firstName: 'Auth',
      lastName: 'Tester',
      role: 'business',
      isVerified: true
    }).save();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'new-user@example.com',
          password: 'Password123!',
          firstName: 'New',
          lastName: 'User',
          role: 'business'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe('new-user@example.com');
    });

    it('should not register with invalid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'short',
          firstName: '',
          lastName: 'User',
          role: 'business'
        });
      
      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth-test@example.com',
          password: 'Password123!'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
    });

    it('should not login with invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'auth-test@example.com',
          password: 'WrongPassword!'
        });
      
      expect(response.status).toBe(401);
    });
  });
});

// server/tests/integration/business.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/user');
const Business = require('../../src/models/business');

describe('Business API', () => {
  let token;
  let userId;

  beforeEach(async () => {
    // Create a test user
    const user = await new User({
      email: 'business-api-test@example.com',
      password: await bcrypt.hash('Password123!', 10),
      firstName: 'Business',
      lastName: 'API Tester',
      role: 'business',
      isVerified: true
    }).save();
    
    userId = user._id;
    
    // Generate authentication token
    token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
  });

  describe('POST /api/businesses', () => {
    it('should create a new business', async () => {
      const response = await request(app)
        .post('/api/businesses')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'API Test Business',
          notificationEmail: 'notify@apitestbusiness.com',
          notificationPhone: '+254712345678'
        });
      
      expect(response.status).toBe(201);
      expect(response.body.data.business.name).toBe('API Test Business');
      expect(response.body.data.business.owner.toString()).toBe(userId.toString());
    });
  });

  describe('GET /api/businesses', () => {
    beforeEach(async () => {
      // Create some businesses for the user
      await new Business({ 
        name: 'First Test Business', 
        owner: userId 
      }).save();
      
      await new Business({ 
        name: 'Second Test Business', 
        owner: userId 
      }).save();
    });

    it('should list user businesses', async () => {
      const response = await request(app)
        .get('/api/businesses')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.businesses.length).toBe(2);
    });
  });
});

// server/tests/integration/transactions.test.js
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const User = require('../../src/models/user');
const Business = require('../../src/models/business');
const Transaction = require('../../src/models/transaction');
const { MpesaService } = require('../../src/services/mpesa');

// Mock the MpesaService
jest.mock('../../src/services/mpesa', () => ({
  MpesaService: {
    initiatePayment: jest.fn().mockResolvedValue({
      transactionId: 'mock-transaction-id',
      status: 'pending'
    })
  }
}));

describe('Transactions API', () => {
  let token;
  let business;
  let apiKey;

  beforeEach(async () => {
    // Create a test user
    const user = await new User({
      email: 'transaction-api-test@example.com',
      password: await bcrypt.hash('Password123!', 10),
      firstName: 'Transaction',
      lastName: 'API Tester',
      role: 'business',
      isVerified: true
    }).save();
    
    // Generate authentication token
    token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    // Create a business with API keys
    business = await new Business({
      name: 'Transaction API Test Business',
      owner: user._id,
      apiKeys: [{
        key: 'test-api-key-123',
        secret: 'test-api-secret-456',
        name: 'Test API Key'
      }],
      mpesaIntegrations: [{
        country: 'kenya',
        shortCode: '174379',
        consumerKey: 'test-consumer-key',
        consumerSecret: 'test-consumer-secret',
        passkey: 'test-passkey'
      }]
    }).save();
    
    apiKey = business.apiKeys[0].key;
  });

  describe('POST /api/transactions/initiate', () => {
    it('should initiate a transaction with API key auth', async () => {
      const response = await request(app)
        .post('/api/transactions/initiate')
        .set('X-API-Key', apiKey)
        .send({
          amount: 1000,
          phoneNumber: '254712345678',
          country: 'kenya',
          reference: 'TEST-API-REF-001',
          description: 'Test payment'
        });
      
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveProperty('transactionId');
      expect(MpesaService.initiatePayment).toHaveBeenCalled();
    });
  });

  describe('GET /api/transactions', () => {
    beforeEach(async () => {
      // Create some test transactions
      await new Transaction({
        business: business._id,
        transactionType: 'payment',
        amount: 1000,
        currency: 'KES',
        country: 'kenya',
        phoneNumber: '254712345678',
        internalReference: 'TEST-API-REF-002',
        status: 'completed'
      }).save();
      
      await new Transaction({
        business: business._id,
        transactionType: 'payment',
        amount: 2000,
        currency: 'KES',
        country: 'kenya',
        phoneNumber: '254712345679',
        internalReference: 'TEST-API-REF-003',
        status: 'pending'
      }).save();
    });

    it('should list transactions with JWT auth', async () => {
      const response = await request(app)
        .get('/api/transactions')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.transactions.length).toBe(2);
    });
    
    it('should filter transactions by status', async () => {
      const response = await request(app)
        .get('/api/transactions?status=completed')
        .set('Authorization', `Bearer ${token}`);
      
      expect(response.status).toBe(200);
      expect(response.body.data.transactions.length).toBe(1);
      expect(response.body.data.transactions[0].status).toBe('completed');
    });
  });
});

// server/tests/integration/mpesa.test.js
const nock = require('nock');
const { MpesaKenyaClient } = require('../../src/services/mpesa/kenya');

describe('M-Pesa Kenya Client', () => {
  let mpesaClient;
  
  beforeEach(() => {
    mpesaClient = new MpesaKenyaClient({
      consumerKey: 'test-consumer-key',
      consumerSecret: 'test-consumer-secret',
      shortCode: '174379',
      passkey: 'test-passkey',
      environment: 'sandbox'
    });
    
    // Mock the authentication request
    nock('https://sandbox.safaricom.co.ke')
      .get('/oauth/v1/generate?grant_type=client_credentials')
      .reply(200, {
        access_token: 'test-access-token',
        expires_in: 3599
      });
  });
  
  afterEach(() => {
    nock.cleanAll();
  });

  it('should authenticate successfully', async () => {
    const token = await mpesaClient.authenticate();
    expect(token).toBe('test-access-token');
  });

  it('should initiate STK push payment', async () => {
    // Mock the STK push request
    nock('https://sandbox.safaricom.co.ke')
      .post('/mpesa/stkpush/v1/processrequest')
      .reply(200, {
        MerchantRequestID: 'test-merchant-request-id',
        CheckoutRequestID: 'test-checkout-request-id',
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        CustomerMessage: 'Success. Request accepted for processing'
      });
    
    const result = await mpesaClient.initiateSTKPush({
      phoneNumber: '254712345678',
      amount: 1,
      reference: 'TEST-REF',
      description: 'Test payment'
    });
    
    expect(result).toHaveProperty('MerchantRequestID');
    expect(result).toHaveProperty('CheckoutRequestID');
  });

  it('should check transaction status', async () => {
    // Mock the status check request
    nock('https://sandbox.safaricom.co.ke')
      .post('/mpesa/stkpushquery/v1/query')
      .reply(200, {
        ResponseCode: '0',
        ResponseDescription: 'Success. Request accepted for processing',
        MerchantRequestID: 'test-merchant-request-id',
        CheckoutRequestID: 'test-checkout-request-id',
        ResultCode: '0',
        ResultDesc: 'The service request is processed successfully.'
      });
    
    const result = await mpesaClient.checkSTKPushStatus('test-checkout-request-id');
    
    expect(result).toHaveProperty('ResultCode');
    expect(result.ResultCode).toBe('0');
  });
});

// server/tests/integration/webhook.test.js
const request = require('supertest');
const app = require('../../src/app');
const Transaction = require('../../src/models/transaction');
const Business = require('../../src/models/business');
const User = require('../../src/models/user');

describe('Webhook Handling', () => {
  let transaction;
  let business;
  
  beforeEach(async () => {
    // Create a test user
    const user = await new User({
      email: 'webhook-test@example.com',
      password: await bcrypt.hash('Password123!', 10),
      firstName: 'Webhook',
      lastName: 'Tester',
      role: 'business',
      isVerified: true
    }).save();
    
    // Create a business
    business = await new Business({
      name: 'Webhook Test Business',
      owner: user._id,
      webhookUrl: 'https://webhook.testbusiness.com/mpesa-callback'
    }).save();
    
    // Create a pending transaction
    transaction = await new Transaction({
      business: business._id,
      transactionType: 'payment',
      amount: 1000,
      currency: 'KES',
      country: 'kenya',
      phoneNumber: '254712345678',
      internalReference: 'WEBHOOK-TEST-REF',
      status: 'pending',
      mpesaReference: 'test-checkout-request-id'
    }).save();
  });

  describe('POST /api/webhooks/mpesa/kenya', () => {
    it('should process STK push callback', async () => {
      // Mock webhook notification service
      const mockNotifyBusiness = jest.spyOn(require('../../src/services/notifications'), 'notifyBusiness')
        .mockImplementation(() => Promise.resolve());
      
      const callbackData = {
        Body: {
          stkCallback: {
            MerchantRequestID: 'test-merchant-request-id',
            CheckoutRequestID: 'test-checkout-request-id',
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: {
              Item: [
                { Name: 'Amount', Value: 1000 },
                { Name: 'MpesaReceiptNumber', Value: 'LHG31AA4AY' },
                { Name: 'TransactionDate', Value: 20210717154747 },
                { Name: 'PhoneNumber', Value: 254712345678 }
              ]
            }
          }
        }
      };
      
      const response = await request(app)
        .post('/api/webhooks/mpesa/kenya')
        .send(callbackData);
      
      expect(response.status).toBe(200);
      
      // Verify transaction was updated
      const updatedTransaction = await Transaction.findById(transaction._id);
      expect(updatedTransaction.status).toBe('completed');
      expect(updatedTransaction.callbackData).toBeDefined();
      
      // Verify business was notified
      expect(mockNotifyBusiness).toHaveBeenCalledWith(
        business,
        expect.objectContaining({
          transactionId: transaction._id.toString()
        })
      );
      
      mockNotifyBusiness.mockRestore();
    });
  });
});