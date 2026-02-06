
import { GoogleGenAI } from "@google/genai";
import { AspectRatio, ImageModel, ImageSize } from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callGeminiWithRetries = async (prompt: string, systemInstruction: string) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const maxRetries = 3;
    let currentDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: prompt,
                ...(systemInstruction && { config: { systemInstruction } }),
            });
            return response.text ?? "";
        } catch (error) {
            console.error(`Attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await delay(currentDelay);
            currentDelay *= 2;
        }
    }
    return "";
};

export const improvePromptWithGemini = (prompt: string) => {
    const fullPrompt = `Rewrite this prompt for an AI image generator: "${prompt}". Make it highly descriptive, cinematic, and professional. Focus on lighting, textures (carbon fiber, fabrics), and specific atmosphere. Respond ONLY with the improved prompt text.`;
    const systemInstruction = "You are an expert prompt engineer for high-end AI image generation.";
    return callGeminiWithRetries(fullPrompt, systemInstruction);
};

export const generateVariationsWithGemini = (prompt: string) => {
    const fullPrompt = `Based on the concept: "${prompt}", generate 4 unique artistic variations. Each should have a different lighting setup or mood. Respond with a list of prompts separated by new lines only.`;
    const systemInstruction = "You are a creative visual director.";
    return callGeminiWithRetries(fullPrompt, systemInstruction);
};

export const generateStoryboardWithGemini = (prompt: string) => {
    const fullPrompt = `Create a 5-part visual storyboard based on: "${prompt}". The sequence should tell a brief cinematic story. Respond with 5 distinct prompts separated by new lines.`;
    const systemInstruction = "You are a master storyboard artist and storyteller.";
    return callGeminiWithRetries(fullPrompt, systemInstruction);
};

export const upscaleImageWithGemini = async (base64Image: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = "UPSCALE IMAGE: Enhance this image to a much higher resolution. Sharpen details, improve textures, and increase overall clarity to photorealistic 4K quality. Do not change the composition or subject matter.";
    const maxRetries = 3;
    let currentDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-image-preview',
                contents: {
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: "image/png", data: base64Image.split(',')[1] } }
                    ]
                },
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            throw new Error("No upscaled image data returned from API.");

        } catch (error) {
            console.error(`Upscaling attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await delay(currentDelay);
            currentDelay *= 2;
        }
    }
    throw new Error("Image upscaling failed after multiple retries.");
};

export const generateImageWithGemini = async (
    promptText: string,
    stylesString: string,
    selectedRatio: AspectRatio,
    model: ImageModel,
    imageSize: ImageSize,
    base64Image: string | null = null,
    overlayText: string | null = null
) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const maxRetries = 5;
    let currentDelay = 1000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            let instruction = promptText;
            if (base64Image) {
                 instruction = `TOTAL STYLE TRANSFORMATION: 
    1. SUBJECT: ${promptText}.
    2. BLUEPRINT: Use the provided image for structural and spatial reference. 
    3. COMPLETE REDO: Convert the ENTIRE image into the following style(s): ${stylesString}. 
    4. UNIFIED CONVERSION: Redraw everything. Update clothing fabrics (tactical, tech-wear), shoes, architecture, signs, and background to be 100% consistent with the selected styles.
    5. CANVAS EXPANSION: Extend the scene to a ${selectedRatio} aspect ratio. The extension must be a seamless continuation of the newly transformed style.
    6. NO EXAGGERATION: Focus on grounded futuristic textiles and architecture. Do NOT add floating neon lines or neon biker glows on people.`;
                
                if (overlayText) {
                  instruction += `\n7. TEXT OVERLAY: Add "${overlayText}" to the bottom center. Ensure professional legibility.`;
                }
            } else {
                instruction = `${promptText}, ${stylesString}${overlayText ? `. With text: "${overlayText}"` : ""}`;
            }

            const response = await ai.models.generateContent({
                model: model,
                contents: {
                    parts: [
                        { text: instruction },
                        ...(base64Image ? [{ inlineData: { mimeType: "image/png", data: base64Image.split(',')[1] } }] : [])
                    ]
                },
                config: {
                    imageConfig: {
                        aspectRatio: selectedRatio,
                        ...(model === 'gemini-3-pro-image-preview' && { imageSize: imageSize })
                    }
                }
            });

            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:image/png;base64,${part.inlineData.data}`;
                }
            }
            throw new Error("No image data returned from API.");
        } catch (error) {
            console.error(`Image generation attempt ${i + 1} failed:`, error);
            if (i === maxRetries - 1) throw error;
            await delay(currentDelay);
            currentDelay *= 2;
        }
    }
    throw new Error("Image generation failed after multiple retries.");
};

export const analyzeImageWithGemini = async (base64Image: string): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = "Analyze this image's content, style, and composition. Based on your analysis, generate three distinct and creative prompts for a complete artistic transformation. The prompts should be suitable for an AI image generator, focusing on different themes, moods, or styles. For example, you could suggest a cyberpunk makeover, a fantasy reimagining, or a cinematic action scene. Respond ONLY with the three prompts, each on a new line.";
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: {
            parts: [
                { text: prompt },
                { inlineData: { mimeType: "image/jpeg", data: base64Image.split(',')[1] } }
            ]
        },
    });

    return response.text ?? "";
};
