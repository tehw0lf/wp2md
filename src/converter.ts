import * as cheerio from 'cheerio';
import { promises as fs } from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import TurndownService from 'turndown';
// @ts-ignore - No type definitions available
import { gfm } from 'turndown-plugin-gfm';

export interface ConversionMetadata {
  title: string;
  date?: string;
  tags: string[];
  headings: string[];
  links: string[];
  images: Array<{ url: string; alt: string; localPath?: string }>;
}

export interface ConversionResult {
  markdown: string;
  metadata: ConversionMetadata;
}

/**
 * Extracts language info from WordPress code comments and adds it to HTML
 */
function enrichCodeBlocksWithLanguage(html: string): string {
  // Find all wp:code comments with language info
  const codeBlockPattern =
    /<!--\s*wp:code\s+({[^}]+})\s*-->[\s\S]*?<pre class="wp-block-code"><code>/g;

  return html.replace(codeBlockPattern, (match, jsonStr) => {
    try {
      const config = JSON.parse(jsonStr);
      const language = config.language || "";

      // Add language class to code element
      return match.replace("<code>", `<code class="language-${language}">`);
    } catch (e) {
      return match;
    }
  });
}

/**
 * Removes WordPress block comments from HTML
 */
function stripWordPressComments(html: string): string {
  return html
    .replace(/<!--\s*wp:.*?-->/g, "")
    .replace(/<!--\s*\/wp:.*?-->/g, "");
}

/**
 * Cleans WordPress-specific HTML attributes
 */
function cleanWordPressAttributes(html: string): string {
  const $ = cheerio.load(html);

  // Remove WordPress-specific classes
  $('[class*="wp-"]').each((_, el) => {
    const classes = $(el).attr("class")?.split(" ") || [];
    const cleanClasses = classes.filter(
      (c) => !c.startsWith("wp-") && !c.startsWith("gb-"),
    );
    if (cleanClasses.length > 0) {
      $(el).attr("class", cleanClasses.join(" "));
    } else {
      $(el).removeAttr("class");
    }
  });

  // Remove empty IDs
  $('[id=""]').removeAttr("id");

  return $.html();
}

/**
 * Extracts metadata from HTML
 */
function extractMetadata(html: string, filename: string): ConversionMetadata {
  const $ = cheerio.load(html);

  // Title: Generate from filename (kebab-case to Title Case)
  const basename = path.basename(filename, ".html");
  const title = basename
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  // Collect all headings
  const headings: string[] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    headings.push($(el).text());
  });

  // Collect links
  const links: string[] = [];
  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href) links.push(href);
  });

  // Collect images
  const images: Array<{ url: string; alt: string }> = [];
  $("img").each((_, el) => {
    const src = $(el).attr("src");
    const alt = $(el).attr("alt") || "";
    if (src) images.push({ url: src, alt });
  });

  return {
    title,
    tags: [],
    headings,
    links,
    images,
  };
}

/**
 * Configures the Turndown Service with WordPress-specific rules
 */
function createTurndownService(): TurndownService {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    fence: "```",
    emDelimiter: "_",
    strongDelimiter: "**",
    linkStyle: "inlined",
  });

  // GFM plugin for tables, strikethrough, etc.
  turndownService.use(gfm);

  // Custom rule for WordPress code blocks
  turndownService.addRule("wordpressCodeBlock", {
    filter: (node) => {
      return (
        node.nodeName === "PRE" && node.classList.contains("wp-block-code")
      );
    },
    replacement: (content, node) => {
      const codeElement = node.querySelector("code");
      const code = codeElement ? codeElement.textContent || "" : content;

      // Extract language from classes
      const classes = codeElement?.className || "";
      const langMatch = classes.match(/language-(\w+)/);
      const lang = langMatch ? langMatch[1] : "";

      return "\n\n```" + lang + "\n" + code + "\n```\n\n";
    },
  });

  // Custom rule for inline code
  turndownService.addRule("inlineCode", {
    filter: ["code"],
    replacement: (content) => {
      if (!content.trim()) return "";
      return "`" + content + "`";
    },
  });

  // Custom rule for &nbsp; and other HTML entities
  turndownService.addRule("htmlEntities", {
    filter: (node) => {
      return node.nodeType === 3; // Text node
    },
    replacement: (content) => {
      return content
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#91;/g, "[")
        .replace(/&#93;/g, "]");
    },
  });

  return turndownService;
}

