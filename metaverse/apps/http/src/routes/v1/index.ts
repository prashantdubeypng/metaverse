import { Router } from 'express';
export const router = Router();
import client from '@repo/db';
import { userrouter } from './user';
import { spaceRouter } from './space';
import { adminRouter } from './admin';
import { chatroomRouter } from './chatroom';
// import { messagesRouter } from './messages';
import { mapRouter } from './map';
import authRouter from './auth';
import adminDashboardRouter from './admin-dashboard';

// Use the new secure auth router
router.use('/auth', authRouter);

// Admin dashboard with basic auth (logs, health, metrics)
router.use('/admin-dashboard', adminDashboardRouter);

router.get('/elements',async(req,res)=>{
     try{
        const elements = await client.element.findMany()
        console.log(elements)
        res.json({elements:elements.map(x=>({
            id: x.id,
            imageurl: x.imageurl,
            width: x.width,
            height: x.height,
            static: x.static
        }))});
    }catch(e){
        console.error(e);
        return res.status(500).send('Internal Server Error');
     }
});
router.get('/avatars',async(req,res)=>{
    try{
        const avatars = await client.avatar.findMany();
        return res.json({avatars:avatars.map(x=>({
            id: x.id,
            imageurl: x.imageurl,
            name: x.name
        }))});
    }catch(e){
        console.error(e);
        return res.status(500).send('Internal Server Error');
    }
});
router.use('/user',userrouter);
router.use('/space',spaceRouter);
router.use('/admin',adminRouter);
router.use('/chatroom',chatroomRouter);
// router.use('/messages',messagesRouter);
router.use('/map',mapRouter);