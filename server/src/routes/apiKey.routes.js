const express = require('express');
const router = express.Router();

// Example API key route
router.get('/', (req, res) => {
  res.json({ message: 'API key route working!' });
});

module.exports = router;
