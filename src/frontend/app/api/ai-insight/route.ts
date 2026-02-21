import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { portfolio } = await req.json();

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GEMINI_API_KEY is not configured" },
                { status: 500 }
            );
        }

        const ai = new GoogleGenAI({ apiKey });

        const prompt = `
      You are an autonomous Risk Agent for a DeFi user on Arbitrum.
      The user follows a "Good Vibes Only" philosophy: they want low stress, high safety, and optimized yields.

      **User Context:**
      - Total Net Worth: $${portfolio.totalNetWorth?.toFixed(2)}
      - Total Supplied: $${portfolio.totalSupplied?.toFixed(2)}
      - Total Borrowed: $${portfolio.totalBorrowed?.toFixed(2)}
      - Global Net APY: ${portfolio.globalNetAPY?.toFixed(2)}%
      - **Target Safe Health Factor:** 1.5
      
      **Protocol Health:**
      - Aave: HF ${portfolio.aave?.health?.toFixed(2)} (Supply: $${portfolio.aave?.supply?.toFixed(2)}, Borrow: $${portfolio.aave?.borrow?.toFixed(2)})
      - Radiant: HF ${portfolio.radiant?.health?.toFixed(2)} (Supply: $${portfolio.radiant?.supply?.toFixed(2)}, Borrow: $${portfolio.radiant?.borrow?.toFixed(2)})

      **Detailed Positions:**
      ${JSON.stringify(portfolio.positions, null, 2)}

      **Task:**
      Analyze this portfolio and generate 3 short, actionable, "Good Vibes" tips.
      
      **Guidelines:**
      1. **Address Risk First:** If any protocol HF is below 1.4, use the following math to give EXACT dollar and percentage figures in your tip:
         - **To reach Target HF 1.5 by Repaying:** Repay Amount = CurrentBorrow - ((Supply * LTV) / 1.5).
         - **To reach Target HF 1.5 by Depositing:** Deposit Amount = (Borrow * 1.5 / LTV) - Supply.
         - *Note: Average LTV is roughly 0.75-0.80. Use the 'ltv' field from the positions if available, or assume 0.8.*
         - **Vibe:** "Repay ~$X to hit 1.5 HF" or "Deposit ~$Y more to sleep better."
      
      2. **Specific Tips:** If health is safe (>1.5), suggest ways to flip yield if negative, or boost it if positive.
      3. **Natural Formatting:** Do not use bullet points or dry tables. Keep it conversational but data-rich. Use the "$" and "%" symbols and mention the specific assets (e.g., USDT, ETH).
      4. **Consistency:** Ensure the numbers you mention match the reality of the portfolio data provided.
      5. **Format:** JSON array of strings only. Example: ["Tip 1", "Tip 2", "Tip 3"].
      Just the raw JSON array.
    `;

        const result = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: prompt,
        });

        const text = result.text || "[]";

        // Clean up potential markdown formatting if the model disregards instructions
        const cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();

        return NextResponse.json({ tips: JSON.parse(cleanText) });
    } catch (error) {
        console.error("AI Insight Error:", error);
        return NextResponse.json(
            { error: "Failed to generate insights" },
            { status: 500 }
        );
    }
}

