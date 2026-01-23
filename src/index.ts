#!/usr/bin/env node
import { convertWordPressToMarkdown } from './converter.js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Sanitizes a path component to prevent path traversal attacks
 */
function sanitizePath(userPath: string): string {
  // Normalize the path and remove any parent directory references
  const normalized = path.normalize(userPath).replace(/^(\.\.(\/|\\|$))+/, '');

  // Ensure the path doesn't start with a separator (absolute path)
  return normalized.replace(/^[\/\\]+/, '');
}

/**
 * Sanitizes a filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  // Remove any path separators and parent directory references
  return path.basename(filename);
}

interface CliOptions {
  output: string;
  downloadImages: boolean;
  help: boolean;
}

function parseArgs(args: string[]): { files: string[]; options: CliOptions } {
  const options: CliOptions = {
    output: './output',
    downloadImages: true,
    help: false,
  };
  const files: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--output' || arg === '-o') {
      options.output = args[++i];
    } else if (arg === '--no-images') {
      options.downloadImages = false;
    } else if (!arg.startsWith('-')) {
      files.push(arg);
    }
  }

  return { files, options };
}

function showHelp() {
  console.log(`
wp2md - Convert WordPress Block Editor HTML to clean Markdown

Usage:
  npx wp2md [files...] [options]

Examples:
  npx wp2md                    # Convert all .html files in current directory
  npx wp2md file.html          # Convert specific file
  npx wp2md *.html             # Convert multiple files
  npx wp2md -o dist            # Custom output directory

Options:
  -o, --output <dir>           Output directory (default: ./output)
  --no-images                  Skip downloading images
  -h, --help                   Show this help message
`);
}

async function main() {
  const { files, options } = parseArgs(process.argv.slice(2));

  if (options.help) {
    showHelp();
    return;
  }

  const inputDir = process.cwd();
  const sanitizedOutput = sanitizePath(options.output);
  const outputDir = path.resolve(inputDir, sanitizedOutput);
  const imagesDir = path.join(outputDir, 'images');

  // Create output directories
  await fs.mkdir(outputDir, { recursive: true });
  if (options.downloadImages) {
    await fs.mkdir(imagesDir, { recursive: true });
  }

  // Determine which files to process
  let htmlFiles: string[];
  if (files.length > 0) {
    // Use specified files
    htmlFiles = files.filter(f => f.endsWith('.html'));
    if (htmlFiles.length === 0) {
      console.error('❌ No .html files specified');
      process.exit(1);
    }
  } else {
    // Find all HTML files in current directory
    const dirContents = await fs.readdir(inputDir);
    htmlFiles = dirContents.filter(f => f.endsWith('.html'));
    if (htmlFiles.length === 0) {
      console.error('❌ No .html files found in current directory');
      console.log('💡 Try: npx wp2md --help');
      process.exit(1);
    }
  }

  console.log(`📂 Found HTML files: ${htmlFiles.length}`);

  for (const file of htmlFiles) {
    console.log(`\n🔄 Converting: ${file}`);

    const sanitizedFile = sanitizeFilename(file);
    const inputPath = path.join(inputDir, sanitizedFile);
    const htmlContent = await fs.readFile(inputPath, 'utf-8');

    const result = await convertWordPressToMarkdown(htmlContent, sanitizedFile, {
      downloadImages: options.downloadImages,
      imagesDir: options.downloadImages ? imagesDir : undefined,
    });

    // Create output filename
    const basename = path.basename(sanitizedFile, '.html');
    const outputPath = path.join(outputDir, `${basename}.md`);

    // Create frontmatter + markdown content
    let content = '---\n';
    content += `title: "${result.metadata.title}"\n`;
    if (result.metadata.date) {
      content += `date: ${result.metadata.date}\n`;
    }
    if (result.metadata.tags.length > 0) {
      content += `tags: [${result.metadata.tags.map(t => `"${t}"`).join(', ')}]\n`;
    }
    content += '---\n\n';
    content += result.markdown;

    await fs.writeFile(outputPath, content, 'utf-8');
    console.log(`✅ Saved: ${outputPath}`);

    // Show statistics
    console.log(`   📊 Headings: ${result.metadata.headings.length}`);
    console.log(`   📊 Links: ${result.metadata.links.length}`);
    console.log(`   📊 Images: ${result.metadata.images.length}`);

    // Show downloaded images
    const downloadedImages = result.metadata.images.filter(img => img.localPath);
    if (downloadedImages.length > 0) {
      console.log(`   📥 Downloaded images: ${downloadedImages.length}`);
      downloadedImages.forEach(img => {
        console.log(`      → ${img.localPath}`);
      });
    }
  }

  console.log(`\n🎉 Conversion complete! Output in: ${outputDir}`);
}

main().catch(console.error);
