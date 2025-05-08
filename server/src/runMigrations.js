const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database.sqlite'),
  logging: console.log // Enable logging
});

async function runMigrations() {
  try {
    // Get all migration files
    const migrationsPath = path.join(__dirname, 'migrations');
    const migrationFiles = fs.readdirSync(migrationsPath)
      .filter(file => file.endsWith('.js'))
      .sort();

    console.log('Found migration files:', migrationFiles);

    // Run each migration
    for (const file of migrationFiles) {
      console.log(`\nRunning migration: ${file}`);
      try {
        const migration = require(path.join(migrationsPath, file));
        await migration.up(sequelize.getQueryInterface(), Sequelize);
        console.log(`Successfully completed migration: ${file}`);
      } catch (error) {
        console.error(`Error running migration ${file}:`, error);
        throw error; // Re-throw to stop the process
      }
    }

    console.log('\nAll migrations completed successfully');
  } catch (error) {
    console.error('\nError running migrations:', error);
    process.exit(1); // Exit with error code
  } finally {
    await sequelize.close();
  }
}

runMigrations(); 