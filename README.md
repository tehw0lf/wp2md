# wp2md

A TypeScript-based tool for converting WordPress Block Editor HTML to clean Markdown.

## Features

- ✅ **Remove WordPress Block Comments** - Automatically removes all `<!-- wp:... -->` comments
- ✅ **Clean WordPress CSS Classes** - Removes `wp-*` and `gb-*` classes
- ✅ **Extract Metadata** - Captures title, headings, links, and images
- ✅ **Code Blocks with Syntax Highlighting** - Extracts language info from WordPress comments (`bash`, `typescript`, `xml`, etc.)
- ✅ **Frontmatter Generation** - YAML frontmatter for Jekyll, Hugo, and other static site generators
- ✅ **Automatic Image Download** - Downloads external images and saves them locally in the `images/` directory
- ✅ **Progress Indicators** - Shows download progress with filenames and file sizes
- ✅ **Link Adjustment** - Converts WordPress URLs to relative Markdown links
- ✅ **HTML Entity Handling** - Replaces `&nbsp;`, `&amp;`, `&#91;`, etc.

## Installation

### Global Installation (Recommended)

```bash
npm install -g wp2md
```

### One-time Use with npx

```bash
npx wp2md
```

## Usage

### Convert All HTML Files in Current Directory

```bash
npx wp2md
```

This converts all `.html` files in the current directory and:
- Saves Markdown files to `output/`
- Downloads all external images to `output/images/`
- Shows progress and statistics for each file

### Convert Specific Files

```bash
npx wp2md article.html
npx wp2md post1.html post2.html
npx wp2md *.html
```

### Custom Output Directory

```bash
npx wp2md -o dist
npx wp2md file.html --output ./markdown
```

### Skip Image Downloads

```bash
npx wp2md --no-images
```

### Help

```bash
npx wp2md --help
```

## CLI Options

- `-o, --output <dir>` - Output directory (default: `./output`)
- `--no-images` - Skip downloading images
- `-h, --help` - Show help message

## Development

### Local Development

```bash
npm install

# Run with arguments (same as npx wp2md)
npm run dev
npm run dev -- file.html
npm run dev -- -o dist --no-images
npm run dev -- --help
```

**Note**: The `--` is required to pass arguments to the script.

### Build

```bash
npm run build

# Test built version
npm start
npm start -- file.html -o dist
```

### Manual Conversion

```typescript
import { convertWordPressToMarkdown } from './src/converter.js';

const html = `<!-- wp:paragraph -->
<p>Your WordPress Content</p>
<!-- /wp:paragraph -->`;

const result = await convertWordPressToMarkdown(html, 'filename.html', {
  downloadImages: true,
  imagesDir: './output/images'
});

console.log(result.markdown);
console.log(result.metadata);
```

## Output Format

Generated Markdown files contain YAML frontmatter and clean Markdown content, fully compatible with **Obsidian**, **Logseq**, **Notion**, and other Markdown-based note-taking and knowledge management systems:

```markdown
---
title: "Article Title"
date: 2024-01-01
tags: ["tag1", "tag2"]
---

# Article Content

Your converted content...
```

The output follows standard Markdown syntax with frontmatter metadata, making it ideal for:
- 📓 **Obsidian** - Direct import with full metadata support
- 📚 **Static Site Generators** - Jekyll, Hugo, Eleventy, etc.
- 🗂️ **Knowledge Management** - Logseq, Notion, Roam Research
- 📝 **Documentation** - MkDocs, Docusaurus, VuePress

## Project Structure

```
wp2md/
├── src/
│   ├── index.ts          # CLI Entry Point
│   └── converter.ts      # Conversion Logic
├── output/               # Generated Markdown Files
│   ├── *.md             # Converted Articles
│   └── images/          # Downloaded Images
├── *.html               # Input WordPress HTML Files
├── package.json
├── tsconfig.json
└── README.md
```

## Example Output

During conversion, the tool displays detailed information:

```
📂 Found HTML files: 2

🔄 Converting: my-article.html
   📥 Downloading image: https://example.com/wp-content/uploads/2024/01/diagram.png
   ✓ Saved: diagram.png (8.56 KB)
   📥 Downloading image: https://example.com/wp-content/uploads/2024/01/screenshot.jpg
   ✓ Saved: screenshot.jpg (12.34 KB)
✅ Saved: output/my-article.md
   📊 Headings: 5
   📊 Links: 8
   📊 Images: 4
   📥 Downloaded images: 4
      → diagram.png
      → screenshot.jpg
      → chart.png
      → photo.jpg
```

## Technology Stack

- **TypeScript** - Type-safe code
- **Cheerio** - HTML parsing and manipulation
- **Turndown** - HTML to Markdown conversion
- **turndown-plugin-gfm** - GitHub Flavored Markdown support
- **node-fetch** - Image downloading

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
