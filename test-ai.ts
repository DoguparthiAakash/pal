import { streamText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
async function test() {
  const result = streamText({
    model: createGroq({ apiKey: 'test' })('llama-3.1-8b-instant'),
    messages: [{ role: 'user', content: 'test' }]
  });
  console.log(Object.keys(result));
}
test();
