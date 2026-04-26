import { EkmekDB, JsonAdapter, MemoryAdapter } from './src/index';

async function runTests() {
  const jsonAdapter = new JsonAdapter({ folder: 'test-database', file: 'test.json' });
  const db = new EkmekDB(jsonAdapter);

  await db.clear();

  await db.set('server.name', 'Ekmek Roleplay');
  await db.set('server.economy.bank', 5000);
  
  await db.add('server.economy.bank', 2500);
  await db.subtract('server.economy.bank', 1000);

  await db.push('players', { id: 1, username: 'Admin', level: 100 });
  await db.push('players', { id: 2, username: 'Moderator', level: 50 });
  await db.push('players', { id: 3, username: 'User', level: 10 });
  await db.push('players', { id: 4, username: 'Spammer', level: 1 });

  await db.pull('players', (player: any) => player.username === 'Spammer');

  await db.setByPriority('players', { id: 5, username: 'Co-Owner', level: 90 }, 2);

  await db.delByPriority('players', 4);

  const adminPlayer = await db.find('players', (p: any) => p.level === 100);
  
  const highLevelPlayers = await db.filter('players', (p: any) => p.level >= 50);

  const allData = await db.all();

  console.log(allData);
  console.log(adminPlayer);
  console.log(highLevelPlayers);

  process.exit(0);
}

runTests();