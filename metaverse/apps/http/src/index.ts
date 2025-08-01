import express from 'express';
const app = express();
import client from "@repo/db"; 
import { router} from './routes/v1/index.js';
app.use('/api/v1',router);
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});