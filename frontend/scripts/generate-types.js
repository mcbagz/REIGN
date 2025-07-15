#!/usr/bin/env node

/**
 * Script to generate TypeScript types from JSON schemas
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SCHEMAS_DIR = '../shared/schemas';
const OUTPUT_DIR = './src/types';
const QUICKTYPE_CMD = 'npx quicktype';

// Schema files to process
const schemas = [
  {
    file: 'tile.schema.json',
    output: 'tile.ts',
    topLevel: 'Tile'
  },
  {
    file: 'unit.schema.json',
    output: 'unit.ts',
    topLevel: 'Unit'
  },
  {
    file: 'game-state.schema.json',
    output: 'game-state.ts',
    topLevel: 'GameState'
  },
  {
    file: 'websocket-message.schema.json',
    output: 'websocket-message.ts',
    topLevel: 'WebSocketMessage'
  }
];

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate types for each schema
schemas.forEach(({ file, output, topLevel }) => {
  const schemaPath = path.join(SCHEMAS_DIR, file);
  const outputPath = path.join(OUTPUT_DIR, output);
  
  if (!fs.existsSync(schemaPath)) {
    console.warn(`⚠️  Schema file not found: ${schemaPath}`);
    return;
  }

  try {
    console.log(`🔄 Generating types for ${file}...`);
    
    // Generate TypeScript types using quicktype
    const command = `${QUICKTYPE_CMD} --src-lang schema --lang ts --top-level ${topLevel} --out ${outputPath} ${schemaPath}`;
    
    execSync(command, { stdio: 'inherit' });
    
    console.log(`✅ Generated ${output}`);
    
  } catch (error) {
    console.error(`❌ Error generating types for ${file}:`, error.message);
  }
});

// Generate index file
const indexContent = schemas
  .map(({ output, topLevel }) => {
    const moduleName = path.basename(output, '.ts');
    return `export * from './${moduleName}';`;
  })
  .join('\n');

fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent + '\n');

console.log(`📝 Generated index.ts`);
console.log(`🎉 Type generation complete!`); 