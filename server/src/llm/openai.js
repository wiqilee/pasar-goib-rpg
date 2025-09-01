import fetch from 'node-fetch';

export class OpenAIProvider {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }
  async generateJSON(schema, messages) {
    const sys = [{ role: 'system', content: 'Output strictly valid JSON only.' }, ...messages];
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, messages: sys, temperature: 0.8, response_format: { type: 'json_object' } })
    });
    if (!resp.ok) throw new Error(`OpenAI error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content || '{}';
    try { return JSON.parse(content); } 
    catch {
      const m = content.match(/\{[\s\S]*\}$/); 
      return m ? JSON.parse(m[0]) : { narrative: 'The lamps whisper (fallback).', suggested_commands: ['look around'] };
    }
  }
}
