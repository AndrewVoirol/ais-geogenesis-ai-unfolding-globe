import { GoogleGenAI } from "@google/genai";
import { ChatMessage, LocationMarker } from "../types";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

const ai = new GoogleGenAI({ apiKey: API_KEY });

// System instruction to force structured location data for the visualizer
// alongside the natural language response, utilizing specific tools for accuracy.
const SYSTEM_INSTRUCTION = `
You are an advanced geospatial AI assistant connected to a high-fidelity 3D interactive globe.
Your goal is to answer user queries about the world, geography, travel, and places using the most accurate and real-time data available.

TOOLS & DATA SOURCES:
1. **Google Search**: Use this for current events, news, weather patterns, trending travel destinations, and broader fact-checking.
2. **Google Maps**: Use this for verifying existence of places, getting precise coordinates, finding nearby attractions, and validating addresses.

CRITICAL INSTRUCTION FOR VISUALIZATION:
If the user's query involves specific physical locations, cities, countries, or landmarks, you MUST include a JSON block at the very end of your response.
Use the tools to ensure the coordinates (lat/lng) are accurate.

JSON Schema:
\`\`\`json
{
  "locations": [
    { "name": "Location Name", "lat": 12.34, "lng": 56.78, "description": "Short blurb about this location." }
  ]
}
\`\`\`
Do not include this JSON block if the query is purely conversational or abstract.
Always ensure the JSON is valid.
`;

export const sendMessageToGemini = async (
    history: ChatMessage[],
    newMessage: string
): Promise<ChatMessage> => {
    try {
        // Filter history to only text for context to avoid token bloat with metadata
        const contents = history.map(h => ({
            role: h.role,
            parts: [{ text: h.text }]
        }));
        
        // Add new message
        contents.push({
            role: 'user',
            parts: [{ text: newMessage }]
        });

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: contents[contents.length - 1].parts[0].text, 
            config: {
                systemInstruction: SYSTEM_INSTRUCTION,
                // Enable both Maps and Search for rich grounding
                tools: [{ googleMaps: {} }, { googleSearch: {} }],
                temperature: 0.7,
            }
        });

        const text = response.text || "I couldn't process that request.";
        
        // Extract Grounding Metadata (Source Links)
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        const groundingUrls = groundingChunks
            .filter((c: any) => c.web?.uri || c.maps?.uri)
            .map((c: any) => ({
                title: c.web?.title || c.maps?.title || "Source",
                uri: c.web?.uri || c.maps?.uri,
                sourceType: c.maps ? 'map' : 'web'
            }));

        // Extract JSON for Map Markers
        let locations: LocationMarker[] = [];
        const jsonMatch = text.match(/```json\s*({[\s\S]*?})\s*```/);
        
        let cleanText = text;

        if (jsonMatch) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                if (data.locations) {
                    locations = data.locations;
                }
                // Remove the JSON block from the visible text to keep chat clean
                cleanText = text.replace(jsonMatch[0], '').trim();
            } catch (e) {
                console.error("Failed to parse location JSON from Gemini", e);
            }
        }

        return {
            id: Date.now().toString(),
            role: 'model',
            text: cleanText,
            locations,
            groundingUrls
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            id: Date.now().toString(),
            role: 'model',
            text: "I'm having trouble connecting to the satellite network. Please verify your API key or try again.",
            locations: []
        };
    }
};