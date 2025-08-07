import express from 'express';
const app = express();
app.use(express.json());
import { router} from './routes/v1/index';
app.use('/api/v1',router);
app.listen(3000, () => {
  console.log('Server is running on port 3000');
});