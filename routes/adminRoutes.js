const express = require('express');
const router = express.Router();
const db = require('../config/db'); // Import the database connection

// Fetch product by ID (simulating database fetch)
const getProductById = async (id) => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM products WHERE id = ?';  // Modify with your actual table name
    db.query(query, [id], (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results[0]);  // Return the first result (the product)
      }
    });
  });
};
// Fetch all products from the database
const getAllProducts = async () => {
  return new Promise((resolve, reject) => {
    const query = 'SELECT * FROM products'; // Modify with your table name
    db.query(query, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
};
// ========== CART FUNCTIONALITY ==========

// Add to Cart Route
router.post('/add-to-cart/:id', async (req, res) => {
  const productId = req.params.id;
  let cart = req.session.cart || [];

  const exists = cart.find(item => item.id === productId);

  if (!exists) {
    const product = await getProductById(productId);
    if (product) {
      cart.push({ ...product, quantity: 1 });
    }
  } else {
    exists.quantity += 1;
  }

  req.session.cart = cart;
  res.redirect('/cart');
});

// View Cart Route
router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];  // Get cart from session (or empty array if not present)
  res.render('cart', { cart });  // Render cart page and pass cart data
});
// ========== PRODUCT LIST ROUTE ==========

// Route to display all products in product-list page
router.get('/product-list', async (req, res) => {
  try {
    const products = await getAllProducts(); // Fetch all products dynamically from DB
    res.render('admin/product-list', { products }); // Render the product-list.ejs page with products
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});

// Example admin routes, you can modify these as per your requirements
router.get('/products', (req, res) => {
  res.render('admin/products');
});

router.get('/dashboard', (req, res) => {
  res.render('admin/dashboard');
});

router.get('/add-product', (req, res) => {
  res.render('admin/add-product');
});
router.get('/about', (req, res) => {
  res.render('about');  // assuming the file is views/about.ejs
});

router.get('/view-products', (req, res) => {
  res.render('admin/view-products');
});


// Dummy update function (you can replace it with actual DB update functionality)
const updateProductInDB = async (id, updatedData) => {
  console.log(`Updated Product ${id}:`, updatedData);
};
// Route to display all products in product-list page



router.get('/product-list/:id', async (req, res) => {
  const productId = req.params.id;

  try {
    const product = await getProductById(productId); // Fetch product by ID from the DB
    if (product) {
      res.render('admin/product-list', { product }); // Render the correct view for a single product
    } else {
      res.status(404).send('Product not found');
    }
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});





module.exports = router;
