import { convertToLlm } from './packages/coding-agent/dist/core/messages.js';

const messages = [
  { role: 'user', content: 'Check <tool_calls><invoke name="bash">ls</invoke></tool_calls>', timestamp: Date.now() },
  { role: 'assistant', content: [{ type: 'text', text: 'I will check files <tool_calls><invoke name="grep">TODO</invoke></tool_calls>' }], timestamp: Date.now() }
];

const result = convertToLlm(messages);
console.log('Converted messages:');
console.log(JSON.stringify(result, null, 2));
console.log('\nUser message XML stripped:', !result[0].content.includes('<tool_calls>'));
const assistantHasXml = result[1].content.some((c: any) => c.text && c.text.includes('<tool_calls>'));
console.log('Assistant message XML stripped:', !assistantHasXml);
