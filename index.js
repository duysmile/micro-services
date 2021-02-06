const express = require('express');

const port = process.env.PORT || 3000;
const app = express();

const service = process.env.SERVICE_NAME || `service-${port}`;

app.get('/health-check', (req, res) => res.send('OK'));

app.get(`/service-${port}`, (req, res, next) => {
    res.json({
        data: `service-${port}`,
    });
});

app.listen(port, () => console.log(`Service ${service} started at port $port`));
