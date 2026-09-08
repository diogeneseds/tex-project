import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const exportPostsDir = path.join(rootDir, 'tecextreme-migracao-wordpress', 'posts');
const exportPagesDir = path.join(rootDir, 'tecextreme-migracao-wordpress', 'pages');

const contentBlogDir = path.join(rootDir, 'src', 'content', 'blog');
const assetsBlogDir = path.join(rootDir, 'src', 'assets', 'blog');

// Ensure target directories exist
fs.mkdirSync(contentBlogDir, { recursive: true });
fs.mkdirSync(assetsBlogDir, { recursive: true });

// Step 2: Movimentação de Mídia (Assets)
console.log('--- Step 2: Movendo Mídia para src/assets/blog/ ---');
const postImagesDir = path.join(exportPostsDir, 'images');
const pageImagesDir = path.join(exportPagesDir, 'images');

let copiedImagesCount = 0;

function copyImagesFrom(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const srcPath = path.join(dir, file);
    if (fs.statSync(srcPath).isFile()) {
      const destPath = path.join(assetsBlogDir, file);
      fs.copyFileSync(srcPath, destPath);
      copiedImagesCount++;
    }
  });
}

copyImagesFrom(postImagesDir);
copyImagesFrom(pageImagesDir);
console.log(`Total de ${copiedImagesCount} imagens copiadas com sucesso para src/assets/blog/`);

// Category mapping helper
const categoryMap = {
  'dicas-e-tutoriais': 'Dicas e Tutoriais',
  'computadores-e-hardware': 'Computadores e Hardware',
  'apps-e-software': 'Apps e Software',
  'inteligencia-artificial': 'Inteligência Artificial',
  'games-jogos': 'Jogos',
  'jogos': 'Jogos',
  'review': 'Review',
  'blog': 'Dicas e Tutoriais'
};

// Clean item helper
function cleanItem(str) {
  if (!str) return '';
  return str
    .replace(/^\s*-\s*/, '')
    .replace(/^["'\\]+|["'\\]+$/g, '')
    .replace(/^"+|"+$/g, '')
    .trim();
}

// Step 1, 3 & 4: Process Markdown files
console.log('--- Step 1, 3 & 4: Processando e Movendo Arquivos Markdown ---');

const mdFiles = fs.readdirSync(exportPostsDir).filter(f => f.endsWith('.md'));

let processedFilesCount = 0;

mdFiles.forEach(file => {
  const srcMdPath = path.join(exportPostsDir, file);
  const destMdPath = path.join(contentBlogDir, file);
  
  let content = fs.readFileSync(srcMdPath, 'utf8');

  // Parse frontmatter
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (fmMatch) {
    const rawFm = fmMatch[1];
    let body = content.slice(fmMatch[0].length);

    // Extract values
    let title = '';
    let date = '';
    let categories = [];
    let tags = [];
    let coverImage = '';

    // Title
    const titleMatch = rawFm.match(/^title:\s*(.*)$/m);
    if (titleMatch) title = cleanItem(titleMatch[1]);

    // Date / pubDate
    const dateMatch = rawFm.match(/^(?:date|pubDate):\s*(.*)$/m);
    if (dateMatch) date = cleanItem(dateMatch[1]);

    // Cover image (coverImage, heroImage, image, cover, thumbnail)
    const imgMatch = rawFm.match(/^(?:coverImage|heroImage|image|cover|thumbnail):\s*(.*)$/m);
    if (imgMatch) {
      coverImage = cleanItem(imgMatch[1]);
    }

    // Categories
    const catSectionMatch = rawFm.match(/categories:\s*\r?\n([\s\S]*?)(?=\r?\n[a-zA-Z0-9_]+:|\r?\n---|$)/);
    if (catSectionMatch) {
      const catLines = catSectionMatch[1].split('\n');
      catLines.forEach(l => {
        const cleaned = cleanItem(l);
        if (cleaned) categories.push(cleaned);
      });
    }

    // Tags
    const tagsSectionMatch = rawFm.match(/tags:\s*\r?\n([\s\S]*?)(?=\r?\n[a-zA-Z0-9_]+:|\r?\n---|$)/);
    if (tagsSectionMatch) {
      const tagLines = tagsSectionMatch[1].split('\n');
      tagLines.forEach(l => {
        const cleaned = cleanItem(l);
        if (cleaned) tags.push(cleaned);
      });
    }

    // Format relative image path for frontmatter (Step 3: ../../assets/blog/nome-da-foto.jpg)
    let heroImagePath = '';
    if (coverImage) {
      const imgFileName = path.basename(coverImage);
      heroImagePath = `../../assets/blog/${imgFileName}`;
    }

    // Format category
    const rawCategory = categories[0] || 'Dicas e Tutoriais';
    const mappedCategory = categoryMap[rawCategory.toLowerCase()] || rawCategory;

    // Generate description if missing
    const cleanBodyText = body
      .replace(/#+.*?\n/g, '')
      .replace(/!\[[\s\S]*?\]\(.*?\)/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .trim();
    const firstPara = cleanBodyText.split(/\n\s*\n/)[0] || '';
    const description = firstPara.slice(0, 160).replace(/\s+/g, ' ').trim() + (firstPara.length > 160 ? '...' : '');

    // Build new clean Frontmatter
    let newFm = `---\n`;
    newFm += `title: "${title.replace(/"/g, '\\"')}"\n`;
    newFm += `description: "${description.replace(/"/g, '\\"')}"\n`;
    newFm += `pubDate: ${date}\n`;
    if (mappedCategory) {
      newFm += `category: "${mappedCategory}"\n`;
    }
    if (tags.length > 0) {
      newFm += `tags:\n` + tags.map(t => `  - "${t.replace(/"/g, '\\"')}"`).join('\n') + `\n`;
    }
    if (heroImagePath) {
      newFm += `heroImage: "${heroImagePath}"\n`;
    }
    newFm += `author: "Equipe TecExtreme"\n`;
    newFm += `---\n`;

    // Step 4: Atualização do Corpo do Texto
    // Markdown images: ![alt](url) -> ![alt](../../assets/blog/filename)
    body = body.replace(/!\[([\s\S]*?)\]\((.*?)\)/g, (fullMatch, altText, url) => {
      const imgFileName = path.basename(url.trim());
      return `![${altText}](../../assets/blog/${imgFileName})`;
    });

    // HTML img tags: <img ... src="url" ...> -> <img ... src="../../assets/blog/filename" ...>
    body = body.replace(/<img\s+([^>]*?)src=["']([^"']+)["']([^>]*?)>/gi, (fullMatch, before, url, after) => {
      const imgFileName = path.basename(url.trim());
      return `<img ${before}src="../../assets/blog/${imgFileName}"${after}>`;
    });

    content = newFm + '\n' + body.trim() + '\n';
  }

  fs.writeFileSync(destMdPath, content, 'utf8');
  processedFilesCount++;
});

console.log(`Total de ${processedFilesCount} arquivos .md migrados para src/content/blog/`);
console.log('--- Migração concluída com sucesso! ---');
