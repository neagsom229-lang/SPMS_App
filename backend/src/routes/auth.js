// // backend/routes/auth.js
// const express = require("express");
// const jwt = require("jsonwebtoken");
// const db = require("../config/postgres");
// const { JWT_SECRET } = require("../middleware/auth");

// const router = express.Router();

// // POST /api/auth/login
// router.post("/login", async (req, res) => {
//   const { username, password } = req.body;

//   if (!username || !password) {
//     return res.status(400).json({ error: "Username and password are required" });
//   }

//   try {
//     // PostgreSQL query with parameterized queries
//     const result = await db.query(
//       `SELECT UserID, Username, Password, FullName, Role, Status
//        FROM Tbl_Users WHERE Username = $1`,
//       [username]
//     );

//     const user = result.rows[0];

//     if (!user || user.Password !== password) {
//       return res.status(401).json({ error: "Invalid username or password" });
//     }

//     if (user.Status !== "ACTIVE") {
//       return res.status(403).json({ error: "This account is not active" });
//     }

//     const token = jwt.sign(
//       { userId: user.UserID, username: user.Username, role: user.Role },
//       JWT_SECRET,
//       { expiresIn: "8h" }
//     );

//     res.json({
//       token,
//       user: {
//         id: user.UserID,
//         username: user.Username,
//         fullName: user.FullName,
//         role: user.Role,
//       },
//     });
//   } catch (err) {
//     console.error("❌ Login error:", err.message);
//     res.status(500).json({ error: "Database error" });
//   }
// });

// // GET /api/auth/me
// router.get("/me", (req, res) => {
//   res.json({ ok: true });
// });

// module.exports = router;

// backend/src/routes/products.js
import express from 'express';
import { productController } from '../controllers/productController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticate, productController.getAll);
router.get('/:id', authenticate, productController.getOne);
router.post('/', authenticate, productController.create);
router.put('/:id', authenticate, productController.update);
router.delete('/:id', authenticate, productController.delete);
router.patch('/:id/stock', authenticate, productController.updateStock);

export default router;