import run, { options as normalOptions } from './slo-test.js';

// Keep the other SLOs identical; only report latency is deliberately impossible.
export const options = {
  ...normalOptions,
  thresholds: {
    ...normalOptions.thresholds,
    'http_req_duration{name:report}': ['p(95)<100'],
  },
};

export default run;
