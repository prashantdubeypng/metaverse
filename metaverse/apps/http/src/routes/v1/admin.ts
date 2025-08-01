import { Router } from 'express';
export const adminRouter = Router();

adminRouter.get('/', (req, res) => {
    res.send('Admin route is working');
});
adminRouter.post('/map',(req,res)=>{
res.send('map created');
});
adminRouter.post('/avatar',(req,res)=>{
    res.send('avatar created');
});
adminRouter.post('/element',(req,res)=>{
    res.send('element created');
});