/**
 * Sanitizes a filename to prevent path traversal attacks
 */
function sanitizeFilename(filename: string): string {
  // Remove any path separators and parent directory references
  return (
    filename
      .replace(/^.*[\\\/]/, "") // Remove any directory path
      .replace(/\.\./g, "") // Remove parent directory references
      .replace(/[<>:"|?*\x00-\x1F]/g, "") // Remove invalid filename characters
      .trim() || "image"
  ); // Fallback to 'image' if filename becomes empty
}

/**
 * Downloads an image from a URL
 */
async function downloadImage(url: string, outputDir: string): Promise<string> {
  try {
    console.log(`   📥 Downloading image: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    const urlFilename = path.basename(new URL(url).pathname);
    const sanitizedFilename = sanitizeFilename(urlFilename);

    // Normalize and resolve paths to absolute paths (built-in security)
    // Rationale: outputDir is sanitized at call site (index.ts sanitizePath), then normalized/resolved here.
    // Explicit boundary validation below ensures filepath stays within outputDir. Defense in depth is applied.
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const resolvedOutputDir = path.resolve(path.normalize(outputDir));
    // Rationale: Both inputs are sanitized (resolvedOutputDir from above, sanitizedFilename via sanitizeFilename).
    // Explicit boundary check immediately follows to prevent path traversal.
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const filepath = path.resolve(resolvedOutputDir, sanitizedFilename);

    // Validate that the resolved filepath is within the output directory
    if (
      !filepath.startsWith(resolvedOutputDir + path.sep) &&
      filepath !== resolvedOutputDir
    ) {
      throw new Error("Invalid file path: path traversal detected");
    }

    await fs.mkdir(resolvedOutputDir, { recursive: true });
    await fs.writeFile(filepath, Buffer.from(buffer));

    // Show file size
    const sizeKB = (buffer.byteLength / 1024).toFixed(2);
    console.log(`   ✓ Saved: ${sanitizedFilename} (${sizeKB} KB)`);

    return sanitizedFilename;
  } catch (error) {
    console.warn(`   ⚠️  Error downloading ${url}: ${error}`);
    return url; // Fallback to original URL
  }
}

/**
 * Adjusts links in markdown
 */
function adjustLinks(markdown: string): string {
  // Convert WordPress URLs to relative links
  // Example: https://example.com/blog/article -> ./article.md
  return markdown.replace(
    /\[([^\]]+)\]\(https?:\/\/[^/]+\/blog\/([^)]+)\)/g,
    "[$1](./$2.md)",
  );
}

/**
 * Main conversion function
 */
export async function convertWordPressToMarkdown(
  html: string,
  filename: string,
  options: { downloadImages?: boolean; imagesDir?: string } = {},
): Promise<ConversionResult> {
  // Step 1: Add language info to code blocks
  let cleanHtml = enrichCodeBlocksWithLanguage(html);

  // Step 2: Remove WordPress comments
  cleanHtml = stripWordPressComments(cleanHtml);

  // Step 3: Clean WordPress attributes
  cleanHtml = cleanWordPressAttributes(cleanHtml);

  // Step 4: Extract metadata
  const metadata = extractMetadata(cleanHtml, filename);

  // Step 5: Download images (optional)
  if (options.downloadImages && options.imagesDir) {
    const $ = cheerio.load(cleanHtml);
    for (const img of metadata.images) {
      if (img.url.startsWith("http")) {
        const localFilename = await downloadImage(img.url, options.imagesDir);
        img.localPath = localFilename;

        // Replace image URL in HTML - relative path to images directory
        $(`img[src="${img.url}"]`).attr("src", `./images/${localFilename}`);
      }
    }
    cleanHtml = $.html();
  }

  // Step 6: Convert HTML to Markdown
  const turndownService = createTurndownService();
  let markdown = turndownService.turndown(cleanHtml);

  // Step 7: Adjust links
  markdown = adjustLinks(markdown);

  // Step 8: Clean multiple empty lines
  markdown = markdown.replace(/\n{3,}/g, "\n\n");

  // Step 9: Trim whitespace
  markdown = markdown.trim();

  return {
    markdown,
    metadata,
  };
}
