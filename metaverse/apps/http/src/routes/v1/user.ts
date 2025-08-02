import { Router } from 'express';
import { updatemetadata } from '../../types';
export const userrouter = Router();

userrouter.post('/metadata', (req, res) => {
    const parser = updatemetadata.safeParse(req.body);
    if (!parser.success) {
        return res.status(400).send(parser.error);
    }
    res.send('User metadata route is working');
});
userrouter.get('/metadata/bulk',(req , res)=>{
    res.send('User metadata bulk route is working');
})