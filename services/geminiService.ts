/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Modality } from "@google/genai";
import type { GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


// --- Helper Functions ---

/**
 * Processes the Gemini API response, extracting the image or throwing an error if none is found.
 * @param response The response from the generateContent call.
 * @returns A data URL string for the generated image.
 */
function processGeminiResponse(response: GenerateContentResponse): string {
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        return `data:${mimeType};base64,${data}`;
    }

    const textResponse = response.text;
    console.error("API did not return an image. Response:", textResponse);
    throw new Error(`The AI model responded with text instead of an image: "${textResponse || 'No text response received.'}"`);
}

/**
 * Generates a scene by combining a person image, a product image, and a text prompt.
 * @param personImageDataUrl Data URL of the person's image.
 * @param productImageDataUrl Data URL of the product's image.
 * @param prompt The text prompt guiding the generation.
 * @returns A promise that resolves to a base64-encoded image data URL of the generated image.
 */
export async function generateProductScene(personImageDataUrl: string, productImageDataUrl: string, prompt: string): Promise<string> {
  const parseDataUrl = (dataUrl: string) => {
    const match = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
      throw new Error("Invalid image data URL format. Expected 'data:image/...;base64,...'");
    }
    const [, mimeType, data] = match;
    return { mimeType, data };
  };

  try {
    const personImage = parseDataUrl(personImageDataUrl);
    const productImage = parseDataUrl(productImageDataUrl);

    const personImagePart = {
        inlineData: {
        mimeType: personImage.mimeType,
        data: personImage.data,
        },
    };

    const productImagePart = {
        inlineData: {
        mimeType: productImage.mimeType,
        data: productImage.data,
        },
    };

    const textPart = { text: prompt };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: {
        parts: [
          personImagePart,
          productImagePart,
          textPart,
        ],
      },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    return processGeminiResponse(response);
  } catch (error) {
      console.error("An unrecoverable error occurred during image generation.", error);
      const errorMessage = error instanceof Error ? error.message : JSON.stringify(error);
      throw new Error(`The AI model failed to generate an image. Details: ${errorMessage}`);
  }
}
