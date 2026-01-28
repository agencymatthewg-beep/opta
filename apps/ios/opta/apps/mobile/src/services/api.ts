import type { ScanResponse, PriorityWeights } from '@opta/shared';
import Constants from 'expo-constants';

/** Default API URL for local development */
const DEFAULT_API_URL = 'http://localhost:3001';

/** API base URL from Expo config or fallback to default */
const API_URL: string = Constants.expoConfig?.extra?.apiUrl ?? DEFAULT_API_URL;

/** HTTP content type header for JSON requests */
const CONTENT_TYPE_JSON = 'application/json';

/**
 * Request body structure for scan API endpoint
 */
interface ScanRequest {
  /** Base64-encoded image data */
  readonly image: string;
  /** Optional priority weights for scoring */
  readonly priorities?: PriorityWeights;
  /** Optional context hint for AI extraction */
  readonly context?: string;
}

/**
 * Error response structure from API
 */
interface ApiErrorResponse {
  readonly message?: string;
  readonly code?: string;
}

/**
 * API client for communicating with the Opta backend
 */
class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Submit an image for scan analysis and optimization
   * @param base64Image - Base64-encoded image data
   * @param priorities - Optional priority weights
   * @param context - Optional context hint for AI
   * @returns Promise resolving to scan response
   * @throws Error if request fails or returns non-OK status
   */
  async scanImage(
    base64Image: string,
    priorities?: PriorityWeights,
    context?: string
  ): Promise<ScanResponse> {
    const requestBody: ScanRequest = {
      image: base64Image,
      priorities,
      context,
    };

    const response = await fetch(`${this.baseUrl}/api/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': CONTENT_TYPE_JSON,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await this.parseErrorResponse(response);
      throw new Error(errorData.message ?? `HTTP ${response.status}`);
    }

    return response.json() as Promise<ScanResponse>;
  }

  /**
   * Check if the API server is healthy and reachable
   * @returns Promise resolving to true if healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Safely parse error response JSON
   * @param response - Fetch response object
   * @returns Parsed error or fallback object
   */
  private async parseErrorResponse(response: Response): Promise<ApiErrorResponse> {
    try {
      return await response.json() as ApiErrorResponse;
    } catch {
      return { message: 'Scan failed' };
    }
  }
}

/** Singleton API client instance */
export const apiClient = new ApiClient(API_URL);

/**
 * Convenience function to scan an image
 * Matches the expected import signature in scan.tsx
 * @param base64Image - Base64-encoded image data
 * @param priorities - Optional priority weights
 * @param context - Optional context hint
 * @returns Promise resolving to scan response
 */
export async function scanImage(
  base64Image: string,
  priorities?: PriorityWeights,
  context?: string
): Promise<ScanResponse> {
  return apiClient.scanImage(base64Image, priorities, context);
}
