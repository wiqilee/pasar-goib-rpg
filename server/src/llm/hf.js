import fetch from 'node-fetch';

export class HFProvider {
  constructor() {
    this.apiKey = process.env.HF_API_KEY || '';
    this.model = process.env.HF_MODEL || 'HuggingFaceH4/zephyr-7b-beta';
  }
  async generateJSON(schema, messages) {
    const prompt = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n') + '\n\nReturn ONLY JSON.';
    const resp = await fetch(`https://api-inference.huggingface.co/models/${this.model}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputs: prompt, parameters: { temperature: 0.8, max_new_tokens: 400, return_full_text: false } })
    });
    if (!resp.ok) throw new Error(`HF error: ${resp.status} ${await resp.text()}`);
    const data = await resp.json();
    const text = Array.isArray(data) ? data[0]?.generated_text : (data?.generated_text || '');
    try { const m = text.match(/\{[\s\S]*\}$/); return m ? JSON.parse(m[0]) : JSON.parse(text); }
    catch { return { narrative: 'Smoke curls into letters (fallback).', suggested_commands: ['look around'] }; }
  }
}
