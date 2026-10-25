const { Router } = require('express');
const { submitResponses } = require('../controllers/monitorController');

const router = Router();

router.post('/', submitResponses);

module.exports = router;
