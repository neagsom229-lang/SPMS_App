// backend/routes/warranty.js
const express = require("express");
const db = require("../config/database");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// GET /api/warranty - all warranty records with product name
router.get("/", (req, res) => {
  const rows = db
    .prepare(
      `SELECT w.*, p.NAME_EN AS productName
       FROM Tbl_Warranty w
       LEFT JOIN TBL_PRODUCTS p ON p.ID = w.ProductID
       ORDER BY w.WarrantyID DESC`
    )
    .all();
  res.json(rows);
});

// GET /api/warranty/service - all service requests with product name
router.get("/service", (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.*, p.NAME_EN AS productName
       FROM Tbl_Service_Requests s
       LEFT JOIN TBL_PRODUCTS p ON p.ID = s.ProductID
       ORDER BY s.ServiceID DESC`
    )
    .all();
  res.json(rows);
});

// PATCH /api/warranty/service/:id/status
router.patch("/service/:id/status", (req, res) => {
  const { status } = req.body;
  const valid = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `Status must be one of ${valid.join(", ")}` });
  }
  const existing = db.prepare(`SELECT * FROM Tbl_Service_Requests WHERE ServiceID = ?`).get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Service request not found" });

  const completedAt = status === "COMPLETED" ? `datetime('now')` : "NULL";
  db.prepare(
    `UPDATE Tbl_Service_Requests SET Status = ?, UpdatedAt = datetime('now'),
     CompletedDate = ${status === "COMPLETED" ? "datetime('now')" : "CompletedDate"}
     WHERE ServiceID = ?`
  ).run(status, req.params.id);

  const updated = db.prepare(`SELECT * FROM Tbl_Service_Requests WHERE ServiceID = ?`).get(req.params.id);
  res.json(updated);
});

// POST /api/warranty/service - log a new service request
router.post("/service", (req, res) => {
  const { CustomerID, ProductID, SerialNumber, IssueDescription, ServiceType } = req.body;
  if (!ProductID || !IssueDescription) {
    return res.status(400).json({ error: "ProductID and IssueDescription are required" });
  }
  const serviceNo = `SRV-${Date.now()}`;
  const info = db
    .prepare(
      `INSERT INTO Tbl_Service_Requests
        (ServiceNo, CustomerID, ProductID, SerialNumber, IssueDescription, ServiceType, Status, ReceivedDate, CreatedAt)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', datetime('now'), datetime('now'))`
    )
    .run(serviceNo, CustomerID || null, ProductID, SerialNumber || null, IssueDescription, ServiceType || "Repair");

  const created = db.prepare(`SELECT * FROM Tbl_Service_Requests WHERE ServiceID = ?`).get(info.lastInsertRowid);
  res.status(201).json(created);
});

module.exports = router;
