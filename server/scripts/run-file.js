// Feed a static JSON file through the same pipeline the /monitor endpoint uses.
// Results are saved to MongoDB, same as with the endpoint.
// Usage: npm run monitor:file -- data/sample-responses.json

const fs = require('fs');
const path = require('path');
const { connectDb, disconnectDb } = require('../src/db');
const { processBatch } = require('../src/services/monitorService');

async function main() {
  const fileArg = process.argv[2] || 'data/sample-responses.json';
  const filePath = path.resolve(process.cwd(), fileArg);

  let entries;
  try {
    entries = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`Could not read ${filePath}: ${err.message}`);
    process.exit(1);
  }

  if (!Array.isArray(entries)) entries = [entries];

  await connectDb();
  const result = await processBatch(entries);
  await disconnectDb();

  const { opened, updated, resolved } = result.stored;
  console.log(`\nChecked ${result.received} responses: ${result.healthy} healthy, ` +
    `${result.anomalies.length} anomalies, ${result.rejected.length} rejected`);
  console.log(`Alerts: ${opened} opened, ${updated} updated, ${resolved} resolved\n`);

  for (const a of result.anomalies) {
    console.log(`[${a.severity.toUpperCase()}] ${a.api_name}`);
    a.issues.forEach((i) => console.log(`   - ${i.type}: ${i.message}`));
  }
  for (const r of result.rejected) {
    console.log(`[REJECTED] entry #${r.index}: ${r.reason}`);
  }
}

main().catch(async (err) => {
  console.error(err.message);
  await disconnectDb();
  process.exit(1);
});
