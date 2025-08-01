import { Router } from 'express';
export const router = Router();
import { userrouter } from './user';
import { spaceRouter } from './space';
import { adminRouter } from './admin';
router.post('/signup',(req , res)=>{
res.send('Signup route is working');
});
router.post('/login',(req,res)=>{
res.send('Login route is working')
});
router.get('/elements',(req,res)=>{
res.send('Elements route is working');
});
router.get('/avatars',(req,res)=>{
res.send('Avatars route is working');
});
router.use('/user',userrouter);
router.use('/space',spaceRouter);
router.use('/admin',adminRouter);
