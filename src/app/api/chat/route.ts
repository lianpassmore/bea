import { Anthropic } from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { BEA_SYSTEM_PROMPT } from '../../../lib/prompts';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const response = await anthropic.messages.create({
      model: 'claude-3-opus-20240229', // Using Opus for the deep emotional subtext
      max_tokens: 150, // Keep Bea's responses short and gentle
      system: BEA_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: message }
      ],
    });

    // Extract the text from Claude's response
    const reply = response.content[0].type === 'text' ? response.content[0].text : '';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('Claude API Error:', error);
    return NextResponse.json({ error: 'Failed to process check-in' }, { status: 500 });
  }
}