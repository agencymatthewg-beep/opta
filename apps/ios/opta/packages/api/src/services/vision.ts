/**
 * @fileoverview Vision Service
 * @description AI-powered image and text extraction using OpenAI GPT-4 Vision
 */

import OpenAI from 'openai';
import type { ContentType, ExtractedOption, ExtractionResult } from '@opta/shared';

// ============================================
// Configuration
// ============================================

/** OpenAI model to use for vision tasks */
const VISION_MODEL = 'gpt-4o';

/** Maximum tokens for extraction response */
const MAX_TOKENS = 2000;

/** Temperature for image extraction (low for consistency) */
const IMAGE_EXTRACTION_TEMPERATURE = 0.1;

/** Temperature for text extraction (slightly higher for creativity) */
const TEXT_EXTRACTION_TEMPERATURE = 0.3;

/** Default confidence when extraction succeeds but confidence is missing */
const DEFAULT_IMAGE_CONFIDENCE = 0.8;

/** Default confidence for text-based extraction */
const DEFAULT_TEXT_CONFIDENCE = 0.7;

/** JPEG data URL prefix */
const JPEG_DATA_URL_PREFIX = 'data:image/jpeg;base64,';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// System Prompts
// ============================================

/**
 * System prompt for image-based option extraction.
 * Instructs the AI to identify and structure all decision options.
 */
const EXTRACTION_SYSTEM_PROMPT = `You are Opta, an AI that extracts decision options from images.

# Your Task
Analyze the image and extract ALL distinct options/choices visible.
For each option, identify relevant attributes that could inform a decision.

# Output Format (JSON only, no markdown)
{
  "content_type": "menu|products|listings|comparison|document|pricing|other",
  "confidence": 0.0-1.0,
  "options": [
    {
      "id": "unique_identifier",
      "name": "Option name/title",
      "description": "Brief description if available",
      "attributes": {
        "price": number or null,
        "currency": "USD" or other,
        "calories": number or null,
        "protein": number or null,
        "rating": number or null,
        "ratingCount": number or null,
        "prepTime": number (minutes) or null,
        "size": "string" or null,
        "brand": "string" or null
      },
      "tags": ["tag1", "tag2"],
      "position": "where in image"
    }
  ],
  "context": {
    "source": "Restaurant/store name if visible",
    "category": "Type of decision",
    "additionalInfo": "Any relevant context"
  },
  "extractionNotes": "Any ambiguities or assumptions"
}

# Rules
1. Extract EVERY distinct option, even if attributes are incomplete
2. Use null for unknown attributes, never guess values
3. Preserve original text/names exactly as shown
4. Note confidence level — lower if image is unclear
5. If no clear options exist, return empty options array with explanation
6. Return ONLY valid JSON, no markdown code blocks`;

/**
 * System prompt for text-based option extraction.
 * Instructs the AI to identify options from natural language queries.
 */
const TEXT_EXTRACTION_PROMPT = `You are Opta, an AI that helps compare options for decisions.

Based on the user's query, identify the options they're comparing and extract relevant attributes.
If they mention specific items, research your knowledge to provide accurate attributes.

# Output Format (JSON only, no markdown)
{
  "content_type": "menu|products|listings|comparison|document|pricing|other",
  "confidence": 0.0-1.0,
  "options": [
    {
      "id": "unique_identifier",
      "name": "Option name",
      "description": "Brief description",
      "attributes": {
        "price": number or null,
        "calories": number or null,
        "rating": number or null
      },
      "tags": ["tag1", "tag2"],
      "position": null
    }
  ],
  "context": {
    "source": null,
    "category": "Type of decision",
    "additionalInfo": "Context from query"
  },
  "extractionNotes": "Assumptions made"
}

Return ONLY valid JSON, no markdown code blocks.`;

// ============================================
// Type Definitions
// ============================================

/** Parsed option from AI response */
interface ParsedOption {
  id?: string;
  name?: string;
  description?: string;
  attributes?: Record<string, unknown>;
  tags?: string[];
  position?: string;
}

/** Parsed context from AI response */
interface ParsedContext {
  source?: string;
  category?: string;
  additionalInfo?: string;
}

/** Parsed AI extraction response */
interface ParsedExtractionResponse {
  content_type?: string;
  confidence?: number;
  options: ParsedOption[];
  context?: ParsedContext;
  extractionNotes?: string;
}

// ============================================
// Service Implementation
// ============================================

/**
 * Vision service for AI-powered content extraction.
 */
