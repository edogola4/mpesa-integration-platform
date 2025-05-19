const express = require('express');
const router = express.Router();

// Example integration route
router.get('/', (req, res) => {
  res.json({ message: 'Integration route working!' });
});

module.exports = router;
