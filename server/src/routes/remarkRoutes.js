const express = require('express');
const router = express.Router();
const remarkController = require('../controllers/remarkController');
const { authenticate, authorize } = require('../middleware/auth');

const isAdminOrClassTeacher = authorize('ADMIN', 'CLASS_TEACHER');

router.get('/', authenticate, isAdminOrClassTeacher, remarkController.getSectionRemarks);
router.put('/', authenticate, isAdminOrClassTeacher, remarkController.upsertRemark);

module.exports = router;
