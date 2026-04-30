import 'dotenv/config';
import { chat } from './services/ai.ts';

async function run() {
  try {
    const res = await chat('check laptop price');
    console.log(res);
  } catch (err) {
    console.error("ERROR", err.response?.data || err);
  }
}
run();
