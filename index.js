require('dotenv').config();
const initJaegerTracer = require('jaeger-client').initTracer;
const express = require('express');

const port = process.env.PORT || 3000;
const app = express();
const serviceName = process.env.SERVICE_NAME || `service-${port}`;

// Initialize the Tracer
const tracer = initTracer(serviceName);
const openTracing = require('opentracing');
openTracing.initGlobalTracer(tracer);

function initTracer(serviceName) {
    const config = {
        serviceName,
        sampler: { type: 'const', param: 1 },
        reporter: {
            // Provide the traces endpoint; this forces the client to connect directly to the Collector and send
            // spans over HTTP
            collectorEndpoint: 'http://localhost:14268/api/traces',
            // Provide username and password if authentication is enabled in the Collector
            // username: '',
            // password: '',
        },
    };

    return initJaegerTracer(config);
}

function tracingMiddleware(req, res, next) {
    // const tracer = openTracing.globalTracer();
    const writeCtx = tracer.extract(openTracing.FORMAT_HTTP_HEADERS, req.headers);
    const span = tracer.startSpan(req.path, { childOf: writeCtx });

    span.log({ event: 'request_received' });

    span.setTag(openTracing.Tags.HTTP_METHOD, req.method);
    span.setTag(openTracing.Tags.HTTP_URL, req.path);
    span.setTag(openTracing.Tags.SPAN_KIND, openTracing.Tags.SPAN_KIND_RPC_SERVER);

    const responseHeaders = {};
    tracer.inject(span, openTracing.FORMAT_HTTP_HEADERS, responseHeaders);
    res.set(responseHeaders);

    Object.assign(req, { span });
    const finishSpan = () => {
        if (res.statusCode >= 500) {
            span.setTag(openTracing.Tags.SAMPLING_PRIORITY, 1);
            span.setTag(openTracing.Tags.ERROR, true);
            span.log({ event: 'error', message: res.statusMessage });
        }

        span.setTag(openTracing.Tags.HTTP_STATUS_CODE, res.statusCode);
        span.log({ event: 'request_end' });
        span.finish();
    };

    res.on('finish', finishSpan);
    next();
}

app.use(tracingMiddleware);
app.get('/health-check', (req, res) => res.send('OK'));

app.get(`/service-${port}`, (req, res, next) => {
    res.json({
        data: `service-${port}`,
    });
});

app.listen(port, () => console.log(`Service ${serviceName} started at port ${port}`));