export const visionService = {
  /**
   * Extract options from an image using GPT-4 Vision.
   *
   * @param base64Image - Base64-encoded image data (with or without data URL prefix)
   * @param context - Optional context hint to guide extraction
   * @returns Promise resolving to extraction result
   * @throws Error if extraction fails
   */
  async extractFromImage(base64Image: string, context?: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Build user message with optional context
      const userMessage = context != null
        ? `Analyze this image and extract all options. Context hint: ${context}`
        : 'Analyze this image and extract all decision options.';

      // Ensure image has proper data URL format
      const imageUrl = base64Image.startsWith('data:')
        ? base64Image
        : `${JPEG_DATA_URL_PREFIX}${base64Image}`;

      // Call OpenAI Vision API
      const response = await openai.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: 'system',
            content: EXTRACTION_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: IMAGE_EXTRACTION_TEMPERATURE,
      });

      // Extract and parse response content
      const content = response.choices[0]?.message?.content ?? '';
      const parsed = parseJsonResponse(content) as ParsedExtractionResponse;

      // Map parsed options to typed ExtractedOption array
      const options: ExtractedOption[] = parsed.options.map((opt, index) => ({
        id: opt.id ?? `opt_${index}`,
        name: opt.name ?? 'Unknown',
        description: opt.description,
        attributes: opt.attributes ?? {},
        tags: opt.tags ?? [],
        position: opt.position,
      }));

      // Build and return extraction result
      const processingTimeMs = Date.now() - startTime;
      return {
        contentType: (parsed.content_type as ContentType) ?? 'other',
        confidence: parsed.confidence ?? DEFAULT_IMAGE_CONFIDENCE,
        options,
        context: {
          source: parsed.context?.source,
          category: parsed.context?.category,
          additionalInfo: parsed.context?.additionalInfo,
        },
        extractionNotes: parsed.extractionNotes,
        processingTimeMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Vision extraction error:', errorMessage);
      throw new Error('Failed to extract options from image');
    }
  },

  /**
   * Extract options from a text query using LLM.
   *
   * @param query - Natural language query describing options to compare
   * @returns Promise resolving to extraction result
   * @throws Error if extraction fails
   */
  async extractFromText(query: string): Promise<ExtractionResult> {
    const startTime = Date.now();

    try {
      // Call OpenAI API with text-only prompt
      const response = await openai.chat.completions.create({
        model: VISION_MODEL,
        messages: [
          {
            role: 'system',
            content: TEXT_EXTRACTION_PROMPT,
          },
          {
            role: 'user',
            content: query,
          },
        ],
        max_tokens: MAX_TOKENS,
        temperature: TEXT_EXTRACTION_TEMPERATURE,
      });

      // Extract and parse response content
      const content = response.choices[0]?.message?.content ?? '';
      const parsed = parseJsonResponse(content) as ParsedExtractionResponse;

      // Map parsed options to typed ExtractedOption array
      const options: ExtractedOption[] = parsed.options.map((opt, index) => ({
        id: opt.id ?? `opt_${index}`,
        name: opt.name ?? 'Unknown',
        description: opt.description,
        attributes: opt.attributes ?? {},
        tags: opt.tags ?? [],
      }));

      // Build and return extraction result
      const processingTimeMs = Date.now() - startTime;
      return {
        contentType: (parsed.content_type as ContentType) ?? 'other',
        confidence: parsed.confidence ?? DEFAULT_TEXT_CONFIDENCE,
        options,
        context: {
          source: parsed.context?.source,
          category: parsed.context?.category,
          additionalInfo: parsed.context?.additionalInfo,
        },
        extractionNotes: parsed.extractionNotes,
        processingTimeMs,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Text extraction error:', errorMessage);
      throw new Error('Failed to extract options from query');
    }
  },
};

// ============================================
// Helper Functions
// ============================================

/** Markdown code block prefixes to strip */
const MARKDOWN_JSON_PREFIX = '```json';
const MARKDOWN_CODE_PREFIX = '```';

/** Maximum characters to log on parse failure */
const MAX_ERROR_LOG_LENGTH = 200;

/**
 * Parse JSON from LLM response, handling potential markdown code blocks.
 * LLMs sometimes wrap JSON in markdown code blocks despite instructions.
 *
 * @param content - Raw response content from LLM
 * @returns Parsed JSON object
 * @throws Error if content is not valid JSON
 */
function parseJsonResponse(content: string): Record<string, unknown> {
  let jsonString = content.trim();

  // Strip markdown code block wrappers if present
  if (jsonString.startsWith(MARKDOWN_JSON_PREFIX)) {
    jsonString = jsonString.slice(MARKDOWN_JSON_PREFIX.length);
  } else if (jsonString.startsWith(MARKDOWN_CODE_PREFIX)) {
    jsonString = jsonString.slice(MARKDOWN_CODE_PREFIX.length);
  }

  if (jsonString.endsWith(MARKDOWN_CODE_PREFIX)) {
    jsonString = jsonString.slice(0, -MARKDOWN_CODE_PREFIX.length);
  }

  jsonString = jsonString.trim();

  try {
    return JSON.parse(jsonString) as Record<string, unknown>;
  } catch {
    const preview = jsonString.slice(0, MAX_ERROR_LOG_LENGTH);
    console.error('Failed to parse JSON:', preview);
    throw new Error('Invalid JSON response from AI');
  }
}
