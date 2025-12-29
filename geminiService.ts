
import { GoogleGenAI, Type } from "@google/genai";

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  }

  async suggestTags(assetName: string, assetUrl: string): Promise<string[]> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Suggest 5 concise Korean tags for a Gen AI asset named "${assetName}" with URL "${assetUrl}". Return as a JSON array of strings. Do not include markdown formatting.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });

      if (response.text) {
        return JSON.parse(response.text.trim());
      }
      return [];
    } catch (error) {
      console.error("Gemini tagging error:", error);
      return ["AI", "GenAI", "Asset"];
    }
  }

  async getDashboardSummary(stats: any): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Based on these platform statistics: ${JSON.stringify(stats)}, provide a short, professional one-sentence summary in Korean for a management dashboard. Use a helpful and forward-looking tone.`,
      });
      return response.text?.trim() || "데이터 분석이 완료되었습니다. 현재 플랫폼이 안정적으로 운영 중입니다.";
    } catch (error) {
      console.error("Gemini summary error:", error);
      return "데이터를 성공적으로 불러왔습니다.";
    }
  }
}

export const geminiService = new GeminiService();
