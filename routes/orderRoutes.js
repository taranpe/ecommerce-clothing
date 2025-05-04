const express = require('express');
const router = express.Router();

// Order routes
router.get('/list', (req, res) => {
    res.render('orders/list'); // Render the order list page
});

router.get('/update/:id', (req, res) => {
    res.render('orders/update', { orderId: req.params.id }); // Render the order update page
});

// Add more routes for handling orders

module.exports = router;
