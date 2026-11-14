const express = require('express');
const router = express.Router();
const multer = require('multer');
const excelImportController = require('../controllers/excelImportController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Configure multer for file upload (in-memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      const err = new Error('Only Excel files are allowed');
      err.statusCode = 400;
      cb(err);
    }
  },
});

// Excel import routes
router.get('/template', authenticate, isAdmin, excelImportController.downloadTemplate);
router.post('/preview', authenticate, isAdmin, upload.single('file'), excelImportController.previewImport);
router.post('/confirm', authenticate, isAdmin, excelImportController.confirmImport);

// Teacher import routes
router.get('/teachers/template', authenticate, isAdmin, excelImportController.downloadTeacherTemplate);
router.post('/teachers/preview', authenticate, isAdmin, upload.single('file'), excelImportController.previewTeacherImport);
router.post('/teachers/confirm', authenticate, isAdmin, excelImportController.confirmTeacherImport);

module.exports = router;
