#!/usr/bin/env tsx
/**
 * Health check CLI utility.
 * Usage: pnpm health or node dist/health-check.js [liveness|readiness]
 */

import { getHealthStatus, getLivenessStatus } from '../src/health';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkType = args[0]?.toLowerCase() || 'full';

  try {
    let status: any;

    if (checkType === 'liveness') {
      // Import dynamically to avoid circular dependency issues
      const module = await import('../src/health');
      status = module.getLivenessStatus();
    } else {
      status = await getHealthStatus();
    }

    console.log(JSON.stringify(status, null, 2));

    // Exit with appropriate code for Kubernetes probes
    if (status.status === 'healthy') {
      process.exit(0);
    } else if (status.status === 'degraded') {
      process.exit(1); // Degraded but running
    } else {
      process.exit(2); // Unhealthy
    }
  } catch (error) {
    console.error('Health check failed:', error instanceof Error ? error.message : String(error));
    process.exit(3);
  }
}

main();
