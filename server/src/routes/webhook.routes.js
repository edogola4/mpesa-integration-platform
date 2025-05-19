const express = require('express');
const router = express.Router();

// Example webhook endpoint
router.post('/', (req, res) => {
  console.log('Webhook received:', req.body);
  res.status(200).send('Webhook received');
});

module.exports = router;
