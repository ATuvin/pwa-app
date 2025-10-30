// Скрипт для подготовки к деплою на GitHub Pages
// Копирует index.html в 404.html для поддержки SPA роутинга
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

const distPath = join(process.cwd(), 'dist');

try {
  // Копируем index.html в 404.html для GitHub Pages SPA support
  const indexHtml = readFileSync(join(distPath, 'index.html'), 'utf-8');
  writeFileSync(join(distPath, '404.html'), indexHtml);
  
  // Создаем .nojekyll файл, чтобы GitHub Pages не использовал Jekyll
  writeFileSync(join(distPath, '.nojekyll'), '');
  
  console.log('✅ GitHub Pages подготовка завершена:');
  console.log('   - Создан 404.html для SPA роутинга');
  console.log('   - Создан .nojekyll файл');
} catch (error) {
  console.error('❌ Ошибка при подготовке к деплою:', error.message);
  process.exit(1);
}

