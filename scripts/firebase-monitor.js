/**
 * Firebase Reads Monitor - Paste in Browser Console
 *
 * Usage:
 * 1. Copy this entire script
 * 2. Paste in browser console (F12)
 * 3. Navigate through the app
 * 4. Run: firestoreMonitor.report()
 * 5. Run: firestoreMonitor.reset() to start fresh
 */

(function() {
  // Don't reinitialize if already exists
  if (window.firestoreMonitor) {
    console.log('%c[Monitor]%c Already initialized. Use firestoreMonitor.report() or firestoreMonitor.reset()',
      'background:#2196F3;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
      'color:#2196F3;font-weight:600'
    );
    return;
  }

  window.firestoreMonitor = {
    startTime: Date.now(),
    operations: [],

    // Totals
    totalReads: 0,
    totalCacheHits: 0,

    // By type
    byOperation: {},
    byCollection: {},

    // Track individual operations
    track(type, collection, count, timeMs) {
      const op = {
        type,
        collection,
        count,
        timeMs,
        timestamp: Date.now()
      };

      this.operations.push(op);

      if (type === 'cache-hit') {
        this.totalCacheHits++;
      } else {
        this.totalReads += count;
        this.byOperation[type] = (this.byOperation[type] || 0) + count;
        this.byCollection[collection] = (this.byCollection[collection] || 0) + count;
      }
    },

    // Generate report
    report() {
      const elapsed = Math.round((Date.now() - this.startTime) / 1000);

      console.log('%c╔═══════════════════════════════════════════════════════╗', 'color:#4CAF50;font-weight:bold');
      console.log('%c║       FIREBASE READS MONITORING REPORT              ║', 'color:#4CAF50;font-weight:bold');
      console.log('%c╚═══════════════════════════════════════════════════════╝', 'color:#4CAF50;font-weight:bold');
      console.log('');

      console.log('%c📊 SUMMARY', 'font-size:14px;font-weight:bold;color:#2196F3');
      console.log(`  Session Duration: ${elapsed}s`);
      console.log(`  Total Document Reads: %c${this.totalReads}`, 'color:#4CAF50;font-weight:bold');
      console.log(`  Cache Hits: %c${this.totalCacheHits}`, 'color:#FF9800;font-weight:bold');
      console.log(`  Total Operations: ${this.operations.length}`);
      console.log('');

      // By operation type
      if (Object.keys(this.byOperation).length > 0) {
        console.log('%c🔧 BY OPERATION TYPE', 'font-size:14px;font-weight:bold;color:#2196F3');
        Object.entries(this.byOperation)
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            const bar = '█'.repeat(Math.ceil((count / this.totalReads) * 20));
            console.log(`  ${type.padEnd(15)} %c${count.toString().padStart(4)} reads%c ${bar}`,
              'color:#4CAF50;font-weight:bold',
              'color:#888'
            );
          });
        console.log('');
      }

      // By collection
      if (Object.keys(this.byCollection).length > 0) {
        console.log('%c📁 BY COLLECTION', 'font-size:14px;font-weight:bold;color:#2196F3');
        Object.entries(this.byCollection)
          .sort((a, b) => b[1] - a[1])
          .forEach(([collection, count]) => {
            const bar = '█'.repeat(Math.ceil((count / this.totalReads) * 20));
            console.log(`  ${collection.padEnd(15)} %c${count.toString().padStart(4)} reads%c ${bar}`,
              'color:#4CAF50;font-weight:bold',
              'color:#888'
            );
          });
        console.log('');
      }

      // Recent operations (last 10)
      if (this.operations.length > 0) {
        console.log('%c⏱️  RECENT OPERATIONS (last 10)', 'font-size:14px;font-weight:bold;color:#2196F3');
        this.operations.slice(-10).forEach(op => {
          const icon = op.type === 'cache-hit' ? '💾' : '📖';
          const color = op.type === 'cache-hit' ? '#FF9800' : '#4CAF50';
          console.log(`  ${icon} %c${op.type.padEnd(12)}%c ${op.collection.padEnd(15)} ${op.count} docs · ${op.timeMs}ms`,
            `color:${color};font-weight:bold`,
            'color:#888'
          );
        });
        console.log('');
      }

      // Cost estimation (Firebase Spark plan: $0.06 per 100K reads)
      const estimatedCost = (this.totalReads / 100000) * 0.06;
      console.log('%c💰 ESTIMATED COST (Spark Plan)', 'font-size:14px;font-weight:bold;color:#2196F3');
      console.log(`  ${this.totalReads} reads × $0.06/100K = $${estimatedCost.toFixed(6)}`);
      console.log('');

      // Optimization tips
      if (this.totalReads > 100) {
        console.log('%c⚠️  OPTIMIZATION TIPS', 'font-size:14px;font-weight:bold;color:#FF5722');
        if (this.byOperation.getAll > 50) {
          console.log('  • Consider using pagination instead of getAll()');
        }
        if (this.totalCacheHits === 0 && this.operations.length > 10) {
          console.log('  • Implement caching to reduce repeated reads');
        }
        if (this.byOperation.query > 30) {
          console.log('  • Use getCount() for metrics instead of querying all docs');
        }
        console.log('');
      } else if (this.totalReads < 50) {
        console.log('%c✅ EXCELLENT! Reads are well optimized', 'font-size:14px;font-weight:bold;color:#4CAF50');
        console.log('');
      }

      console.log('%c─────────────────────────────────────────────────────────', 'color:#888');
      console.log('Run %cfirestoreMonitor.reset()%c to start a new session', 'color:#2196F3;font-weight:bold', 'color:inherit');
      console.log('Run %cfirestoreMonitor.detail()%c to see all operations', 'color:#2196F3;font-weight:bold', 'color:inherit');
    },

    // Show detailed log of all operations
    detail() {
      console.table(this.operations.map(op => ({
        Type: op.type,
        Collection: op.collection,
        Reads: op.count,
        'Time (ms)': op.timeMs,
        'Timestamp': new Date(op.timestamp).toLocaleTimeString()
      })));
    },

    // Reset counters
    reset() {
      this.startTime = Date.now();
      this.operations = [];
      this.totalReads = 0;
      this.totalCacheHits = 0;
      this.byOperation = {};
      this.byCollection = {};
      console.log('%c[Monitor]%c Reset complete. Starting fresh session.',
        'background:#4CAF50;color:#fff;padding:2px 6px;border-radius:3px;font-weight:600',
        'color:#4CAF50;font-weight:600'
      );
    },

    // Export data as JSON
    export() {
      const data = {
        startTime: this.startTime,
        endTime: Date.now(),
        duration: Date.now() - this.startTime,
        totalReads: this.totalReads,
        totalCacheHits: this.totalCacheHits,
        byOperation: this.byOperation,
        byCollection: this.byCollection,
        operations: this.operations
      };

      const json = JSON.stringify(data, null, 2);
      console.log('Copy this JSON to save the report:');
      console.log(json);

      // Try to copy to clipboard
      if (navigator.clipboard) {
        navigator.clipboard.writeText(json).then(() => {
          console.log('%c✅ Copied to clipboard!', 'color:#4CAF50;font-weight:bold');
        });
      }

      return data;
    }
  };

  // Intercept console.log to track Firestore operations
  const originalLog = console.log;
  console.log = function(...args) {
    // Check if this is a Firestore log
    if (args[0] && typeof args[0] === 'string' && args[0].includes('[Firestore]')) {
      const message = args[1] || '';

      // Parse operation type
      let type = 'unknown';
      if (message.includes('getAll')) type = 'getAll';
      else if (message.includes('getById')) type = 'getById';
      else if (message.includes('query')) type = 'query';
      else if (message.includes('paginated')) type = 'paginated';
      else if (message.includes('count')) type = 'count';

      // Parse collection name
      const collectionMatch = message.match(/\(([^)]+)\)/);
      const collection = collectionMatch ? collectionMatch[1].split(' ')[0] : 'unknown';

      // Parse doc count
      const countMatch = message.match(/→ (\d+)/);
      const count = countMatch ? parseInt(countMatch[1]) : 0;

      // Parse time
      const timeMatch = message.match(/(\d+)ms/);
      const timeMs = timeMatch ? parseInt(timeMatch[1]) : 0;

      // Track it
      if (type !== 'count') { // count operations are free
        window.firestoreMonitor.track(type, collection, count, timeMs);
      } else {
        window.firestoreMonitor.track('count', collection, 0, timeMs);
      }
    }

    // Check for cache hits
    if (args[0] && typeof args[0] === 'string' && args[0].includes('[Cache]')) {
      const message = args[1] || '';
      const collectionMatch = message.match(/\(([^)]+)\)/);
      const collection = collectionMatch ? collectionMatch[1] : 'unknown';
      window.firestoreMonitor.track('cache-hit', collection, 0, 0);
    }

    // Call original
    return originalLog.apply(console, args);
  };

  console.log('%c╔═══════════════════════════════════════════════════════╗', 'color:#4CAF50;font-weight:bold');
  console.log('%c║     🔥 FIREBASE READS MONITOR INITIALIZED 🔥        ║', 'color:#4CAF50;font-weight:bold');
  console.log('%c╚═══════════════════════════════════════════════════════╝', 'color:#4CAF50;font-weight:bold');
  console.log('');
  console.log('Available commands:');
  console.log('  %cfirestoreMonitor.report()%c   - Show summary report', 'color:#2196F3;font-weight:bold', 'color:inherit');
  console.log('  %cfirestoreMonitor.detail()%c   - Show all operations', 'color:#2196F3;font-weight:bold', 'color:inherit');
  console.log('  %cfirestoreMonitor.reset()%c    - Reset counters', 'color:#2196F3;font-weight:bold', 'color:inherit');
  console.log('  %cfirestoreMonitor.export()%c   - Export as JSON', 'color:#2196F3;font-weight:bold', 'color:inherit');
  console.log('');
  console.log('Monitor is now tracking all Firebase operations...');
})();
