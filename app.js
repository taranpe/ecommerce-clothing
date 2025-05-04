const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt  = require('bcryptjs');  
const dotenv = require('dotenv');
const db = require('./config/db');
const multer = require('multer');
const fs = require('fs');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

// Load environment variables
dotenv.config();

const app = express();

// Session Store using MySQL
const sessionStore = new MySQLStore({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '1234',
    database: 'ecommerce_db'
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Session Configuration
app.use(session({
    secret: 'taran1234',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 // 1 day
    }
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Create uploads folder if not exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// ----------------- ROUTES -----------------

// Home Page
app.get('/', async (req, res) => {
    try {
        const [products] = await db.query('SELECT * FROM products');
        res.render('index', { products });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).send('Database error');
    }
});

// Add Product (GET)
app.get('/admin/add-product', (req, res) => {
    res.render('admin/add-product');
});

// Add Product (POST)
app.post('/admin/add-product', upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 5 }
]), async (req, res) => {
    try {
        const {
            name, brand, description, price, discountPrice, stock,
            category, subcategory, material, color, sizes,
            tags, featured, status
        } = req.body;

        const mainImage = req.files.mainImage?.[0].filename || null;
        const additionalImages = req.files.additionalImages?.map(file => file.filename).join(',') || '';
        const createdAt = new Date();

        await db.query(`
            INSERT INTO products (
                name, brand, description, price, discountPrice, stock,
                category, subcategory, material, color, sizes,
                mainImage, additionalImages, tags, featured, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, brand, description, price, discountPrice, stock,
                category, subcategory, material, color, sizes,
                mainImage, additionalImages, tags, featured, status, createdAt
            ]
        );

        res.redirect('/');
    } catch (err) {
        console.error('Error adding product:', err);
        res.status(500).send('Database error');
    }
});

// View Products
app.get('/admin/view-products', async (req, res) => {
    try {
        const [products] = await db.query('SELECT * FROM products');
        res.render('admin/view-products', { products });
    } catch (err) {
        console.error('Error fetching products:', err);
        res.status(500).send('Server error');
    }
});

// Edit Product (GET)
app.get('/admin/edit-product/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const [product] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product.length) return res.status(404).send('Product not found');
        res.render('admin/edit-product', { product: product[0] });
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).send('Database error');
    }
});

// Edit Product (POST)
app.post('/admin/edit-product/:id', upload.fields([
    { name: 'mainImage', maxCount: 1 },
    { name: 'additionalImages', maxCount: 5 }
]), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, brand, description, price, discountPrice, stock,
            category, subcategory, material, color, sizes,
            tags, featured, status
        } = req.body;

        const [product] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
        if (!product.length) return res.status(404).send('Product not found');

        const mainImage = req.files.mainImage?.[0].filename || product[0].mainImage;
        const additionalImages = req.files.additionalImages?.map(file => file.filename).join(',') || product[0].additionalImages;

        await db.query(`
            UPDATE products SET
                name = ?, brand = ?, description = ?, price = ?, discountPrice = ?, stock = ?,
                category = ?, subcategory = ?, material = ?, color = ?, sizes = ?,
                mainImage = ?, additionalImages = ?, tags = ?, featured = ?, status = ?
            WHERE id = ?`,
            [
                name, brand, description, price, discountPrice, stock,
                category, subcategory, material, color, sizes,
                mainImage, additionalImages, tags, featured, status, id
            ]
        );

        res.redirect('/admin/view-products');
    } catch (err) {
        console.error('Error updating product:', err);
        res.status(500).send('Database error');
    }
});

// Delete Product
app.post('/admin/view-products/delete/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const [result] = await db.query('DELETE FROM products WHERE id = ?', [productId]);
        if (result.affectedRows > 0) {
            res.redirect('/admin/view-products');
        } else {
            res.status(404).send('Product not found');
        }
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).send('Internal server error');
    }
});

// Add to Cart
app.post('/add-to-cart/:id', async (req, res) => {
    const productId = parseInt(req.params.id);
    let cart = req.session.cart || [];

    const existingItem = cart.find(item => item.id === productId);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        const product = await getProductById(productId);
        if (product) cart.push({ ...product, quantity: 1 });
    }

    req.session.cart = cart;
    res.redirect('/cart');
});

// View Cart
app.get('/cart', (req, res) => {
    const cart = req.session.cart || [];

    let grandTotal = 0;
    const updatedCart = cart.map(item => {
        const total = item.price * item.quantity;
        grandTotal += total;
        return { ...item, total };
    });

    res.render('cart', { cart: updatedCart, grandTotal });
});

// Remove from Cart
app.post('/remove-from-cart/:id', (req, res) => {
    const productId = parseInt(req.params.id);
    req.session.cart = (req.session.cart || []).filter(item => item.id !== productId);
    res.redirect('/cart');
});

// Helper: Get Product By ID
const getProductById = async (id) => {
    try {
        const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
        return rows.length ? rows[0] : null;
    } catch (error) {
        console.error('Error fetching product:', error);
        return null;
    }
};


// Product Detail Page
app.get('/product-list/:id', async (req, res) => {
    const productId = req.params.id;
    try {
        const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [productId]);
        if (!rows.length) {
            return res.status(404).send('Product not found');
        }
        const product = rows[0];
        res.render('product-list', { product });
    } catch (err) {
        console.error('Error fetching product:', err);
        res.status(500).send('Database error');
    }
});

// Route for Index Page (Homepage)
// app.get('/', async (req, res) => {
//     try {
//       // Fetch only the first 8 products
//       const products = await Product.find().limit(6); // Adjust according to your DB query method
//       res.render('index', { products });
//     } catch (error) {
//       console.error(error);
//       res.status(500).send('Error fetching products');
//     }
//   });

app.get('/all-products', async (req, res) => {
    try {
      const [products] = await db.query('SELECT * FROM products'); // your actual table name
      res.render('all-product', { products });
    } catch (error) {
      console.error('Error fetching products:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  app.get('/checkout', (req, res) => {
    const cart = req.session.cart || [];
    res.render('checkout', { cart });
  });
  
  const router = express.Router();

  app.post('/place-order', async (req, res) => {
    const { name, address, payment } = req.body;
    const cart = req.session.cart || [];

    const totalAmount = cart.reduce((total, item) => total + item.price * item.quantity, 0);

    try {
        // Insert into orders table
        const [orderResult] = await db.query(
            "INSERT INTO orders (name, address, payment_method, total_amount) VALUES (?, ?, ?, ?)",
            [name, address, payment, totalAmount]
        );

        // Clear cart after order placed
        req.session.cart = [];

        // Render confirmation page
        res.render('place-order', {
            orderId: orderResult.insertId,
            name,
            totalAmount
        });
    } catch (err) {
        console.error("Order placing failed:", err);
        res.status(500).send("Failed to place order.");
    }
});
app.get('/admin/orderList', async (req, res) => {
    try {
      const [orders] = await db.query('SELECT * FROM orders');
      res.render('admin/orderList', { orders });
    } catch (err) {
      console.error('Error fetching orders:', err);
      res.status(500).send('Internal Server Error');
    }
  });
 
  

  
  app.get('/search', async (req, res) => {
    const query = req.query.q;
    try {
        const [results] = await db.query('SELECT * FROM products WHERE name LIKE ?', [`%${query}%`]);
        res.render("search", {
            keyword: query,
            products: results
        });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).send('Search failed.');
    }
});
app.get('/about', (req, res) => {
    res.render('about'); // Ensure you have views/contact.ejs
  });
  app.get('/contact', (req, res) => {
    const success = req.query.success;
    res.render('contact', { success });
  });
  
  // POST contact form
app.post('/contact', async (req, res) => {
    try {
      const { name, email, message } = req.body;
      const sql = 'INSERT INTO contact (name, email, message) VALUES (?, ?, ?)';
      await db.execute(sql, [name, email, message]);
      res.redirect('/contact?success=1');
    } catch (error) {
      console.error('DB Insert Error:', error);
      res.status(500).send('Something went wrong');
    }
  });
  

  app.get('/signup', (req, res) => {
    res.render('signup', { error: null, success: null });
  });
  
  // Handle signup form submission
  app.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
  
    try {
      const [existingUser] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  
      if (existingUser.length > 0) {
        return res.render('signup', { error: 'Email already registered', success: null });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
  
      await db.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [
        name,
        email,
        hashedPassword
      ]);
  
      res.render('signup', { error: null, success: 'Registration successful. You can now log in.' });
    } catch (err) {
      console.error(err);
      res.render('signup', { error: 'Something went wrong. Try again.', success: null });
    }
  });
  
  // Render login page
  app.get('/login', (req, res) => {
    res.render('login', { error: null }); // default error null
  });
  
  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
  
    try {
      const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  
      if (rows.length === 0) {
        return res.render('login', { error: 'Invalid email or password' });
      }
  
      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        return res.render('login', { error: 'Invalid email or password' });
      }
  
      // Store user info in session and redirect
      req.session.user = user;
      return res.redirect('/');
    } catch (err) {
      console.error(err);
      return res.render('login', { error: 'Server error. Please try again later.' });
    }
  });
  
  
  
  // Pagination and filter route

// External Routes
const adminRoutes = require('./routes/adminRoutes');
const orderRoutes = require('./routes/orderRoutes');
app.use('/admin', adminRoutes);
app.use('/orders', orderRoutes);

// Server Start
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
