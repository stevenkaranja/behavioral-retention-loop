require('dotenv').config();
const express = require('express');
const logger = require('./services/logger');

const app = express();
app.use(express.json({ limit: '1mb' }));

app.use('/events',        require('./routes/events'));
app.use('/users',         require('./routes/users'));
app.use('/interventions', require('./routes/interventions'));

app.get('/health', (_, res) => res.json({ status: 'ok' }));

// Start workers
require('./agents/monitor');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));
