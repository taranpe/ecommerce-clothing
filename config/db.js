// config/db.js
const mysql = require('mysql2');

// Create a MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1234',  // Replace with your database password
    database: 'ecommerce_db'  // Replace with your database name
});

module.exports = pool.promise();
