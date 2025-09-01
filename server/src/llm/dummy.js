export class DummyProvider {
  async generateJSON(schema, messages) {
    const userMsg = messages.find(m => m.role === 'user')?.content || '';
    const isStart = /Start a new session|Initialize/i.test(userMsg);
    if (isStart) {
      return {
        narrative: "Green lamps flicker under the full moon. The Gate Twins watch with mismatched eyes.",
        state_changes: {},
        npc_changes: [],
        suggested_commands: ["look around", "enter bazaar", "talk to the twins"]
      };
    }
    return {
      narrative: "The market hums softly, as if the stalls are breathing.",
      state_changes: {},
      npc_changes: [],
      suggested_commands: ["head to the mask stalls", "seek the oracle", "inspect your pockets"]
    };
  }
}
