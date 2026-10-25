const { Router } = require('express');
const alerts = require('../controllers/alertsController');

const router = Router();

router.get('/', alerts.listAlerts);
router.get('/summary', alerts.getSummary);
router.post('/report', alerts.emailReport);
router.get('/:id', alerts.getAlert);
router.patch('/:id/resolve', alerts.resolveAlert);

module.exports = router;
