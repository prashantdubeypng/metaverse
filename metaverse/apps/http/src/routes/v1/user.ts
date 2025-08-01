import { Router } from 'express';
export const userrouter = Router();

userrouter.post('/metadata', (req, res) => {
    res.send('User metadata route is working');
});
userrouter.get('/metadata/bulk',(req , res)=>{
    res.send('User metadata bulk route is working');
})