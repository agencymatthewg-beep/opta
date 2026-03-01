import { runSoak } from './load-generator.js';

async function main() {
  console.log('Running soak test against http://127.0.0.1:10000/health ...');
  const result = await runSoak({
    concurrency: 50,
    durationMs: 10000,
    requestFn: async () => {
      const res = await fetch('http://127.0.0.1:10000/health');
      if (!res.ok) throw new Error(`Daemon health check failed: ${res.status}`);
    }
  });
  
  console.log('--- SOAK TEST RESULTS ---');
  console.log(`Total Requests: ${result.totalRequests}`);
  console.log(`Errors: ${result.errors}`);
  console.log(`p50 Latency: ${result.p50Ms}ms`);
  console.log(`p99 Latency: ${result.p99Ms}ms`);
  console.log(`Throughput: ${result.throughputRps.toFixed(2)} req/sec`);
}

main().catch(console.error);